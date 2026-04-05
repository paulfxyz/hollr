# hollr.to

[![Version](https://img.shields.io/badge/version-4.3.0-1a1814?style=flat-square&logo=github)](https://github.com/paulfxyz/hollr/releases/tag/v4.3.0)
[![License: MIT](https://img.shields.io/badge/license-MIT-c96a2a?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003b57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Deployed on Fly.io](https://img.shields.io/badge/Fly.io-deployed-7c3aed?style=flat-square)](https://fly.io)
[![Open Source](https://img.shields.io/badge/open_source-MIT-f9f6f1?style=flat-square)](https://github.com/paulfxyz/hollr)

---

## What is hollr?

**hollr.to** is a personal encrypted message canvas. Sign in with X or email, claim a handle, and share `hollr.to/yourname`. Anyone with that link gets a timed, distraction-free canvas to write you a message — no account required. Messages can be PGP-encrypted end-to-end so the server never sees the plaintext, and file or voice attachments are encrypted with AES-256-GCM before they ever touch disk. Everything is MIT-licensed and self-hostable in under an hour.

The project is deliberately free of framework overhead. The backend is Node.js + Express + SQLite. The frontend is static HTML/CSS/JS deployed to SiteGround via FTP. There is no build step, no bundler, no ORM. Every technical decision in this codebase was made consciously — this README exists to document those decisions so you can learn from them, steal them, or argue with them.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Deep-dive: Authentication](#deep-dive-authentication)
4. [Deep-dive: Encryption](#deep-dive-encryption)
5. [Deep-dive: Database Design](#deep-dive-database-design)
6. [Deep-dive: The HTTP API](#deep-dive-the-http-api)
7. [Deep-dive: Frontend Architecture](#deep-dive-frontend-architecture)
8. [Deep-dive: Infrastructure](#deep-dive-infrastructure)
9. [Deep-dive: Security Decisions](#deep-dive-security-decisions)
10. [Versioning Guideline](#versioning-guideline)
11. [Issues, Bottlenecks & Lessons Learned](#issues-bottlenecks--lessons-learned)
12. [Contributing](#contributing)
13. [License](#license)

---

## Features

| Feature | Details |
|---|---|
| 🔐 PGP E2E Encryption | OpenPGP.js client-side — server never sees message plaintext |
| 🗂️ AES-256-GCM File Encryption | Files encrypted before write; authenticated encryption detects tampering |
| 🎙️ AES-256-GCM Voice Recording | Voice blobs treated identically to file uploads |
| 🐦 X OAuth 2.0 PKCE | Full RFC 7636 PKCE flow; no implicit grant, no client secret exposure |
| 📧 Magic-link Auth | Passwordless email login; UUID tokens, 15-min TTL, single-use |
| 📬 Optional Resend API | Email delivery is optional; app works without it (canvas-only mode) |
| ⏱️ Timed Canvas | Sender UI auto-locks after configurable time; no lingering access |
| 📁 File Upload | Any file type; multer memoryStorage → encrypt → write .enc to volume |
| 🎙️ Voice Recording | Web MediaRecorder API; same encryption pipeline as file uploads |
| 🌍 10 Languages | i18n via STRINGS object + `data-i18n` attributes; no library needed |
| 🌙 Dark / Light / System Mode | CSS custom properties; no-flash inline script reads theme before paint |
| 📜 MIT License | Fully open source; fork it, self-host it, build on it |

---

## Architecture

### Request Flow

Every user-visible request travels through two distinct infrastructure layers. The frontend is a static site hosted on SiteGround's Apache servers. The API lives on a Fly.io Firecracker VM. They communicate over HTTPS, separated by origin, with CORS and Bearer-token auth bridging them.

```
┌────────────────────────────────────────────────────────────────────────┐
│                         BROWSER                                         │
│  hollr.to/yourname   →   static HTML/CSS/JS (SiteGround/Apache)        │
│                                                                         │
│  API calls           →   hollr-api.fly.dev  (HTTPS + Bearer token)     │
└────────────────────────────┬───────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Fly.io (cdg / Paris)                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Express app  (server.js)                                        │  │
│  │                                                                  │  │
│  │  Middleware stack                                                │  │
│  │   helmet → cors → json → session → rate-limiters → routes       │  │
│  │                                                                  │  │
│  │  Route groups                                                    │  │
│  │   /api/auth/*   → auth.js   (magic links, X OAuth, sessions)    │  │
│  │   /api/user/*   → user.js   (handle, settings, profile)         │  │
│  │   /api/send     → send.js   (message delivery)                  │  │
│  │   /api/files/*  → files.js  (upload, download)                  │  │
│  │   /health       → inline    (200 OK, version, uptime)           │  │
│  └──────────────┬───────────────────────────────┬───────────────────┘  │
│                 │                               │                       │
│         ┌───────▼────────┐           ┌──────────▼───────────┐          │
│         │  SQLite (WAL)  │           │  /data volume (3 GB) │          │
│         │  /data/db.db   │           │  *.enc files         │          │
│         └────────────────┘           └──────────────────────┘          │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ HTTPS (outbound)
              ┌────────────────┼─────────────────┐
              │                │                 │
       ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
       │  Resend API  │  │  X / Twitter │  │   (future)  │
       │  email send  │  │  OAuth 2.0   │  │             │
       └─────────────┘  └─────────────┘  └─────────────┘
```

### Auth State Machine

Two authentication paths converge on the same `sessions` table row and Bearer token. Once authenticated, the client is indistinguishable regardless of how it authenticated.

```
EMAIL PATH
──────────
  User enters email
       │
       ▼
  POST /api/auth/magic-link
  ├─ Generate UUID v4 token
  ├─ INSERT INTO magic_links (email, token, expires_at, used=0)
  └─ Send link via Resend → hollr.to/auth/verify?token=UUID
       │
       ▼  (user clicks link)
  GET /api/auth/verify?token=UUID
  ├─ SELECT * FROM magic_links WHERE token=? AND used=0 AND expires_at > now()
  ├─ BEGIN; UPDATE magic_links SET used=1; (atomic — prevents race conditions)
  ├─ UPSERT users ON CONFLICT(email)
  ├─ INSERT INTO sessions (user_id, token=UUID_v4, expires_at=+30d)
  └─ Redirect → hollr.to/auth/verify?x_session=SESSION_TOKEN
       │
       ▼
  Frontend reads x_session from URL param
  ├─ Stores in sessionStorage['hollr-token']
  └─ Redirects to /dashboard or /onboarding

X OAUTH PATH
────────────
  User clicks "Sign in with X"
       │
       ▼
  GET /api/auth/x
  ├─ Generate code_verifier (random bytes, base64url)
  ├─ code_challenge = base64url(sha256(code_verifier))
  ├─ Generate state (random bytes)
  ├─ Store { code_verifier, state } in express-session
  └─ Redirect → api.twitter.com/oauth2/authorize?
       code_challenge=...&state=...&response_type=code
       │
       ▼  (Twitter redirects back)
  GET /api/auth/x/callback?code=AUTH_CODE&state=STATE
  ├─ Verify state matches session (CSRF check)
  ├─ POST api.twitter.com/2/oauth2/token
  │   with code_verifier (PKCE exchange)
  ├─ GET api.twitter.com/2/users/me
  ├─ UPSERT users ON CONFLICT(x_id)
  ├─ INSERT INTO sessions
  └─ If no email on record: redirect with needsEmail=1
       │
       ▼
  Frontend: hollr.to/auth/verify?x_session=TOKEN[&needsEmail=1]
  └─ If needsEmail=1 → show email collection modal
```

### Encryption Layers

| Layer | Algorithm | What is protected | Key source |
|---|---|---|---|
| Text secrets | AES-256-CBC + PBKDF2 | User settings (API keys, tokens) stored in DB | `MASTER_SECRET` env var |
| File/voice content | AES-256-GCM | Attachment bytes on Fly.io volume | Random per-file key (in URL hash) |
| PINs | bcrypt (cost 12) | Settings access PIN | Irreversible — stored as hash only |
| Message body | OpenPGP.js (RSA/ECC) | Message plaintext | Recipient's public key (client-side) |
| Transport | TLS 1.3 | All data in transit | Fly.io / SiteGround certificates |

### Database Schema

The database lives in a single file at `/data/db.db`. All tables are created on first startup; columns added in later versions are applied via a try/catch ALTER TABLE loop on every boot.

```
┌──────────────────────────────────────────────────────────────────┐
│  users                                                           │
│  ─────                                                           │
│  id             INTEGER  PRIMARY KEY AUTOINCREMENT               │
│  handle         TEXT     UNIQUE, COLLATE NOCASE                  │
│  email          TEXT     UNIQUE                                  │
│  x_id           TEXT     UNIQUE  (Twitter user ID)               │
│  x_username     TEXT                                             │
│  pgp_public_key TEXT     (armored PGP public key, optional)      │
│  pin_hash       TEXT     (bcrypt hash of 4-8 digit PIN)          │
│  pin_is_default INTEGER  DEFAULT 1 (1 = still on "1234")         │
│  resend_api_key TEXT     (AES-256-CBC encrypted)                 │
│  resend_from    TEXT     (AES-256-CBC encrypted)                 │
│  notification_email TEXT                                         │
│  created_at     INTEGER  DEFAULT (unixepoch())                   │
└──────────────────────────────────────────────────────────────────┘
         │ 1
         │
         │ N
┌──────────────────────────────────────────────────────────────────┐
│  sessions                                                        │
│  ────────                                                        │
│  id         INTEGER  PRIMARY KEY AUTOINCREMENT                   │
│  user_id    INTEGER  REFERENCES users(id)                        │
│  token      TEXT     UNIQUE (UUID v4 — the Bearer token)         │
│  expires_at INTEGER  (unix timestamp, default now+30d)           │
│  created_at INTEGER  DEFAULT (unixepoch())                       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  magic_links                                                     │
│  ───────────                                                     │
│  id         INTEGER  PRIMARY KEY AUTOINCREMENT                   │
│  email      TEXT                                                 │
│  token      TEXT     UNIQUE (UUID v4 — the one-time link token)  │
│  expires_at INTEGER  (unix timestamp, now+15min)                 │
│  used       INTEGER  DEFAULT 0                                   │
│  created_at INTEGER  DEFAULT (unixepoch())                       │
└──────────────────────────────────────────────────────────────────┘
```

**Relationships:** A `users` row can have many `sessions` (one per login). Magic links are ephemeral — they're never joined to sessions or users by FK; the email column is the join key.

**Indexes:**
- `idx_sessions_token` on `sessions(token)` — every authenticated request does a token lookup
- `idx_sessions_user_id` on `sessions(user_id)` — for logout-all-sessions queries
- `idx_users_x_id` on `users(x_id)` — X OAuth upsert lookup
- `idx_magic_links_token` on `magic_links(token)` — verify endpoint lookup

### File Upload Flow

```
Browser
  │  multipart/form-data POST /api/files/upload
  │  (file bytes in memory — multer memoryStorage)
  ▼
multer middleware
  │  req.file.buffer = raw bytes (never written to disk as plaintext)
  ▼
crypto.encryptFile(buffer)
  │  Generate random 32-byte key
  │  Generate random 12-byte IV
  │  AES-256-GCM encrypt → { ciphertext, authTag, key, iv }
  │  Write [authTag][ciphertext] to /data/uploads/<uuid>.enc
  ▼
Response to browser:
  {
    fileId: "<uuid>",
    key: "<hex>",
    iv:  "<hex>"
  }
  │
  ▼
Browser constructs decrypt URL:
  hollr.to/decrypt#fileId=<uuid>&key=<hex>&iv=<hex>
  │  (hash fragment — never sent to server)
  ▼
Link embedded in message or shared directly
```

### In-Browser Decrypt Flow

```
User opens hollr.to/decrypt#fileId=abc&key=...&iv=...
  │
  ▼
decrypt.html inline script
  │  Parse window.location.hash
  │  Extract fileId, key (hex), iv (hex)
  │
  ▼
fetch('/api/files/raw/' + fileId)
  │  Returns raw bytes: [16-byte authTag][ciphertext...]
  │
  ▼
SubtleCrypto pipeline
  │  hexToBytes(key) → rawKeyBytes
  │  SubtleCrypto.importKey('raw', rawKeyBytes, {name:'AES-GCM'}, false, ['decrypt'])
  │
  │  Re-order bytes: [ciphertext][authTag]   ← SubtleCrypto expects this order
  │  SubtleCrypto.decrypt({name:'AES-GCM', iv, tagLength:128}, key, combinedBuffer)
  │
  ▼
Plaintext bytes
  │  Detect MIME type from magic bytes
  │  If image/audio/video → render in <img>/<audio>/<video>
  │  Otherwise → createObjectURL → trigger download
```

---

## Deep-dive: Authentication

### Magic Links — Why and How

**Why magic links instead of passwords?** Passwords introduce an entire class of problems: storage (you must hash and salt correctly), recovery (forgot-password flows that are themselves security holes), reuse (users reuse passwords across sites), and strength (users choose weak ones). Magic links sidestep all of this. There is no password to hash, no credential to steal, and no database of secrets to leak. The security model shifts to: "can the attacker access your email inbox?" — which is the same question for any password-reset flow anyway.

The UX benefit is equally significant. Users don't need to remember a password for a service they might use once a month. Clicking a link is lower friction than remembering a credential. This matters when your conversion goal is "get someone to the canvas and send a message."

**How the token is generated:** On `POST /api/auth/magic-link`, the server calls `crypto.randomUUID()` — Node's built-in UUID v4 generator, which uses a cryptographically secure random source. The token is stored in the `magic_links` table alongside the email, an expiry timestamp (`unixepoch() + 900` — 15 minutes in seconds), and `used = 0`. The full link is `https://hollr.to/auth/verify?token=UUID` and is delivered via the Resend REST API.

**Single-use enforcement:** When the verify endpoint receives a token, it runs this sequence inside a SQLite transaction:

```sql
-- Step 1: find the token
SELECT id, email FROM magic_links
WHERE token = ? AND used = 0 AND expires_at > unixepoch()

-- Step 2: mark it used (inside the same transaction)
UPDATE magic_links SET used = 1 WHERE id = ?
```

SQLite's serialized writer model means no two requests can execute this sequence concurrently and both succeed. The `used = 1` flag is set atomically before the session row is created. A second click on the same link will hit the `used = 0` condition and fail cleanly — returning a 401 with a "link already used" message.

**Email enumeration prevention:** `POST /api/auth/forgot-pin` always returns `{ ok: true }` regardless of whether the email exists in the database. If we returned an error for unknown emails, an attacker could POST arbitrary emails and learn which ones are registered. Returning the same response for both cases closes that information leak. This is a standard defense described in OWASP's Authentication Cheat Sheet.

**Why no SDK for Resend?** The Resend API is a single HTTPS POST with a JSON body and an Authorization header. Node's built-in `https` module handles this in ~20 lines. Adding `@resend/node` or `axios` just to make one HTTP call adds a dependency (and its transitive dependencies) with no meaningful benefit. The `mailer.js` module uses `https.request()` directly.

---

### X OAuth 2.0 PKCE — Full Explanation

**What PKCE is and why it exists:** PKCE stands for Proof Key for Code Exchange (RFC 7636). It was designed to protect public clients — apps that cannot safely store a client secret — from authorization code interception attacks. In the classic OAuth 2.0 authorization code flow, an attacker who intercepts the authorization code (e.g., via a malicious app registered for the same redirect URI on mobile) can exchange it for tokens. PKCE prevents this by binding the code to a secret that only the original requester knows: the `code_verifier`.

**The four-step flow:**

```
Step 1 — Generate verifier and challenge (server-side, before redirect)
  code_verifier  = random 32 bytes → base64url encode (43-128 chars)
  code_challenge = base64url(sha256(code_verifier))

Step 2 — Redirect to Twitter with challenge (not verifier)
  GET https://twitter.com/i/oauth2/authorize
    ?response_type=code
    &client_id=YOUR_CLIENT_ID
    &redirect_uri=https://hollr-api.fly.dev/api/auth/x/callback
    &scope=tweet.read%20users.read%20offline.access
    &state=RANDOM_STATE
    &code_challenge=BASE64URL_SHA256_OF_VERIFIER
    &code_challenge_method=S256

Step 3 — Twitter redirects back with auth code
  GET /api/auth/x/callback?code=AUTH_CODE&state=STATE

Step 4 — Exchange code for tokens, sending the verifier (not the challenge)
  POST https://api.twitter.com/2/oauth2/token
    code=AUTH_CODE
    &grant_type=authorization_code
    &redirect_uri=...
    &code_verifier=ORIGINAL_VERIFIER   ← Twitter re-derives challenge and compares
```

Twitter verifies that `sha256(code_verifier) == code_challenge` it stored in step 2. An attacker who stole the auth code but not the verifier cannot complete the exchange.

**Why verifier must live in express-session, not the browser:** The callback (step 3) hits the *backend*, not the frontend. When Twitter redirects, the browser navigates to `/api/auth/x/callback` on the API server. The frontend JavaScript is not involved at this point — it's just the browser following a redirect. The code_verifier must therefore be available on the server when the callback arrives. `express-session` stores it server-side (in memory, keyed by the session cookie). Storing it in `localStorage` or `sessionStorage` would be impossible: the backend can't read browser storage.

**The redirect chain in full:**

```
1. User clicks "Sign in with X" on hollr.to
2. Frontend JS: window.location.href = 'https://hollr-api.fly.dev/api/auth/x'
3. Backend generates PKCE, stores in session, redirects to Twitter
4. Twitter authenticates user, redirects to:
   https://hollr-api.fly.dev/api/auth/x/callback?code=...&state=...
5. Backend verifies state, exchanges code, creates session, then redirects:
   https://hollr.to/auth/verify?x_session=SESSION_TOKEN[&needsEmail=1]
6. Frontend reads x_session from URL params, stores in sessionStorage
```

**Why `needsEmail=1`:** Twitter's OAuth 2.0 API does not return the user's email address in the `/2/users/me` response — email access requires a separate elevated permission that Twitter rarely grants to new apps. But hollr needs an email for two purposes: sending message notification emails, and PIN recovery. When an X user authenticates and has no email on record, the callback adds `needsEmail=1` to the redirect. The frontend detects this param and shows an email-collection modal before proceeding to the dashboard.

---

## Deep-dive: Encryption

### AES-256-CBC — Text Secrets

Sensitive strings stored in the database (like the user's Resend API key and sender address) are encrypted at rest using AES-256-CBC with a key derived via PBKDF2.

**Why CBC for text:** CBC (Cipher Block Chaining) produces a fixed-overhead output — deterministic length expansion relative to input. This makes it suitable for short strings where authenticated encryption's overhead (GCM's authTag) would be disproportionate. The trade-off is that CBC alone doesn't detect tampering; we accept this because these values are stored in our own database, not transmitted to untrusted parties.

**PBKDF2 — key stretching:** The encryption key is not `MASTER_SECRET` directly. `PBKDF2(MASTER_SECRET, salt, 100000, 32, 'sha256')` derives a 32-byte key. PBKDF2 is intentionally slow — 100,000 iterations means an attacker who steals the database still needs ~100,000 SHA-256 operations per guess of the master secret, not one. This is the OWASP 2023 minimum recommendation for PBKDF2-SHA256. A fresh random salt is generated per encryption call, preventing frequency analysis: two identical plaintext values produce different ciphertext.

**Wire format:** The encrypted value stored in the DB is a colon-delimited hex string:

```
saltHex:ivHex:ciphertextHex

Example:
a3f1...64 bytes...:b2c9...32 bytes...:d4e7...variable...
```

Why hex? SQLite `TEXT` columns store arbitrary UTF-8. Hex encoding is always valid UTF-8, unambiguous, and reversible with `Buffer.from(hex, 'hex')`. Binary storage in a TEXT column would require BLOB columns and blob-aware drivers. Colon as delimiter is safe because hex strings never contain colons.

**Rotating the master secret:** If `MASTER_SECRET` changes (e.g., a suspected compromise), all stored values encrypted with the old key become undecryptable. The rotation procedure is: (1) export all encrypted values, (2) decrypt with old key, (3) re-encrypt with new key, (4) update the secret in Fly.io. This is a manual process by design — automatic rotation would require storing both keys simultaneously, which is a larger surface.

---

### AES-256-GCM — File and Voice Encryption

Files and voice recordings use GCM (Galois/Counter Mode) rather than CBC.

**Why GCM for files:** GCM provides *authenticated encryption* — it simultaneously ensures confidentiality (ciphertext reveals nothing about plaintext) and integrity (any modification to the ciphertext is detected). The authentication tag (authTag, 128 bits) is a MAC computed over the ciphertext during encryption. On decryption, if the authTag doesn't match, decryption fails — you get an error, not silently corrupt data. This matters for files: a CBC-encrypted file could be silently corrupted by an attacker flipping bits, and you'd only notice when the application tried to parse the file.

**Why a fresh key + IV per file:** Each file gets its own randomly generated 32-byte key and 12-byte IV. If an attacker somehow compromises one file's key (e.g., via the URL hash if someone shares the link with someone who shouldn't have it), they learn nothing about any other file. Key reuse in GCM is catastrophic — reusing the same key+IV pair leaks the keystream. Random per-file keys eliminate this risk entirely.

**Wire format on disk:** Files are stored as `[16-byte authTag][ciphertext...]`. The authTag comes first. Node's `crypto.createCipheriv('aes-256-gcm', key, iv)` writes ciphertext and then exposes the tag via `cipher.getAuthTag()` after finalization. Writing tag-first means the reader knows exactly where the tag ends (byte 0–15) and the ciphertext begins (byte 16+). No length prefix or delimiter needed.

**The SubtleCrypto interop problem:** The Web Crypto API (`SubtleCrypto.decrypt`) expects the data buffer to be `[ciphertext][authTag]` — tag at the end, not the beginning. Node stores them separately (and we write tag-first). When the browser fetches the raw `.enc` file, it must re-order before decrypting:

```javascript
// Raw bytes from server: [authTag (16)][ciphertext (...)]
const rawBytes = new Uint8Array(arrayBuffer);
const authTag   = rawBytes.slice(0, 16);
const ciphertext = rawBytes.slice(16);

// SubtleCrypto wants: [ciphertext][authTag]
const combined = new Uint8Array(ciphertext.length + authTag.length);
combined.set(ciphertext, 0);
combined.set(authTag, ciphertext.length);

const plaintext = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv, tagLength: 128 },
  cryptoKey,
  combined
);
```

This is not a bug — it's an impedance mismatch between two correct implementations of the same spec that made different choices about how to expose the same data.

**Why key + IV go in the URL hash:** The decrypt URL is `hollr.to/decrypt#fileId=abc&key=deadbeef&iv=cafe...`. The hash fragment (everything after `#`) is defined in RFC 3986 §3.5 as client-side only — browsers do not include the fragment in HTTP requests. When the browser fetches `hollr.to/decrypt#...`, the server receives `GET /decrypt` with no fragment. The server never sees the key or IV. This is not a workaround — it's the correct, specified behavior of URL fragments, and is the same mechanism used by end-to-end encrypted services like Mega and Bitwarden Send.

---

### bcrypt — PINs

PINs (4–8 digits) are hashed with bcrypt at cost factor 12.

**Why bcrypt, not PBKDF2:** bcrypt is purpose-built for hashing passwords and PINs. Its cost factor directly controls the time per hash — cost 12 takes approximately 250ms on modern hardware. This means a brute-force attack on bcrypt-cost-12 is ~250ms per attempt, compared to a raw hash which could be billions of attempts per second. PBKDF2 can achieve similar results with enough iterations, but bcrypt's API makes it harder to accidentally use weak parameters: the cost factor is stored *inside the hash output*, so the algorithm is self-describing.

**Cost factor 12:** At 250ms, hashing is imperceptible to a human clicking a button. A 4-digit PIN has 10,000 combinations. At 250ms per attempt, exhaustive offline search takes 2,500 seconds (~42 minutes). With network latency and the auth rate limiter (10 requests per 15 minutes), online brute-force is effectively blocked. bcrypt's cost factor can be increased over time as hardware improves without changing the stored hash format.

**PINs are not for account access:** This is a deliberate design choice. The PIN gates the settings screen only — not login, not message reading. If a user forgets their PIN, they can reset it via the forgot-pin flow (which sends a magic link). The PIN cannot be recovered — only reset. This means a compromised PIN doesn't expose the account itself, just the settings.

---

### PGP — OpenPGP.js Client-Side Encryption

**What asymmetric encryption means in this context:** The recipient (hollr user) generates a PGP keypair in their browser. The public key is uploaded to the server and stored in `users.pgp_public_key`. The private key *never leaves the browser* — it's stored in `localStorage` on the user's device. When a sender submits a message, the browser fetches the recipient's public key from the API and encrypts the message with it using OpenPGP.js. The server receives only ciphertext — it has no capability to decrypt it, even under compulsion.

**Why client-side:** Server-side encryption with the server holding the key is encryption-theater — it protects against an attacker who steals your database, but not against one who compels you to decrypt. Client-side encryption means the server is cryptographically incapable of reading messages, not merely policy-prohibited from doing so. This is a meaningful security property for a service that handles private communications.

**Why `esm.sh`:** OpenPGP.js is a large library (~300KB gzipped). Importing it via a CDN like esm.sh means: (1) it's only loaded when a PGP key is set, via a dynamic `import()` that resolves lazily, and (2) there's no build step required. `esm.sh` transforms npm packages to native ES modules, so `import('https://esm.sh/openpgp@5')` works directly in the browser without webpack or rollup. The cost is a dependency on an external CDN — mitigated by pinning the version (`@5`) and the fact that the app degrades gracefully if OpenPGP.js fails to load (it falls back to unencrypted message delivery).

**Armored format:** PGP ciphertext is binary. The "armored" format is base64-encoded binary wrapped in ASCII headers:

```
-----BEGIN PGP MESSAGE-----

wcFMA4...base64...
=AbCd
-----END PGP MESSAGE-----
```

This makes PGP output safe to store in a TEXT column, paste into a UI, and transmit in JSON. The armor headers tell any PGP tool what to expect inside. hollr stores armored ciphertext as-is and renders it in a `<pre>` element for users who want to decrypt offline with GPG or Kleopatra.

**The OpenPGP.js API in practice:**

```javascript
const openpgp = await import('https://esm.sh/openpgp@5');
const publicKey = await openpgp.readKey({ armoredKey: profilePgpKey });
const message = await openpgp.createMessage({ text: messageBody });
const encrypted = await openpgp.encrypt({
  message,
  encryptionKeys: publicKey
});
// encrypted is an armored string — send this to the API
```

---

## Deep-dive: Database Design

### Why SQLite

The choice between SQLite and a client-server database like PostgreSQL or MySQL comes down to operational complexity vs. scale. For a service with fewer than 10,000 users, SQLite is unambiguously correct. There is no separate database process to manage, no connection pool to tune, no replication to configure, no credentials beyond the file path. The entire database is a single file that you can back up with `cp`, inspect with any SQLite browser, and restore by replacing the file.

Fly.io persistent volumes provide the durability that makes SQLite viable in production. The database file lives at `/data/db.db`, on a volume that persists across app restarts and deploys. Fly.io takes volume snapshots automatically. For a service at this scale, this is sufficient.

**WAL mode** (Write-Ahead Logging) is enabled on every startup with `PRAGMA journal_mode=WAL`. In the default rollback journal mode, readers block writers and writers block readers — connections queue up waiting for each other. WAL mode uses a separate write-ahead log file: readers read from the main database file while a writer appends to the WAL concurrently. Readers never block writers and writers never block readers. Crash safety is maintained — if the process dies mid-write, the WAL is discarded on next open and the database is in its pre-write state (no partial writes).

**Why `better-sqlite3` (synchronous API):** The `sqlite3` npm package is asynchronous — every query returns a Promise. `better-sqlite3` is synchronous — queries return results directly. This sounds like it would block the Node.js event loop, but in practice it doesn't meaningfully: SQLite queries are in-process calls that return in microseconds to low milliseconds. The async overhead of Promise wrapping and microtask scheduling adds more latency than a typical SQLite query takes. The synchronous API produces code that's dramatically easier to read, reason about, and debug. There are no callback pyramids, no forgotten `await` keywords, no race conditions from concurrent query results.

**`COLLATE NOCASE` on handle:** The `users` table has `handle TEXT UNIQUE COLLATE NOCASE`. This means SQLite treats "Alice", "ALICE", and "alice" as the same value for uniqueness purposes. Without this, `Alice` and `alice` would be distinct handles — two different users could claim them, and `hollr.to/alice` and `hollr.to/Alice` would route to different profiles. COLLATE NOCASE enforces uniqueness without forcing us to lowercase the stored value. The handle is stored as the user typed it (preserving case for display) but compared case-insensitively.

---

### Migration Strategy

SQLite supports `IF NOT EXISTS` for table creation but not for `ADD COLUMN` in ALTER TABLE. Running `ALTER TABLE users ADD COLUMN x_id TEXT` on a database where `x_id` already exists returns an error. The migration approach is a try/catch loop:

```javascript
const migrations = [
  'ALTER TABLE users ADD COLUMN x_id TEXT',
  'ALTER TABLE users ADD COLUMN x_username TEXT',
  'ALTER TABLE users ADD COLUMN pgp_public_key TEXT',
  // ... more columns
];

for (const sql of migrations) {
  try {
    db.prepare(sql).run();
  } catch (e) {
    // Column already exists — ignore and continue
  }
}
```

This is idempotent — safe to run on every application startup regardless of which version of the schema is already present. Each migration either succeeds (column added) or fails silently (column already exists). This approach works because ALTER TABLE ADD COLUMN is the only DDL operation we run after initial table creation. Dropping columns, renaming columns, or changing column types would require a more sophisticated migration system.

**The ordering trap:** In v3.0.0, the startup code created the `idx_users_x_id` index before the `ALTER TABLE users ADD COLUMN x_id` migration had run. SQLite returned `no such column: x_id` and the server crashed on startup. The fix was to run all ALTER TABLE migrations before creating any indexes that depend on those columns. This seems obvious in retrospect, but it's easy to overlook when the CREATE INDEX statement is in a separate section of the initialization code.

---

### Pending Handles

New users who haven't completed onboarding need a real database row — the session references `user_id`, and that foreign key must exist. But we can't require handle selection before creating the row (the user might abandon onboarding). The solution: on first login, assign a handle of the form `__pending_xxxxxxxx` where `xxxxxxxx` is 8 random hex characters.

```javascript
const pendingHandle = '__pending_' + crypto.randomBytes(4).toString('hex');
```

The `__` prefix is a reserved namespace that no user-facing handle can start with (handles must match `/^[a-zA-Z0-9_-]{2,30}$/` and cannot start with `__`). Everywhere the frontend might display or use the handle, there's a guard:

```javascript
const displayHandle = handle.startsWith('__pending') ? null : handle;
```

This null propagates to the frontend, which shows "Choose your handle" rather than the raw `__pending_...` string.

---

## Deep-dive: The HTTP API

### Middleware Stack

Express middleware executes in the order it's registered. The order matters — getting it wrong causes subtle failures. Here's the stack and why each item is where it is:

```javascript
app.use(helmet())               // 1. Security headers — before anything else
app.use(cors(corsOptions))      // 2. CORS — must handle OPTIONS preflight before routes
app.use(express.json())         // 3. Parse JSON body — routes need req.body
app.use(session(sessionConfig)) // 4. Session — needed by OAuth routes only
// Rate limiters applied per-route-group (see below)
app.use('/api/auth', authLimiter, authRouter)
app.use('/api/user', requireAuth, userRouter)
app.use('/api/send', sendLimiter, sendRouter)
app.use('/api/files', filesRouter)
```

**Why helmet first:** `helmet()` sets security-relevant response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.) on every response. If it came after routes, route handlers that call `res.send()` early would bypass it. First position guarantees every response gets the headers.

**Why cors before routes:** CORS preflight requests (`OPTIONS` method) never reach route handlers — they're handled entirely by the CORS middleware. If cors middleware came after route registration, OPTIONS requests to `/api/send` would get `405 Method Not Allowed` from Express before the CORS headers were added, and the browser would block the actual request.

**Why session is in the stack at all:** `express-session` is only needed for the X OAuth PKCE flow — the code_verifier must survive the redirect to Twitter and the return callback. All other authentication uses Bearer tokens in the Authorization header. The session cookie is an implementation detail of the OAuth flow, not a primary auth mechanism.

---

### `requireAuth` Middleware

Every protected route uses `requireAuth`:

```javascript
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });

  const row = db.prepare(`
    SELECT u.*, s.expires_at AS session_expires
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > unixepoch()
  `).get(token);

  if (!row) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user = row;
  next();
}
```

The single JOIN query gets both user and session data in one trip to SQLite. No N+1: we don't first fetch the session then separately fetch the user. `unixepoch()` is a SQLite built-in that returns the current Unix timestamp — comparing it inline in SQL avoids any clock drift between JavaScript's `Date.now()` and SQLite's notion of "now" (they're both the system clock, but using SQLite's built-in is cleaner and one fewer point of failure).

---

### CORS Configuration

The CORS origin is a function, not a string or regex:

```javascript
function corsOriginFn(origin, callback) {
  const allowed = [
    'https://hollr.to',
    'https://www.hollr.to',
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:5500']
      : [])
  ];
  if (!origin || allowed.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
```

The function form allows dynamic decisions. `!origin` allows server-to-server requests (curl, Postman) that don't send an Origin header. Dev origins are included only in non-production — a single env check ensures they never appear in production without a code change.

`credentials: true` is required because the X OAuth flow uses an `express-session` cookie. Cross-origin cookie sending requires both `Access-Control-Allow-Credentials: true` (set by cors with `credentials:true`) and `credentials: 'include'` in the fetch call. Without both, the browser drops the cookie on cross-origin requests and the PKCE session state is lost.

---

### Rate Limiting

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false
});

const sendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5               // 5 messages per minute per IP
});
```

**Auth limiter (10/15min):** Prevents magic-link spam (you can't flood a user's inbox), prevents brute-force on the verify endpoint, and limits X OAuth initiation. 10 requests in 15 minutes is generous enough for legitimate use (a user who clicks the magic-link button multiple times by mistake) but restrictive enough to defeat automation.

**Send limiter (5/min):** Prevents canvas abuse — someone shouldn't be able to fire 1,000 messages per minute at a recipient. Five per minute per IP is more than any human can type, less than any script would want to limit-respect.

**Why per-IP, not per-user:** The send endpoint is unauthenticated — senders don't have accounts. Per-user rate limiting only works when you have a user identity. For unauthenticated endpoints, the IP address is the only consistent signal available.

---

## Deep-dive: Frontend Architecture

### Why No Framework

The hollr frontend is vanilla HTML, CSS, and JavaScript — no React, no Vue, no Svelte, no build step. This is a conscious trade-off, not an oversight.

The benefits of a framework — component reuse, reactive state, compiled output — scale with application complexity. hollr's frontend consists of about a dozen pages, each largely independent. There are no shared stateful components that update reactively. The busiest page (the canvas) has a timer, a text area, a send button, and optional file/voice UI. This doesn't need a virtual DOM.

The costs of a framework in this context are real: a build step means `node_modules`, a bundler configuration, build cache invalidation, and a deploy process that must run a build before pushing files. Every npm vulnerability scanner alert becomes your problem. With vanilla JS, deploy is `lftp mirror --reverse` and you're done.

The trade-off is verbosity. Vanilla JS event handlers and DOM manipulation are more lines than JSX. That's acceptable for a project where the developer can hold the entire frontend in their head.

---

### Single-File Deploy Strategy

The landing page (`index.html`) is a single file that embeds its CSS and JavaScript. A Python script inlines `style.css` and `main.js` into `<style>` and `<script>` tags before deploy. The favicon is embedded as a base64 data URI in the `<link rel="icon">` tag.

The result: one HTTP request loads the entire landing page UI (excluding Google Fonts, which are loaded from Google's CDN). No separate JS bundle request, no CSS file request, no favicon request that might fail on some servers. The page renders immediately with zero render-blocking sub-resources.

For non-landing pages (canvas, auth, settings, decrypt), files remain separate — they're loaded infrequently enough that request count doesn't matter.

---

### i18n System

Internationalization uses a `STRINGS` object in `i18n.js`:

```javascript
const STRINGS = {
  en: {
    send_button: 'Send message',
    placeholder:  'Write something...',
    // ...
  },
  fr: {
    send_button: 'Envoyer le message',
    placeholder:  'Écrivez quelque chose...',
    // ...
  },
  // ... 10 languages total
};
```

HTML elements that need translation carry a `data-i18n` attribute:

```html
<button data-i18n="send_button">Send message</button>
```

The `applyTranslations(lang)` function walks the DOM:

```javascript
function applyTranslations(lang) {
  const dict = STRINGS[lang] || STRINGS['en'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
}
```

Language detection: `navigator.language.slice(0, 2)` extracts the ISO 639-1 code. If the code isn't in STRINGS, fall back to `'en'`. The selected language is saved to `localStorage['hollr-lang']` so it persists across sessions.

Why no library (i18next, etc.)? The STRINGS object and a 10-line function handle everything the app needs. Adding a library would bring its own API surface, bundle weight, and version-drift concern.

---

### sessionStorage vs localStorage

The Bearer token (session token) is stored in `sessionStorage['hollr-token']`, not `localStorage`.

**sessionStorage** is scoped to the browser tab. It survives page reloads within the tab but is cleared when the tab is closed. Each tab gets its own independent storage — an iframe cannot read the sessionStorage of its parent page and vice versa.

**localStorage** is persistent and shared across all tabs in the same origin. Storing an auth token in localStorage means it persists indefinitely and is readable by any tab open to hollr.to — including potential future tabs opened after the user intended to "close" their session.

For auth tokens, sessionStorage's tab-scoped lifetime is the correct behavior: session ends when the tab closes. The iframe isolation property also matters for the canvas: if hollr.to supports canvas embeds (an iframe showing the send form), that iframe cannot read the parent page's sessionStorage. Each context is isolated, which prevents a malicious parent page from extracting the recipient's session token from an embedded canvas.

---

### Apache mod_rewrite (.htaccess)

SiteGround serves the frontend from Apache. The `.htaccess` file configures URL rewriting so that non-file paths serve `index.html` (for client-side routing) while specific paths take priority:

```apache
RewriteEngine On

# Pass-through for actual files and directories
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Reserved routes — must come BEFORE the :handle wildcard
RewriteRule ^auth/verify$   /auth/verify.html [L]
RewriteRule ^auth/magic$    /auth/magic.html [L]
RewriteRule ^decrypt$       /decrypt.html [L]
RewriteRule ^dashboard$     /dashboard.html [L]
RewriteRule ^settings$      /settings.html [L]
RewriteRule ^onboarding$    /onboarding.html [L]

# Handle pages — the :handle wildcard
RewriteRule ^([a-zA-Z0-9_-]+)$ /canvas.html [L]
```

The ordering is critical. `auth/verify` must be matched before the handle wildcard, or a user navigating to `hollr.to/auth/verify` would be treated as a handle named "auth" and routed to the canvas. The same applies to `decrypt`. Static file check must come first (before all rewrites), or actual JS/CSS/image files would be rewritten to HTML pages.

---

### Dark/Light Mode — No Flash

The theme-switching logic follows a well-established pattern to avoid the "flash of wrong theme" problem:

```html
<head>
  <!-- ... meta tags ... -->
  <script>
    // Inline — runs synchronously before <body> is parsed
    (function() {
      var t = localStorage.getItem('hollr-theme');
      if (!t) {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', t);
    })();
  </script>
  <link rel="stylesheet" href="style.css">
</head>
```

The inline `<script>` runs synchronously before any CSS is applied or any body elements are parsed. It reads `localStorage['hollr-theme']` (the user's explicit choice) or falls back to the OS preference via `matchMedia`. By the time the browser paints the first frame, `data-theme` is already set on `<html>` and the CSS custom properties have their correct values.

CSS custom properties do the theming:

```css
:root {
  --bg: #f9f6f1;
  --text: #1a1814;
  --accent: #c96a2a;
}

[data-theme="dark"] {
  --bg: #1a1814;
  --text: #f9f6f1;
  --accent: #e88a4a;
}
```

Every color reference in the stylesheet uses `var(--bg)`, `var(--text)`, etc. Switching themes is a single attribute change on `<html>` — the browser re-evaluates all custom property references automatically.

---

### Web Crypto API — In-Browser Decrypt

The `/decrypt` page uses `SubtleCrypto` to decrypt file attachments entirely client-side:

```javascript
async function decryptFile(fileId, keyHex, ivHex) {
  // Fetch raw encrypted bytes from API
  const res  = await fetch(`${API_BASE}/api/files/raw/${fileId}`);
  const buf  = await res.arrayBuffer();
  const raw  = new Uint8Array(buf);

  // Server format: [authTag (16 bytes)][ciphertext]
  const authTag    = raw.slice(0, 16);
  const ciphertext = raw.slice(16);

  // SubtleCrypto wants: [ciphertext][authTag]
  const combined = new Uint8Array(ciphertext.length + 16);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  // Import the key
  const keyBytes  = hexToBytes(keyHex);
  const ivBytes   = hexToBytes(ivHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  );

  // Decrypt (GCM verifies authTag automatically — throws on tamper)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
    cryptoKey,
    combined
  );

  return new Uint8Array(plaintext);
}
```

After decryption, MIME type detection reads the first few bytes (magic bytes) to determine file type, then either renders the content (`<img>`, `<audio>`, `<video>`) or triggers a download via `URL.createObjectURL(new Blob([plaintext]))`.

---

### OpenPGP.js Lazy Loading

OpenPGP.js is approximately 300KB gzipped. It is only needed when the recipient has set a PGP public key. Loading it unconditionally on every canvas page load would add 300KB to a page that most senders will never use PGP with.

The solution: dynamic `import()`:

```javascript
async function doSend() {
  let body = messageArea.value;

  if (profilePgpKey) {
    // Only now load OpenPGP.js — ~300KB, deferred until needed
    const openpgp   = await import('https://esm.sh/openpgp@5');
    const publicKey = await openpgp.readKey({ armoredKey: profilePgpKey });
    const message   = await openpgp.createMessage({ text: body });
    body            = await openpgp.encrypt({ message, encryptionKeys: publicKey });
  }

  await fetch(`${API_BASE}/api/send`, {
    method: 'POST',
    body: JSON.stringify({ body, /* ... */ })
  });
}
```

The `import()` call resolves only when `doSend()` is called with a PGP key present. `esm.sh` transforms the `openpgp` npm package to native ESM on-the-fly, so no bundler or build step is needed. The browser caches the module after the first load.

---

## Deep-dive: Infrastructure

### Fly.io

Fly.io deploys Docker images to Firecracker microVMs — lightweight VMs (not containers) with millisecond startup times, running on Fly.io's global hardware. Traffic is routed via Anycast — the same IP address resolves to the nearest Fly.io edge, which proxies to the nearest VM running your app.

**Persistent volumes:** The SQLite database and `.enc` file attachments live on a Fly.io persistent volume mounted at `/data`. Volumes persist across app restarts and deploys — they're block devices attached to the physical host and remounted each time the VM starts. The free tier provides 3 GB per volume.

**Why cdg (Paris):** The `fly.toml` specifies `primary_region = 'cdg'` (Charles de Gaulle). This is the Fly.io region with lowest latency for a predominantly European user base. Fly.io will start additional VMs in other regions if needed for scale, but the primary region is where the volume lives — SQLite can't be distributed across regions without more complex replication.

**`--remote-only` flag:** `flyctl deploy --remote-only` builds the Docker image on Fly.io's remote builders rather than locally. The developer's machine may be running on Apple Silicon (arm64), while Fly.io VMs run amd64. Building locally would produce an arm64 image that fails to run on Fly.io's VMs. `--remote-only` guarantees the build runs on amd64 hardware. It's slower but always produces the correct architecture.

**Health checks:** `fly.toml` configures a health check that hits `GET /health` every 30 seconds. The `/health` route returns:

```json
{
  "status": "ok",
  "version": "4.3.0",
  "uptime": 3842
}
```

If `/health` returns non-2xx or times out, Fly.io marks the machine unhealthy and replaces it. This is the mechanism that enables zero-downtime deploys: the new machine must pass its health check before traffic is shifted away from the old one.

**The CNAME trap:** Fly.io app names are globally unique. If you rename an app (or delete and recreate it), the old `*.fly.dev` hostname disappears instantly. Any DNS CNAME record pointing to the old hostname returns `NXDOMAIN`. The previous project iteration was called `howlr-api` — `api.hollr.to` had a CNAME to `howlr-api.fly.dev`. When the app was recreated as `hollr-api`, the CNAME broke silently — `hollr-api.fly.dev` returned 200, but `api.hollr.to` returned DNS errors because the old CNAME target no longer existed. The fix was to update the CNAME to `hollr-api.fly.dev`. Lesson: whenever you change an app name or recreate an app on Fly.io, immediately audit all CNAME records pointing to that app.

---

### SiteGround FTP Deployment

The frontend deploys via `lftp`, a command-line FTP client:

```bash
lftp -e "
  set ftp:ssl-allow no;
  set net:timeout 30;
  open -u USERNAME,PASSWORD ftp.siteground.com;
  mirror --reverse --delete ./dist/ /public_html/;
  bye
"
```

**`mirror --reverse --delete`:** `--reverse` means local-to-remote (not the default remote-to-local). `--delete` removes remote files that don't exist in the local source. Together, these make the remote an exact mirror of the local `dist/` directory. Files deleted locally are deleted remotely; new files appear remotely.

**`set ftp:ssl-allow no`:** SiteGround's FTP server sometimes fails TLS negotiation in ways that cause lftp to hang indefinitely rather than error and fail cleanly. Disabling TLS negotiation on plain FTP avoids this. For SFTP/FTPS (where TLS is the whole point), this wouldn't be appropriate — but for plain FTP where TLS is opportunistic, it's the pragmatic choice.

**`set net:timeout 30`:** Without a timeout, lftp will wait indefinitely for a connection or transfer that's stalled. 30 seconds is generous enough for a slow connection, short enough to fail fast when the server is unreachable.

**Why FTP over SSH/rsync:** SiteGround shared hosting does not provide SSH access by default. Rsync requires SSH. FTP is the only file transfer protocol available on shared hosting tiers without upgrading to a VPS plan. lftp with `mirror` is the closest approximation of rsync's behavior available over FTP.

---

### Resend

Resend is the transactional email provider. hollr calls the Resend REST API directly from `mailer.js` using Node's built-in `https.request()`.

**Why Resend over SendGrid or Mailgun:** Resend has a simpler REST API, a more developer-friendly dashboard, and a generous free tier (100 emails/day, 3,000/month at time of writing). SendGrid and Mailgun have more features that hollr doesn't need, and more complex API authentication. Resend's single-key authentication model (`Authorization: Bearer re_...`) maps naturally to a single environment variable.

**Domain verification:** Resend requires you to prove you control the sending domain. You add DNS records:
- TXT record: `_domainkey.resend.hollr.to` → DKIM public key (provided by Resend)
- CNAME record: `resend._domainkey.hollr.to` → Resend's DKIM verifier

Without these records, emails from `*@hollr.to` via Resend will fail domain authentication and likely land in spam. Resend's dashboard shows verification status in real time after DNS propagation.

**The `from` must be verified:** Sending from an unverified domain returns HTTP 422 from the Resend API. The error is not always obvious — it looks like a validation error, not a permissions error. If `POST /api/send` starts returning 422 errors, check that the Resend sender domain is verified in the Resend dashboard.

**Why not the `@resend/node` SDK:** The SDK adds a dependency and its transitive tree. The entire Resend integration is a single POST request:

```javascript
const payload = JSON.stringify({
  from: resendFrom,
  to: [notificationEmail],
  subject: 'New hollr message',
  html: emailBody
});

https.request({
  hostname: 'api.resend.com',
  path: '/emails',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${resendApiKey}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, handleResponse).end(payload);
```

This is 20 lines. The SDK would be 3 lines but would bring `axios` or `node-fetch` along with it. The `https` module is in Node's standard library — no version drift, no vulnerability alerts, no `npm audit` noise.

---

## Deep-dive: Security Decisions

### CSRF

hollr does not use CSRF tokens for the API, for three reasons:

1. **Magic links are the primary auth mechanism.** Traditional CSRF attacks exploit the fact that browsers automatically attach cookies to cross-origin requests. Magic links produce a session token that is stored in `sessionStorage` and sent as a Bearer token in the `Authorization` header — not as a cookie. Browsers never automatically attach `Authorization` headers to cross-origin requests. There is no CSRF vector.

2. **X OAuth uses the `state` parameter.** The OAuth `state` parameter is the standard CSRF protection mechanism for OAuth flows (RFC 6749 §10.12). The server generates a random state, stores it in the express-session, and verifies it in the callback. A CSRF attacker cannot forge a valid state value because they don't have access to the victim's session.

3. **The API is CORS-protected.** CORS restricts which origins can make credentialed requests to the API. A malicious page on `evil.com` cannot make an authenticated request to `hollr-api.fly.dev` because the CORS policy rejects `evil.com` as an origin. Combined with Bearer token auth (not cookie auth), the CSRF attack surface is effectively nil.

---

### Password-Free Design

No passwords are stored anywhere in the hollr database. This eliminates the most common source of credential compromise: the password hash database leak. There is no password to guess, no credential to stuff from other breached databases, no "forgot password" flow that creates a secondary attack surface.

Magic links expire in 15 minutes and are single-use. A stolen magic link is worthless after it's been clicked. Even if an attacker intercepted the link in transit (e.g., via a compromised email account), the attack window is 15 minutes and closes the moment the legitimate user clicks the link.

PINs are the closest thing to a password in the system, but they gate the settings screen only — not account access. An attacker who learns a user's PIN cannot log in or read messages. They can only change settings (notification email, PGP key, Resend credentials). PINs are 4–8 digits, bcrypt-hashed, and protected by the rate limiter on the auth endpoints. Resetting a forgotten PIN requires a magic link, tying PIN recovery to email inbox access.

---

### Content Security (XSS Prevention)

All user-generated content that appears in HTML email templates is escaped through an `esc()` function:

```javascript
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

This prevents a sender from embedding `<script>` tags or `<img onerror>` payloads in message bodies that would execute in the recipient's email client. Email clients vary widely in their HTML sanitization — some render arbitrary HTML. Escaping is the defense-in-depth measure that works regardless of the email client's behavior.

---

### Helmet.js

`helmet()` sets security response headers with sane defaults:

- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking (the app's own iframes are allowed)
- `Referrer-Policy: no-referrer` — outbound links don't leak the current URL
- `X-DNS-Prefetch-Control: off` — prevents browsers from prefetching DNS for external links

**CSP is disabled:** `contentSecurityPolicy: false` is passed to helmet. A strict Content-Security-Policy would block loading OpenPGP.js from `esm.sh` (`script-src 'self'` would reject it), block inline scripts on the static frontend (used for the no-flash theme loader), and block inline styles. Supporting CSP would require either: (a) adding a build step to generate nonces, (b) self-hosting OpenPGP.js (adding a deploy step), or (c) using `unsafe-inline` and `unsafe-eval` which defeats most of CSP's value. The trade-off was acknowledged: CSP is disabled in favor of maintaining the no-build-step architecture.

---

### Email Enumeration Prevention

`POST /api/auth/forgot-pin` returns `{ ok: true }` unconditionally:

```javascript
router.post('/forgot-pin', authLimiter, async (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // Always return ok — never reveal whether email exists
  if (user && user.notification_email) {
    await sendPinResetEmail(user);  // fire and forget
  }

  return res.json({ ok: true });
});
```

If the response differed based on whether the email exists, an attacker could POST arbitrary email addresses and use the response to build a list of registered users. This is the email enumeration attack. Returning the same response for both cases closes the channel. The email is sent (or not sent) asynchronously in a fire-and-forget call — the HTTP response doesn't wait for it, which also prevents timing-based enumeration (a slightly longer response time when the email exists would be measurable).

---

## Versioning Guideline

> **⚠️ PERMANENT PROJECT RULE — apply on every commit that changes behaviour**

```
┌─────────────────────────────────────────────────────────────────────┐
│                   HOLLR VERSIONING PROTOCOL                         │
│                                                                     │
│  On every commit that changes observable behaviour:                 │
│                                                                     │
│  1. Bump version in package.json (semver: major.minor.patch)        │
│  2. Update version string in server.js                              │
│       - /health endpoint response                                   │
│       - startup log line                                            │
│       - file header comment                                         │
│  3. Update version headers in db.js, crypto.js, mailer.js          │
│  4. Add [x.y.z] — YYYY-MM-DD entry to CHANGELOG.md                 │
│       Use Keep a Changelog sections: Added/Changed/Fixed/Security   │
│  5. Update README badge (version shield URL)                        │
│  6. Commit message format:                                          │
│       feat: description (v4.4.0)                                    │
│       fix:  description (v4.3.1)                                    │
│  7. Create GitHub release tag vX.Y.Z                                │
│                                                                     │
│  Semver rules:                                                       │
│    PATCH: bug fix, copy change, internal refactor                   │
│    MINOR: new feature, new endpoint, backwards-compatible change    │
│    MAJOR: breaking change, auth model change, schema restructure    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Issues, Bottlenecks & Lessons Learned

### 🔴 `api.hollr.to` CNAME pointed to a destroyed app

**Symptom:** After recreating the Fly.io app with the correct name (`hollr-api` instead of `howlr-api`), the API at `hollr-api.fly.dev` returned 200, but `api.hollr.to` returned DNS resolution errors. Frontend requests failed with "network error" — no HTTP response at all.

**Root cause:** The CNAME record for `api.hollr.to` still pointed to `howlr-api.fly.dev` (the typo'd, now-deleted app name). Fly.io app hostnames are created when the app is created and destroyed when the app is deleted. `howlr-api.fly.dev` returned `NXDOMAIN`. The CNAME target doesn't exist, so the entire DNS chain fails.

**Fix:** Updated the CNAME to `hollr-api.fly.dev`. DNS propagation took ~5 minutes. API immediately became reachable.

**Lesson:** Whenever you rename or recreate a Fly.io app, audit every DNS record in every zone that has a CNAME pointing to a `*.fly.dev` hostname. Make this a checklist item on your deploy process. Tools like `dig CNAME api.hollr.to` can verify the target before you discover it's broken in production.

---

### 🔴 `howlr` directory name — workspace contamination

**Symptom:** After renaming the project from `howlr` to `hollr`, the local workspace still had a directory named `howlr/`. Git operations in the parent directory sometimes picked up files from the wrong directory. Grep searches for project files returned results from both directories. The wrong version of a file was deployed once.

**Root cause:** The original project was scaffolded as `howlr/` (a typo of "holler"). When the project was renamed, a new `hollr/` directory was created and files were copied over, but the old `howlr/` directory was not deleted. Both directories co-existed silently.

**Fix:** In v4.3.0, the `howlr/` directory was fully audited, confirmed to contain no unique content, and deleted. The workspace now contains only `hollr/`. All path references in scripts and deploy commands were updated.

**Lesson:** When renaming a project, do it atomically: rename the directory, update all references, commit, and confirm nothing references the old path. Don't copy-and-create — a leftover directory will cause confusion for months.

---

### 🔴 SQLite startup crash — index before column

**Symptom:** After adding X OAuth support (v4.0.0), the server crashed on startup with `SqliteError: no such column: x_id`. The stack trace pointed to the `CREATE INDEX` statement, not the `ALTER TABLE` statement.

**Root cause:** The startup initialization code was structured as:

```javascript
// Create tables (fine — they already existed)
db.prepare('CREATE TABLE IF NOT EXISTS users (...)').run();

// Create indexes (CRASH — x_id doesn't exist yet)
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_x_id ON users(x_id)').run();

// Run migrations (too late — index creation already failed)
for (const sql of migrations) { /* ALTER TABLE ... ADD COLUMN x_id */ }
```

The migration that adds the `x_id` column was scheduled after the index creation. On a fresh deploy against an existing database (one created before `x_id` was added), the column didn't exist when the index creation was attempted.

**Fix:** Reordered initialization: run all ALTER TABLE migrations first, then create indexes. On a fresh database, `CREATE TABLE` includes `x_id` in the initial schema. On an existing database, the migration adds `x_id` before the index needs it.

**Lesson:** Always run all schema migrations before running any DDL that depends on migrated columns. Treat migration order as a hard constraint, not a convention.

---

### 🔴 `reply_to: null` causes Resend 422

**Symptom:** Email sending started failing with HTTP 422 from Resend. The error body said "Invalid reply_to address". This started happening after adding optional Resend configuration — when a user had no reply-to address set, the code sent `reply_to: null` in the JSON payload.

**Root cause:** Resend's API treats `reply_to: null` as an invalid address, not as "omit this field." The JSON serialization of `{ reply_to: null }` sends the key with a null value, which Resend validates as an address and rejects.

**Fix:** Conditionally include `reply_to` in the payload:

```javascript
const payload = {
  from: resendFrom,
  to: [notificationEmail],
  subject: subject,
  html: html,
  ...(replyTo ? { reply_to: replyTo } : {})
};
```

The spread of an empty object is a no-op, so the key is omitted entirely when there's no reply-to.

**Lesson:** When constructing API payloads with optional fields, omit the key entirely rather than passing null. Many APIs distinguish between "key absent" and "key present with null value" in their validation logic. Use conditional spread (`...(condition ? { key: val } : {})`) to conditionally include fields.

---

### 🔴 AES-GCM authTag placement mismatch

**Symptom:** The in-browser decrypt viewer threw `DOMException: The operation failed for an operation-specific reason` on every decryption attempt. Node-side encryption appeared to work correctly (the `.enc` files had the right size), but the browser consistently failed to decrypt.

**Root cause:** Node's `crypto` module provides the GCM authentication tag separately via `cipher.getAuthTag()` after finalization. The file was written as `[authTag][ciphertext]`. SubtleCrypto's `decrypt()` expects the buffer to be `[ciphertext][authTag]` — tag at the end, not the beginning. Passing the data in the wrong order caused GCM authentication to fail, which manifests as a DOMException.

**Fix:** The browser decrypt code reads the raw bytes, splits them at byte 16 (authTag length), and re-combines them in SubtleCrypto's expected order before decryption. See the [In-Browser Decrypt Flow](#in-browser-decrypt-flow) section for the full code.

**Lesson:** AES-GCM has two correct wire formats depending on the implementor: tag-first (common in low-level APIs like OpenSSL/Node) and tag-last (Web Crypto API). When crossing the Node ↔ Browser boundary, always explicitly re-order. Document the expected format in code comments.

---

### 🟡 `better-sqlite3` async confusion

**Symptom:** Routes that used `better-sqlite3` produced strange results: `await db.prepare(sql)` returned the Statement object immediately (correct — it's synchronous), but other code written as `const [row] = db.select(...)` threw `TypeError: db.select is not a function`.

**Root cause:** `better-sqlite3` is a synchronous API. There is no `db.select()` method. The correct methods are `stmt.all()` (returns array), `stmt.get()` (returns first row or undefined), and `stmt.run()` (returns `{ changes, lastInsertRowid }`). Code written by developers accustomed to async libraries (like `pg` or the async `sqlite3` package) tends to reach for `await` and non-existent method names.

**Fix:** Code review pass to normalize all database calls to the correct `better-sqlite3` API:

```javascript
// Wrong
const rows = await db.select('SELECT * FROM users WHERE email = ?', email);

// Correct
const rows = db.prepare('SELECT * FROM users WHERE email = ?').all(email);
const row  = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
```

**Lesson:** `better-sqlite3` is synchronous by design. Never `await` it. If you're adding code from another project or from AI suggestions, double-check that the API calls match `better-sqlite3`'s synchronous interface, not the async `sqlite3` package.

---

### 🟡 PGP tab invisible — tab switcher bug

**Symptom:** In the settings modal, the PGP key input field was never visible. Clicking the "PGP" tab label did nothing — the tab appeared to be selected (styling changed) but no content appeared.

**Root cause:** The tab switcher JavaScript toggled visibility for `tab-key` and `tab-pin` panels. The `tab-pgp` panel was added in a later iteration but the switcher was not updated to include it. The `data-tab="pgp"` attribute on the PGP tab button had no corresponding case in the switch statement.

**Fix:** Added the `tab-pgp` panel to the tab switcher:

```javascript
function showTab(name) {
  ['key', 'pin', 'pgp', 'resend'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display =
      t === name ? 'block' : 'none';
  });
}
```

**Lesson:** When adding a new tab (or any enumerated UI element) to an existing switcher, update the switcher's list of known elements at the same time. A lint rule or a data-driven tab system (where the switcher reads tab names from the DOM) would prevent this class of bug entirely.

---

### 🟡 PKCE `code_verifier` in browser — OAuth callback failure

**Symptom:** The X OAuth callback returned 401 from Twitter's token exchange endpoint. The `code_verifier` sent in the token exchange request didn't match what Twitter expected. Intermittently, some users could authenticate successfully while others couldn't.

**Root cause:** An early implementation stored the `code_verifier` in `sessionStorage` on the frontend. The callback (`/api/auth/x/callback`) is a backend route — the backend cannot read the browser's `sessionStorage`. The backend was retrieving the verifier from somewhere else (a query param or a request body field that wasn't being sent), getting `undefined`, and sending an invalid verifier to Twitter.

**Fix:** Store both `code_verifier` and `state` in `express-session` (server-side session storage, keyed by the session cookie):

```javascript
// In GET /api/auth/x:
req.session.pkce = { code_verifier, state };

// In GET /api/auth/x/callback:
const { code_verifier, state } = req.session.pkce || {};
```

**Lesson:** The OAuth callback route runs on the backend. Any data that must survive the redirect-to-Twitter-and-back round trip must be stored where the backend can access it: in the server-side session. Never store OAuth flow state client-side.

---

### 🟡 Resend API key leaked to git

**Symptom:** GitGuardian sent an email alert within minutes of pushing to GitHub: "Secret detected in commit abc123: Resend API key." The key (`re_...`) was visible in the commit history even after deleting the `.env` file.

**Root cause:** The `.env` file containing live API keys was committed to the repository. Git stores the full history — even if you delete a file and commit the deletion, the original content is still in the history and visible to anyone with access to the repository.

**Fix:**
1. Immediately rotated the Resend API key (new key generated in the Resend dashboard, old key invalidated)
2. Used `git-filter-repo` to rewrite history, removing the `.env` file from all commits:
   ```bash
   git filter-repo --path .env --invert-paths
   git push --force
   ```
3. Added `.env` to `.gitignore`
4. Updated `INSTALL.md` to use `.env.example` with placeholder values

**Lesson:** Add `.env` to `.gitignore` before writing any secrets to it. Use `.env.example` with dummy values as documentation. Once a secret is in git history, treat it as compromised and rotate it immediately — history rewrites don't guarantee the secret hasn't been copied or scanned.

---

### 🟡 `flyctl not found` on first deploy

**Symptom:** After installing flyctl with the official install script, running `flyctl deploy` produced `command not found: flyctl`. The install script completed without errors.

**Root cause:** The flyctl install script downloads the binary to `~/.fly/bin/flyctl` and prints instructions to add this directory to `PATH`. The current shell session's `PATH` doesn't include `~/.fly/bin` until the shell is restarted or the profile is sourced.

**Fix:** Either restart the terminal session, or run `source ~/.bashrc` (or `~/.zshrc`), or call the binary with its full path: `~/.fly/bin/flyctl deploy`.

**Lesson:** After installing a CLI tool that modifies `PATH`, always restart your shell session or source your profile before expecting the tool to be available. If a CI/CD script installs flyctl and immediately calls it, it must either source the profile or use the absolute path.

---

### 🟢 `sessionStorage` vs `localStorage` — iframe isolation

**Symptom:** (Prospective — caught during architecture review, not a production incident.) The canvas page is designed to be embeddable as an iframe. If the auth token were stored in `localStorage`, an iframe on `hollr.to` would share storage with the parent `hollr.to` page, potentially exposing the host's session token to the canvas's JavaScript context.

**Root cause:** `localStorage` is shared across all windows and iframes at the same origin. If both the parent page and the iframe are on `hollr.to`, they share `localStorage`. An embedded canvas (iframe) could read `localStorage['hollr-token']` and impersonate the logged-in user.

**Fix:** Auth tokens are stored in `sessionStorage`. `sessionStorage` is scoped to the browsing context (tab/iframe). Each iframe has its own isolated `sessionStorage` — it cannot read the parent's `sessionStorage` and vice versa.

**Lesson:** For auth tokens, `sessionStorage` is almost always the better choice over `localStorage`. Tab-scoped lifetime is the correct security model for session credentials. The only time `localStorage` is appropriate for auth is if you explicitly want persistent sessions across browser restarts (and you've accepted the security implications).

---

### 🟢 multer `memoryStorage` — encrypt before write

**Symptom:** (Prospective — caught during design.) Using multer's default disk storage would write uploaded files to the `/tmp` directory as plaintext before encryption. An attacker with read access to `/tmp` (or a directory traversal bug elsewhere in the app) could read plaintext file contents before they're encrypted.

**Root cause:** multer's disk storage creates a temporary file on disk during the upload pipeline, before any application code runs. The file is in plaintext. Encryption happens after multer is done — by which point the plaintext file already exists on disk.

**Fix:** Use `multer.memoryStorage()`. The uploaded bytes are held in `req.file.buffer` (in-process memory) and never written to disk as plaintext. The encrypt function receives the buffer, encrypts it, and writes only the `.enc` output to the persistent volume.

**Lesson:** In an encrypt-before-write pipeline, the encryption step must happen before any disk write — not after. Always use memory storage for file uploads that will be encrypted. The memory cost is bounded by `multer`'s `limits.fileSize` configuration.

---

### 🟢 URL hash params for decrypt keys

**Symptom:** (Design decision — included here as a positive lesson.) The question was: where to store the per-file encryption key so that the server can't see it but the browser can use it for decryption?

**Root cause (of the design challenge):** If the key is stored server-side, the server can decrypt files. If the key is in the URL path or query string, it's sent to the server in the HTTP request and appears in access logs. The key must reach the browser without the server seeing it.

**Fix:** Store the key in the URL fragment (`#key=...`). RFC 3986 §3.5 specifies that the fragment is processed by the browser only — it is not sent to the server in HTTP requests. This is guaranteed by the spec and implemented correctly in every browser. The key never appears in server access logs.

**Lesson:** The URL fragment is not just for anchor navigation — it's a client-side-only data channel built into the URI spec. Services like Mega, Bitwarden Send, and Firefox Send use exactly this mechanism for end-to-end encryption in the browser without a build step or backend involvement.

---

### 🟢 `COALESCE(email, ?)` — preserve existing email on upsert

**Symptom:** After an X OAuth login for a user who had previously set their email address, the email was being cleared. The upsert that updated the user record on login was overwriting the email with `NULL`.

**Root cause:** The upsert query on X OAuth callback was:

```sql
INSERT INTO users (x_id, x_username, handle, email)
VALUES (?, ?, ?, NULL)
ON CONFLICT(x_id) DO UPDATE SET
  x_username = excluded.x_username,
  email = excluded.email  -- This sets email to NULL
```

The Twitter API doesn't return email. The upsert passed `NULL` for email and the conflict update applied it, overwriting the stored email.

**Fix:** Use `COALESCE` to preserve the existing value when the new value is NULL:

```sql
ON CONFLICT(x_id) DO UPDATE SET
  x_username = excluded.x_username,
  email = COALESCE(excluded.email, users.email)
```

`COALESCE` returns the first non-null argument. If `excluded.email` is NULL, it falls back to `users.email` (the existing value). If `excluded.email` has a value, it takes precedence.

**Lesson:** Upsert queries that might receive NULL for a field that already has a value should use `COALESCE` to preserve the existing data. Write the null-handling logic into the SQL, not into the application layer where it's easier to forget.

---

## Contributing

Contributions are welcome. This is an open-source project under the MIT license — fork it, adapt it for your own use case, and submit pull requests for bugs or improvements.

**Pull request guidelines:**
- Follow the versioning protocol above (bump version, update CHANGELOG)
- Keep the no-build-step constraint for the frontend (no bundlers, no transpilers)
- Match the existing code style (no Prettier/ESLint config — just be consistent)
- Include a description of the change and why it was made
- Test against a local SQLite database before submitting

**Reporting issues:** Open a GitHub issue with the symptom, the environment (OS, Node version, browser), and steps to reproduce. Include the server log output if relevant.

---

## License

MIT License

Copyright (c) 2026 Paul Fleury

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
