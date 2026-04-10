/**
 * crypto.js — Encryption helpers for hollr.to (v5.2.3)
 * ──────────────────────────────────────────────────────
 *
 * OVERVIEW
 * ─────────
 * Two encryption layers protect user data at rest:
 *
 *   1. AES-256-CBC + PBKDF2   →  text secrets  (Resend API keys, tokens)
 *   2. AES-256-GCM            →  binary blobs  (file / voice uploads)
 *
 * WHY TWO ALGORITHMS?
 * ───────────────────
 *   CBC is simple and well-understood for short text values. We pair it
 *   with PBKDF2 (100 000 iterations, SHA-256) so that brute-forcing the
 *   master secret against the database is computationally prohibitive —
 *   ~10 billion operations per guess on current hardware.
 *
 *   GCM provides authenticated encryption (confidentiality + integrity in
 *   one pass) and is natively supported by the browser's Web Crypto API,
 *   enabling pure client-side decryption of uploaded files without any
 *   server round-trip.
 *
 * MASTER SECRET
 * ─────────────
 *   ENCRYPTION_SECRET is a 64-char hex string stored as a Fly.io secret.
 *   Never commit it. If you need to rotate it, re-encrypt every stored
 *   secret with the new key before swapping the env var.
 *
 * WIRE FORMATS
 * ────────────
 *   Text (CBC):
 *     Stored string:  "saltHex:ivHex:ciphertextHex"   (colon-delimited)
 *     Each segment is hex-encoded so it's safe in a TEXT column.
 *     A fresh salt is generated per value — identical inputs produce
 *     different ciphertexts (prevents frequency analysis on the DB).
 *
 *   Binary (GCM):
 *     On-disk buffer: [16-byte authTag] [ciphertext bytes …]
 *     Storing the tag first lets the browser viewer slice bytes 0-15
 *     independently of ciphertext length.
 *
 * KEY LESSON — GCM authTag placement
 * ───────────────────────────────────
 *   Node's crypto API separates tag from ciphertext; SubtleCrypto expects
 *   them concatenated as [ciphertext][authTag]. We store [authTag][cipher],
 *   so the /decrypt viewer re-orders before calling SubtleCrypto.decrypt().
 *   Always document your wire format — this tripped us up initially.
 */

'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// TEXT ENCRYPTION  (AES-256-CBC + PBKDF2)
// Used for: Resend API keys, OAuth tokens stored in SQLite
// ─────────────────────────────────────────────────────────────────────────────

const CBC_ALGORITHM  = 'aes-256-cbc';
const PBKDF2_ITERS   = 100_000;   // OWASP 2023 recommended minimum
const KEY_LEN_BYTES  = 32;        // 256 bits

/**
 * deriveKey
 * Stretches the master secret into a 256-bit AES key using PBKDF2-SHA256.
 * A unique per-value salt prevents dictionary attacks on the database dump.
 *
 * @param  {string} saltHex  16 random bytes, hex-encoded (32 chars)
 * @returns {Buffer}          32-byte key for AES-256
 */
function deriveKey(saltHex) {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      'ENCRYPTION_SECRET env var is not set. ' +
      'Run: flyctl secrets set ENCRYPTION_SECRET=$(openssl rand -hex 32)'
    );
  }
  return crypto.pbkdf2Sync(
    secret,
    Buffer.from(saltHex, 'hex'),
    PBKDF2_ITERS,
    KEY_LEN_BYTES,
    'sha256',
  );
}

/**
 * encrypt
 * Encrypts a UTF-8 string and returns a portable colon-delimited blob.
 *
 * Example:
 *   const blob = encrypt('re_my_resend_key');
 *   // → "a3f2...:9c1e...:ddb4..."
 *   db.prepare('UPDATE users SET resend_key = ?').run(blob);
 *
 * @param  {string} plaintext
 * @returns {string}  "saltHex:ivHex:ciphertextHex"
 */
function encrypt(plaintext) {
  const saltHex  = crypto.randomBytes(16).toString('hex');
  const iv       = crypto.randomBytes(16);  // AES block size = 128 bits
  const key      = deriveKey(saltHex);
  const cipher   = crypto.createCipheriv(CBC_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return `${saltHex}:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * decrypt
 * Reverses encrypt(). Throws on wrong secret, malformed blob, or bad padding.
 *
 * Example:
 *   const apiKey = decrypt(user.resend_key);
 *
 * @param  {string} blob  "saltHex:ivHex:ciphertextHex"
 * @returns {string}       original plaintext
 */
function decrypt(blob) {
  const [saltHex, ivHex, cipherHex] = blob.split(':');
  if (!saltHex || !ivHex || !cipherHex) {
    throw new Error('Invalid encrypted blob — expected "salt:iv:cipher"');
  }
  const key      = deriveKey(saltHex);
  const iv       = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(CBC_ALGORITHM, key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// BINARY ENCRYPTION  (AES-256-GCM)
// Used for: file uploads and voice recordings stored on Fly.io volume
// ─────────────────────────────────────────────────────────────────────────────

/**
 * encryptBuffer
 * Encrypts arbitrary binary data with AES-256-GCM.
 *
 * Each file gets its own fresh key + IV, so compromising one file key
 * reveals nothing about other files. The hex key and IV are returned to
 * the caller and embedded in the notification email as URL hash parameters
 * (#key=...&iv=...) — they never touch the server during playback.
 *
 * On-disk layout:
 *   Byte  0-15  →  GCM authentication tag (16 bytes, 128-bit)
 *   Byte  16-…  →  ciphertext
 *
 * Browser decrypt flow (decrypt/index.html):
 *   1. Fetch raw bytes from /api/decrypt/:handle/:filename
 *   2. authTag  = bytes.slice(0, 16)
 *   3. cipher   = bytes.slice(16)
 *   4. SubtleCrypto.decrypt({ name:'AES-GCM', iv, tagLength:128 },
 *                           key, concat(cipher, authTag))
 *      ↑ SubtleCrypto expects [ciphertext][authTag] — we re-order here.
 *
 * @param  {Buffer} buf   raw file bytes (from multer memoryStorage)
 * @returns {{ encrypted: Buffer, keyHex: string, ivHex: string }}
 */
function encryptBuffer(buf) {
  const key    = crypto.randomBytes(32);  // 256-bit key — unique per file
  const iv     = crypto.randomBytes(12);  // 96-bit nonce — GCM recommendation
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
  const authTag    = cipher.getAuthTag();  // 16 bytes (128-bit tag)

  return {
    encrypted: Buffer.concat([authTag, ciphertext]),  // tag-first wire format
    keyHex:    key.toString('hex'),  // 64 chars — goes in email decrypt link
    ivHex:     iv.toString('hex'),   // 24 chars — goes in email decrypt link
  };
}

/**
 * decryptBuffer
 * Reverses encryptBuffer() server-side.
 *
 * In the current architecture decryption happens client-side in the browser;
 * this function exists for completeness and potential future inbox features.
 *
 * @param  {Buffer} buf     [16-byte authTag][ciphertext…]
 * @param  {string} keyHex  64-char hex key
 * @param  {string} ivHex   24-char hex IV
 * @returns {Buffer}         original plaintext bytes
 */
function decryptBuffer(buf, keyHex, ivHex) {
  const key      = Buffer.from(keyHex, 'hex');
  const iv       = Buffer.from(ivHex, 'hex');
  const authTag  = buf.slice(0, 16);
  const data     = buf.slice(16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

module.exports = { encrypt, decrypt, encryptBuffer, decryptBuffer };
