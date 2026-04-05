/**
 * crypto.js — Encryption helpers for hollr.to (v4.0.0)
 *
 * Two responsibilities:
 *   1. AES-256-CBC + PBKDF2 for encrypting text secrets at rest
 *      (Resend API keys, OAuth tokens stored in the DB)
 *   2. AES-256-GCM for encrypting file/voice uploads at rest
 *      Key + IV are returned to the caller so the owner can decrypt in-browser.
 *
 * The server-side master secret lives in ENCRYPTION_SECRET env var.
 */

const crypto = require('crypto');

// ── Text encryption (AES-256-CBC + PBKDF2) ───────────────────────────────────

const ALGORITHM  = 'aes-256-cbc';
const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // bytes → 256 bits

/**
 * Derives a 256-bit AES key from the server secret + a salt.
 * @param {string} salt — hex-encoded 16-byte salt
 * @returns {Buffer}
 */
function deriveKey(salt) {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET env var is not set');
  return crypto.pbkdf2Sync(secret, Buffer.from(salt, 'hex'), ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts a plaintext string.
 * @param {string} plaintext
 * @returns {string} "salt:iv:ciphertext" — all hex-encoded
 */
function encrypt(plaintext) {
  const salt    = crypto.randomBytes(16).toString('hex');
  const iv      = crypto.randomBytes(16);
  const key     = deriveKey(salt);
  const cipher  = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${salt}:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a string produced by encrypt().
 * @param {string} blob — "salt:iv:ciphertext"
 * @returns {string}
 */
function decrypt(blob) {
  const [salt, ivHex, cipherHex] = blob.split(':');
  const key      = deriveKey(salt);
  const iv       = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

// ── File/binary encryption (AES-256-GCM) ─────────────────────────────────────

/**
 * Encrypts a Buffer using a freshly generated AES-256-GCM key.
 * The key and IV are returned in hex so the file owner can decrypt in-browser
 * using the Web Crypto API (AES-GCM is natively supported everywhere).
 *
 * Wire format written to disk:
 *   [16 bytes auth tag] [ciphertext...]
 *
 * @param {Buffer} buf — raw file bytes
 * @returns {{ encrypted: Buffer, keyHex: string, ivHex: string }}
 */
function encryptBuffer(buf) {
  const key    = crypto.randomBytes(32);          // 256-bit key
  const iv     = crypto.randomBytes(12);          // 96-bit GCM IV (recommended)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
  const authTag    = cipher.getAuthTag(); // 16 bytes

  // Store: authTag || ciphertext (so decryptor can extract the tag easily)
  const encrypted = Buffer.concat([authTag, ciphertext]);

  return {
    encrypted,
    keyHex: key.toString('hex'),
    ivHex:  iv.toString('hex'),
  };
}

/**
 * Decrypts a Buffer produced by encryptBuffer().
 * @param {Buffer} buf    — [16-byte authTag][ciphertext...]
 * @param {string} keyHex — 32-byte key as hex
 * @param {string} ivHex  — 12-byte IV as hex
 * @returns {Buffer}
 */
function decryptBuffer(buf, keyHex, ivHex) {
  const key      = Buffer.from(keyHex, 'hex');
  const iv       = Buffer.from(ivHex, 'hex');
  const authTag  = buf.slice(0, 16);
  const cipher   = buf.slice(16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cipher), decipher.final()]);
}

module.exports = { encrypt, decrypt, encryptBuffer, decryptBuffer };
