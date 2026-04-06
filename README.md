# 📢 hollr

[![Version](https://img.shields.io/badge/version-5.2.0-1a1814?style=flat-square&logo=github)](https://github.com/paulfxyz/hollr/releases/tag/v5.2.0)
[![License: MIT](https://img.shields.io/badge/license-MIT-c96a2a?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003b57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Deployed on Fly.io](https://img.shields.io/badge/Fly.io-deployed-7c3aed?style=flat-square)](https://fly.io)
[![Open Source](https://img.shields.io/badge/open_source-MIT-f9f6f1?style=flat-square)](https://github.com/paulfxyz/hollr)
[![Vibe Coded](https://img.shields.io/badge/vibe_coded-100%25-c96a2a?style=flat-square)](https://github.com/paulfxyz/hollr)

> **Live:** [hollr.to](https://hollr.to) · **Example canvas:** [hollr.to/paulfxyz](https://hollr.to/paulfxyz) · **API health:** [hollr-api.fly.dev/health](https://hollr-api.fly.dev/health)

---

## What is hollr?

**hollr** is a personal encrypted message canvas. Claim `hollr.to/yourname`, share the link, and anyone can write you a thoughtful message — no account required, no DMs, no algorithm deciding whether you see it.

The sender gets a timed, distraction-free writing space. The clock only runs while they type, so every second on the timer is a second actually spent composing. Messages arrive in your inbox, optionally PGP-encrypted end-to-end so not even hollr's servers can read them. Files and voice recordings are encrypted with AES-256-GCM before they touch disk. Resend API key optional — the platform delivers from `yo@hollr.to` by default.

The project is deliberately free of framework overhead: Node.js + Express + SQLite on the backend, static HTML/CSS/JS on the frontend. No build step. No bundler. No ORM. Deployed to Fly.io (backend) and SiteGround via FTP (frontend). The entire codebase is MIT-licensed, self-hostable, and documented in this README at a level where you can understand every decision.

---

## Table of Contents

1. [The product](#the-product)
2. [Feature list](#feature-list)
3. [Architecture](#architecture)
4. [Onboarding flow](#onboarding-flow)
5. [Deep-dive: Authentication](#deep-dive-authentication)
6. [Deep-dive: Encryption](#deep-dive-encryption)
7. [Deep-dive: Database design](#deep-dive-database-design)
8. [Deep-dive: The HTTP API](#deep-dive-the-http-api)
9. [Deep-dive: Frontend architecture](#deep-dive-frontend-architecture)
10. [Deep-dive: Infrastructure](#deep-dive-infrastructure)
11. [Deep-dive: Security decisions](#deep-dive-security-decisions)
12. [API reference](#api-reference)
13. [Environment variables](#environment-variables)
14. [Versioning guideline](#versioning-guideline)
15. [Roadmap](#roadmap)
16. [Issues, bottlenecks & lessons learned](#issues-bottlenecks--lessons-learned)
17. [Self-hosting](#self-hosting)
18. [Contributing](#contributing)
19. [License](#license)
20. [A note on vibe coding](#a-note-on-vibe-coding)

---

## The product

hollr started as a personal contact form and grew into a small SaaS platform in the span of a few days. Here is what it does, from the perspective of the two people involved in any hollr interaction.

**As a handle owner (you):**
1. Sign in with X (Twitter) OAuth or a magic-link email — no password ever.
2. Pick `hollr.to/yourname` — permanent, first-come first-served.
3. Add a notification email so messages reach your inbox.
4. Optionally: paste your PGP public key so messages are end-to-end encrypted from the sender's browser. Add a Resend key and verified domain for custom delivery. That's it.
5. Share `hollr.to/yourname` everywhere — bio, email footer, business card.

**As a sender:**
1. Visit `hollr.to/someone`.
2. Click Start — the timer begins. It only runs while you type.
3. Write. Attach a file or record a voice note if you want.
4. Hit Send. Drop your name and how they can reach you back.
5. Done. Your message, voice note, or files land in their inbox, encrypted.

No account. No login. No app. Just a link and a canvas.

---

## Feature list

| | Feature | Detail |
|---|---|---|
| 𝕏 | **X OAuth 2.0 PKCE** | One-click sign-in with Twitter/X. PKCE code verifier lives server-side in express-session — not the browser. |
| 📬 | **Magic-link email auth** | No passwords. Enter email → click link → you're in. Tokens are UUID v4, 15-min TTL, single-use. |
| 🔐 | **PGP end-to-end encryption** | Paste your OpenPGP public key in Settings. Senders encrypt in-browser via OpenPGP.js v5 (lazy-loaded from esm.sh). You decrypt offline. |
| 🔒 | **AES-256-GCM file & voice encryption** | Every upload encrypted with a fresh 32-byte key + 12-byte IV server-side before touching disk. Key/IV returned in the email as URL hash params. |
| 🌐 | **In-browser decrypt viewer** | `/decrypt` page — Web Crypto API (`SubtleCrypto.decrypt`). Key never leaves the URL hash, never sent to server. |
| ⏱️ | **Timed writing canvas** | Timer runs only while typing. Idle time doesn't count. Makes senders think before they holler. |
| 🎤 | **Voice recording** | Record in-browser via MediaRecorder API. Encrypted, uploaded, linked in notification email. |
| 📎 | **File attachments** | Drag-and-drop any file. Encrypted with AES-256-GCM. Decrypt viewer linked in email. |
| 📧 | **Optional Resend integration** | Platform sends from `yo@hollr.to` by default. Plug in your Resend key + verified domain for custom delivery. |
| ✏️ | **Display name** | Set a name that appears as "Message to [Name]" on your canvas. Updates live — no page reload. |
| 🌍 | **10 languages** | EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. Auto-detected from browser. Persisted in `localStorage`. |
| 🌙 | **Dark / light mode** | CSS custom properties. No-flash inline script reads preference before first paint. |
| 🛡️ | **PIN-protected settings** | 4–8 digit PIN, bcrypt cost 12. Default 1234 forced-change on first settings open. |
| 🔑 | **Forgot PIN** | Magic link resets PIN to 1234 and flags `pin_is_default`, forcing change on next settings open. |
| 🧩 | **3-step onboarding wizard** | Handle → PIN (confirmed, no defaults) → Display name + notification email. Single API call on finish. |
| 🛠️ | **MIT open source** | Fork it, self-host on Fly.io, extend it. No vendor lock-in. |

---

## Architecture

```
╔══════════════════════════════════════╗        ╔══════════════════════════════════╗
║        hollr.to (SiteGround)         ║        ║  hollr-api.fly.dev (Fly.io)      ║
║  Apache · static HTML/CSS/JS · FTP   ║        ║  Node.js 20 · Express 4          ║
║                                      ║        ║  SQLite (WAL) · /data/hollr.db   ║
║  /                → index.html       ║◄──────►║  Persistent volume: 3 GB         ║
║  /auth/verify     → auth page        ║  REST  ║  Region: cdg (Paris)             ║
║  /decrypt         → decrypt viewer   ║        ╚══════════════════════════════════╝
║  /:handle         → canvas           ║                    │          │
╚══════════════════════════════════════╝            ┌───────┘          └────────┐
                                               ┌────▼──────┐           ┌───────▼──────┐
                                               │  Resend   │           │  X (Twitter)  │
                                               │  REST API │           │  OAuth 2.0    │
                                               │  emails   │           │  PKCE         │
                                               └───────────┘           └──────────────┘
```

### Request flow (complete trace)

```
Browser                         SiteGround (Apache)          hollr-api.fly.dev
  │                                     │                            │
  │── GET hollr.to/paulfxyz ──────────► │                            │
  │                    .htaccess routes │                            │
  │◄── handle/index.html ───────────── │                            │
  │                                     │                            │
  │── GET /api/profile/paulfxyz ────────────────────────────────── ►│
  │                                                    SELECT users  │
  │◄── { handle, display_name, pgp_public_key } ───────────────────│
  │                                     │                            │
  │  [sender writes, optionally PGP-encrypts in browser]            │
  │                                     │                            │
  │── POST /api/upload/paulfxyz ────────────────────────────────── ►│
  │                              multer memoryStorage                │
  │                              encryptBuffer(AES-256-GCM)         │
  │                              write .enc to /data/uploads/        │
  │◄── { url, file_key, file_iv, name } ──────────────────────────│
  │                                     │                            │
  │── POST /api/send/paulfxyz ─────────────────────────────────── ►│
  │                              validate, store in messages table   │
  │                              pick Resend key (user or platform)  │
  │                              forwardMessage() → Resend REST API  │
  │◄── { ok: true } ──────────────────────────────────────────────│
```

### Auth state machine

```
Landing modal
      │
      ├── "Continue with X" ──────────────────────────────────────────────────────┐
      │                                                                            │
      └── "Register with email" → POST /api/auth/magic-link                       │
              (handle stored in magic_links.pending_handle)                        │
                    │                                                              │
                    ▼                                                              ▼
             Email arrives                                          GET /api/auth/x (PKCE)
                    │                                                        │
                    ▼                                              X OAuth callback
           GET /api/auth/verify/:token                                       │
                    │                                              POST /api/auth/x/callback
                    ├── returning user with handle ──────────────────────────┤
                    │        └── redirect /:handle                           │
                    │                                                        │
                    ├── new user ────────────────────────────────────────────┤
                    │        │                            needs_email=1?     │
                    │        │                            ────────────────── │
                    │        │                            stateNeedEmail      │
                    │        │                                  │             │
                    │        └────────────────── stateOnboarding ────────────┘
                    │                                   │
                    │              Step 1: Pick handle (live availability check)
                    │              Step 2: Set PIN (confirmed, rejects 1234)
                    │              Step 3: Display name + notification email
                    │                                   │
                    │              POST /api/handle/claim (one round-trip)
                    │                                   │
                    └───────────────────── /:handle?setup=1 (settings auto-opens)
```

### Encryption layers

| Data | Algorithm | Where |
|---|---|---|
| Resend API key | AES-256-CBC + PBKDF2-SHA256 (100k iterations, random salt per value) | SQLite `users.resend_key` as `"salt:iv:cipher"` hex |
| PIN | bcrypt (cost 12, built-in salt) | SQLite `users.pin_hash` |
| File / audio uploads | AES-256-GCM (random 32-byte key + 12-byte IV per file) | Fly.io persistent volume |
| Message body (optional) | OpenPGP (client-side, sender's browser, owner's public key) | SQLite `messages.body` |
| Magic link tokens | UUID v4 (cryptographically random) | SQLite `magic_links.token` |
| Session tokens | `crypto.randomBytes(32).toString('hex')` | SQLite `sessions.token` |

### Database schema

```sql
users
  id             INTEGER PK
  email          TEXT UNIQUE          -- notification address + magic-link login
  x_id           TEXT UNIQUE          -- Twitter/X numeric user ID
  x_username     TEXT                 -- @handle (display only)
  handle         TEXT UNIQUE NOCASE   -- public URL slug
  display_name   TEXT                 -- "Message to [name]" on canvas
  resend_key     TEXT                 -- AES-256-CBC encrypted Resend API key
  from_email     TEXT                 -- verified Resend sender address
  pin_hash       TEXT                 -- bcrypt(pin, 12)
  pin_is_default INTEGER DEFAULT 0    -- 1 if PIN is still "1234"
  pgp_public_key TEXT                 -- armoured OpenPGP public key

magic_links
  email          TEXT
  token          TEXT UNIQUE          -- UUID v4
  expires_at     INTEGER              -- Unix timestamp, 15-min TTL
  used           INTEGER DEFAULT 0    -- marked 1 immediately on click
  is_pin_reset   INTEGER DEFAULT 0    -- resets pin to 1234, forces change
  pending_handle TEXT                 -- pre-fills onboarding (survives new tab)

sessions
  user_id        INTEGER FK → users
  token          TEXT UNIQUE          -- 32-byte random hex, Bearer auth
  expires_at     INTEGER              -- 30-day TTL

messages
  handle         TEXT                 -- recipient
  sender         TEXT                 -- freeform contact field
  body           TEXT                 -- plaintext or PGP armoured block
  is_pgp         INTEGER DEFAULT 0
  file_urls      TEXT DEFAULT '[]'    -- JSON array
  audio_url      TEXT
  audio_encrypted INTEGER DEFAULT 0
```

---

## Onboarding flow

The registration experience is a 3-step wizard in `auth/verify.html`. The full flow from landing page to live canvas looks like this:

**Via email (new user):**
1. Landing modal → enter desired handle + email → "Sending magic link…"
2. Backend stores `{email, token, pending_handle}` in `magic_links` table.
3. Magic link arrives in inbox — user clicks it in their email client (new tab).
4. `GET /api/auth/verify/:token` returns `{ ok, session_token, pending_handle }`.
5. `pending_handle` pre-fills step 1 of the wizard — **this survives the new-tab context switch** because it came from the API response, not `sessionStorage`.
6. Step 1: confirm/change the handle. Live availability check fires at 450ms debounce — "Continue" button is blocked until confirmed available.
7. Step 2: choose a PIN (4–8 digits, confirmed, rejects `1234`). Dot-fill visualizer.
8. Step 3: display name (optional) + notification email (optional). Live preview of "Message to [name]".
9. Single `POST /api/handle/claim` — all data in one request.
10. Redirect to `/:handle?setup=1` → canvas opens with Settings modal auto-opened.

**Via X OAuth (new user):**
1. Landing modal → "Continue with X" → redirect to `GET /api/auth/x`.
2. Backend generates `code_verifier`, `code_challenge` (SHA-256 → base64url), `state`. Stored in `express-session`.
3. Redirect to `https://twitter.com/i/oauth2/authorize?...` with PKCE params.
4. X redirects back to `/api/auth/x/callback`. Backend validates `state` from session, exchanges code + verifier for tokens.
5. Fetch `/2/users/me` — get X numeric ID and username.
6. If no email on file: redirect to `auth/verify?x_session=TOKEN&needs_email=1`.
7. `stateNeedEmail` collects an email. Skippable (notifications disabled until set).
8. Same 3-step wizard, handle pre-filled with X username.

---

## Deep-dive: Authentication

### Magic links — why and how

**Why not passwords?** Because passwords have to be stored (even hashed, they're a target), users forget them, and they create support burden. Magic links expire in 15 minutes, work once, and require access to the user's email — which is a reasonable second factor on its own.

**Token generation:** `uuidv4()` — cryptographically random 36-character string. Stored in the `magic_links` table alongside the email, expiry timestamp (`unixepoch() + 900`), and a `used` flag.

**Single-use guarantee:** The first thing the verify endpoint does after finding a valid token is set `used = 1`. This is synchronous (better-sqlite3) so there's no race condition window where two simultaneous requests could both succeed.

**Pending handle survives new tabs:** Early versions stored the desired handle in `sessionStorage`. `sessionStorage` is tab-scoped — clicking a magic link in an email client opens a new tab with empty `sessionStorage`. The handle was lost. Fix: the handle is stored in the `magic_links.pending_handle` column (server-side) and returned in the verify response. The browser never needs to remember it.

**Email enumeration prevention:** `POST /api/auth/forgot-pin` always returns `{ ok: true }` even if the email doesn't exist. Attackers cannot use the endpoint to discover registered addresses.

**Platform emails:** All magic links are sent from `yo@hollr.to` via the platform Resend key. Users can add their own Resend key for message notifications — but magic links always go through the platform key to ensure deliverability.

### X OAuth 2.0 PKCE — full explanation

OAuth 2.0 with PKCE (Proof Key for Code Exchange, RFC 7636) protects the authorization code flow from interception attacks. Here's every step:

```
1. Client generates:
   code_verifier  = crypto.randomBytes(32).toString('base64url')  // 43+ chars
   code_challenge = base64url(SHA-256(code_verifier))

2. Store in express-session (server-side — NOT the browser):
   req.session.xState        = crypto.randomBytes(16).toString('hex')
   req.session.xCodeVerifier = code_verifier

3. Redirect to X authorize URL with:
   ?response_type=code
   &client_id=...
   &redirect_uri=https://hollr-api.fly.dev/api/auth/x/callback
   &scope=tweet.read users.read
   &state=<random>
   &code_challenge=<sha256_base64url>
   &code_challenge_method=S256

4. X redirects to callback with ?code=AUTH_CODE&state=STATE

5. Backend validates state === req.session.xState (CSRF check)

6. POST to https://api.twitter.com/2/oauth2/token:
   { code, code_verifier, grant_type: 'authorization_code', ... }
   X verifies that SHA-256(code_verifier) === code_challenge from step 3

7. Exchange succeeds → access token → GET /2/users/me
```

Why PKCE matters: if an attacker intercepts the authorization code (e.g. via a malicious redirect), they still need the `code_verifier` to exchange it. The verifier never leaves the server.

Why `express-session` and not the browser: the callback hits the backend URL, not the browser. `sessionStorage` and `localStorage` are inaccessible at `/api/auth/x/callback`. The session cookie bridges the gap.

---

## Deep-dive: Encryption

### AES-256-CBC — text secrets

Used for Resend API keys stored in the database. AES in CBC mode with PBKDF2 key derivation.

```
encrypt(plaintext):
  salt     = crypto.randomBytes(16)        // fresh per value
  key      = PBKDF2(ENCRYPTION_SECRET, salt, 100_000, 32, 'sha256')
  iv       = crypto.randomBytes(16)        // fresh per value
  cipher   = AES-256-CBC(key, iv)
  output   = "saltHex:ivHex:ciphertextHex"
```

**Why a salt per value?** PBKDF2 with a random salt means two identical plaintexts produce different ciphertexts. An attacker with the database dump cannot find duplicate keys by comparing ciphertext.

**Why 100,000 iterations?** OWASP 2023 minimum for PBKDF2-SHA256. On a modern CPU this takes ~10ms to compute — acceptable for a one-time operation, prohibitively slow for dictionary attacks.

**Wire format `"salt:iv:cipher"` as hex strings:** Safe to store in a TEXT column. No binary encoding issues. The three segments carry all information needed to decrypt.

**Rotation:** If `ENCRYPTION_SECRET` needs to change, decrypt every value with the old secret and re-encrypt with the new one, then swap the env var. There is no shortcut.

### AES-256-GCM — file and voice encryption

GCM (Galois/Counter Mode) provides authenticated encryption: confidentiality plus integrity in one pass. If any byte of the ciphertext is modified, decryption fails with an authentication error.

```
encryptBuffer(buffer):
  key      = crypto.randomBytes(32)   // 256-bit, unique per file
  iv       = crypto.randomBytes(12)   // 96-bit nonce (GCM recommendation)
  cipher   = AES-256-GCM(key, iv)
  authTag  = cipher.getAuthTag()      // 16 bytes (128-bit)
  on disk  = [authTag (16 bytes)][ciphertext]
  returns  → { keyHex, ivHex }        // embedded in notification email
```

**Why GCM?** CBC gives you confidentiality but not integrity — an attacker could flip bits. GCM's auth tag detects any tampering. Also: GCM is natively supported by the Web Crypto API (`SubtleCrypto`), enabling fully client-side decryption.

**Why tag-first on disk?** SubtleCrypto's `decrypt` expects `[ciphertext][authTag]` concatenated. Node's `crypto` API separates them. Storing the tag first (16 bytes, known length) means the decrypt viewer can slice `bytes.slice(0, 16)` and `bytes.slice(16)` deterministically, then re-concatenate in the order SubtleCrypto expects.

**Why key in URL hash?** `https://hollr.to/decrypt#url=...&key=...&iv=...` — the hash fragment (`#...`) is defined in RFC 3986 §3.5 as client-side only. Browsers do not include it in HTTP requests. The decrypt key never reaches any server during playback.

**Per-file key:** Every upload gets its own fresh 256-bit key. Compromising one file's key (if someone forwards the decrypt email) reveals nothing about any other file.

### bcrypt — PINs

PINs are 4–8 digit numbers used to gate the settings modal. They are not used for account access, so they don't need to be recoverable — only resettable via magic link.

```
bcrypt(pin, cost=12)
```

Cost 12 means ~250ms to hash on modern hardware. Fast enough to be invisible to the user, slow enough to make brute-forcing 10,000 PIN combinations (the full 4-digit space) take ~40 minutes per attempt — and that's against the hash, which requires the database.

PINs that are still the default `1234` are flagged with `pin_is_default = 1`. The settings endpoint returns `{ error: 'must_change_pin' }` if this flag is set, forcing the user to the PIN tab before any other changes can be saved.

### PGP — OpenPGP.js client-side encryption

PGP is asymmetric: the sender uses the recipient's public key to encrypt, only the private key (which never leaves the recipient's device) can decrypt.

```javascript
// In the sender's browser, when the handle owner has a PGP key set:
const openpgp = await import('https://esm.sh/openpgp@5');
const publicKey = await openpgp.readKey({ armoredKey: profilePgpKey });
const encrypted = await openpgp.encrypt({
  message: await openpgp.createMessage({ text: messageBody }),
  encryptionKeys: publicKey,
});
// encrypted is an armoured PGP block — hollr's server never saw the plaintext
```

**Why client-side?** If the server encrypted, it would have to see the plaintext first. The entire point is that even hollr cannot read PGP-encrypted messages.

**Why esm.sh?** OpenPGP.js is a ~300KB library. Loading it lazily via `import('https://esm.sh/openpgp@5')` means it only downloads when the profile has a PGP key set. No build step, no bundler. esm.sh transforms npm packages to native ESM.

**Decrypt hint in email:** PGP-encrypted messages arrive as an armoured block with a GPG usage hint: `gpg --decrypt message.asc`. hollr never attempts server-side decryption.

---

## Deep-dive: Database design

### Why SQLite

The standard argument against SQLite for web apps is "what if you need horizontal scaling?" The counter-argument: hollr does not need horizontal scaling. It's a single-machine deployment on Fly.io. SQLite on a persistent volume is:

- **Zero operational overhead** — no connection pool, no separate process, no network roundtrip.
- **Trivially backed up** — one file. `cp hollr.db hollr.db.bak` is your backup strategy.
- **Faster than PostgreSQL for reads** — in-process, no serialization, no network.
- **WAL mode** — `PRAGMA journal_mode = WAL` enables concurrent reads alongside writes. The health check and web requests can run simultaneously without blocking each other.
- **better-sqlite3 is synchronous** — every query completes before the next line runs. No callbacks. No async/await. No accidental N+1 queries from forgetting to await a promise.

The synchronous API is actually the right choice for Node.js + SQLite: the query is in-process and typically completes in microseconds, so blocking the event loop for that duration is preferable to the overhead of async scheduling.

### The better-sqlite3 trap

The most common mistake with better-sqlite3 is treating it like an async ORM:

```javascript
// WRONG — db.select() returns the query builder, not a promise
const [user] = db.prepare('SELECT * FROM users WHERE id = ?');
await user; // returns the prepared statement

// CORRECT
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
// .get()  → one row or undefined
// .all()  → array (may be empty)
// .run()  → { changes, lastInsertRowid }
```

### Migration strategy

SQLite does not support `ALTER TABLE ... IF NOT EXISTS`. The runtime migration loop handles this:

```javascript
const migrations = [
  { table: 'users', col: 'x_id', def: 'TEXT' },
  // ... more columns
];
for (const { table, col, def } of migrations) {
  try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); }
  catch { /* column already exists — safe to ignore */ }
}
```

This runs on every startup. It's idempotent: if the column exists, the `ALTER TABLE` throws and the catch swallows it. No migration files. No migration state. No `up` and `down`. Every deploy is safe.

**The index ordering trap:** If you create an index on a column that doesn't exist yet, SQLite throws immediately — it doesn't defer the index creation. Any index on a migration-added column must be created *after* the migration loop.

### Pending handles

New users get a temporary `__pending_xxxxxxxx` handle immediately on account creation. This lets the session/user row exist in the database before onboarding completes. Every endpoint that exposes `handle` checks `handle.startsWith('__pending')` and returns `null` to the frontend.

### COLLATE NOCASE on handle

```sql
handle TEXT NOT NULL UNIQUE COLLATE NOCASE
```

This enforces case-insensitive uniqueness at the database level. `PaulFxyz` and `paulfxyz` are treated as the same handle. Without `COLLATE NOCASE`, two users could claim what appear to be identical handles differing only in case.

---

## Deep-dive: The HTTP API

### Middleware stack (order matters)

```javascript
app.set('trust proxy', 1);        // 1. Trust Fly.io's reverse proxy for real IPs
                                   //    Without this, express-rate-limit throws
                                   //    ValidationError on every request

app.use(helmet({ ... }));         // 2. Security headers (X-Frame-Options, etc.)
app.use(cors({ ... }));           // 3. CORS — must handle OPTIONS preflight
                                   //    before any route handler fires

app.use(express.json({ ... }));   // 4. Parse JSON body before routes need it
app.use(session({ ... }));        // 5. express-session for X OAuth PKCE state

// Rate limiters — applied per route group, not globally
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });
const sendLimiter = rateLimit({ windowMs: 60*1000, max: 5 });
```

**Why `trust proxy: 1`?** Fly.io routes all traffic through a load balancer that adds `X-Forwarded-For`. Express defaults to `trust proxy = false`, which causes `express-rate-limit` to throw `ValidationError` on every request, crashing the app. Setting it to `1` tells Express to trust one level of proxy — the Fly.io load balancer.

### `requireAuth` middleware

```javascript
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.slice(7); // "Bearer " = 7 chars
  const sess  = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at,
           u.email, u.handle, u.resend_key, u.pin_hash, u.from_email,
           u.pgp_public_key, u.x_id, u.x_username, u.pin_is_default, u.display_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > unixepoch()
  `).get(token);
  if (!sess) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user = sess; // all user data available on req.user
  next();
}
```

One JOIN query fetches session + user together. `unixepoch()` in the WHERE clause handles TTL in the database — no JavaScript date math. The session token is a Bearer token in the `Authorization` header, not a cookie, making it safe for cross-origin requests from the static frontend.

### CORS

```javascript
const allowedOrigins = [
  'https://hollr.to', 'https://www.hollr.to',
  ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:5173']
      : []),
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
```

The `origin` function (not a string/array) enables dynamic origin checking. `credentials: true` is required so the browser sends the `Authorization` header on cross-origin requests.

### Rate limiting

- **Auth routes** (magic link, forgot-pin, verify): 10 requests per 15 minutes per IP. Prevents magic-link spam and brute-force attempts.
- **Send/upload routes**: 5 requests per minute per IP. Prevents canvas abuse from automated senders.
- Limits are per-IP (from `X-Forwarded-For`, trusted because of `trust proxy: 1`) because these endpoints are unauthenticated or pre-authentication.

---

## Deep-dive: Frontend architecture

### Why no framework

The frontend is plain HTML, CSS, and vanilla JavaScript. No React, no Vue, no Next.js, no build step. The reasons:

1. **Deploy simplicity.** FTP `mirror` uploads the changed files. There's no `npm run build`, no artifact, no CI pipeline needed.
2. **Zero dependency churn.** A React app from 2023 needs dependency updates every month. An HTML file from 2023 still works perfectly.
3. **Auditability.** The entire codebase is readable in a browser's View Source. There's no minified bundle obscuring the logic.
4. **Performance.** The landing page is a single HTTP request (CSS and JS inlined). The canvas page loads its fonts from Google, but everything else is one file.

The trade-offs are real: more verbose JS, no component reuse, manual DOM manipulation. For a product at this scale, those trade-offs are worth it.

### Single-file deploy strategy

The landing page (`index.html`) has its CSS and JS inlined via a Python script:

```python
with open('style.css') as f: css = f.read()
with open('main.js')   as f: js  = f.read()
html = html.replace('<link rel="stylesheet" href="style.css" />', f'<style>{css}</style>')
html = html.replace('<script src="main.js"></script>', f'<script>{js}</script>')
# favicon embedded as base64 data URI
```

Result: one HTTP request to load the entire page (minus Google Fonts). The source files (`landing-src/`) are kept in the repo for editing.

### i18n system

```javascript
const STRINGS = {
  en: { 'nav.how': 'How it works', 'hero.title': '...', ... },
  fr: { 'nav.how': 'Comment ça marche', ... },
  // 8 more languages
};

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.innerHTML = STRINGS[currentLang][key] ?? STRINGS.en[key] ?? '';
  });
}
```

Language auto-detection: `navigator.language.slice(0, 2)`. Persisted in `localStorage('hollr_lang')`. The language switcher in the welcome modal is a single flag pill button — clicking opens a language picker overlay with a 2-column flag + name grid.

### `sessionStorage` vs `localStorage`

Session tokens go in `sessionStorage`, not `localStorage`:

- `sessionStorage` is tab-scoped — each tab has its own session. Cleared when the tab closes.
- `localStorage` persists across tabs and browser restarts — appropriate for preferences (theme, language), not auth tokens.
- The canvas is designed to be embeddable in iframes. `sessionStorage` works correctly per-frame; `localStorage` is shared across the page and its iframes.

Early versions stored the desired handle (from the landing modal) in `sessionStorage`. This broke when the magic link opened in a new tab (empty `sessionStorage`). Fixed by storing `pending_handle` server-side in `magic_links`.

### Apache mod_rewrite

```apache
RewriteEngine On
RewriteRule ^auth/verify/?$  auth/verify.html [L]
RewriteRule ^decrypt/?$      decrypt/index.html [L]
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]
RewriteCond %{REQUEST_URI} !^/auth/
RewriteCond %{REQUEST_URI} !^/decrypt
RewriteRule ^([a-zA-Z0-9_-]+)/?$  handle/index.html [L]
```

**Order is critical.** `/auth/verify` and `/decrypt` must be matched before the `/:handle` wildcard. Static files (`-f` check) are served directly. The `/:handle` pattern catches anything else that looks like a handle. Without this exact ordering, visiting `/auth/verify` would serve the canvas page for a handle named "auth".

### Dark/light mode — no flash

```html
<!-- This script runs synchronously before <body> renders -->
<script>
  (function() {
    let t; try { t = localStorage.getItem('hollr-theme'); } catch {}
    const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  })();
</script>
```

This inline script runs before the browser paints anything, so there's no flash of the wrong theme. CSS custom properties (`--bg`, `--text`, etc.) are defined in `:root` (light) and `[data-theme="dark"]` (dark).

### Web Crypto API — in-browser decrypt viewer

The `/decrypt` page uses `SubtleCrypto` to decrypt files entirely in the browser:

```javascript
// URL: /decrypt#url=...&key=64hexChars&iv=24hexChars&name=file.pdf&type=application/pdf
const { url, key: keyHex, iv: ivHex, name, type } = parseHash();

// Fetch raw encrypted bytes (no credentials — just the encrypted blob)
const encrypted = await fetch(url).then(r => r.arrayBuffer());

// Reconstruct key and IV
const rawKey = hexToBytes(keyHex);
const iv     = hexToBytes(ivHex);
const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);

// Rearrange wire format: [authTag][cipher] → [cipher][authTag] for SubtleCrypto
const authTag    = encrypted.slice(0, 16);
const ciphertext = encrypted.slice(16);
const combined   = new Uint8Array([...new Uint8Array(ciphertext), ...new Uint8Array(authTag)]);

// Decrypt
const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, cryptoKey, combined);

// Detect type and render or offer download
const blob = new Blob([decrypted], { type });
```

The key never leaves the URL fragment. Browsers do not send `#fragments` in HTTP requests (RFC 3986 §3.5). The decrypt key is therefore never logged by any server, including hollr's.

---

## Deep-dive: Infrastructure

### Fly.io

Fly.io runs Docker containers as Firecracker microVMs. Key decisions:

- **Region: cdg (Paris).** Lowest latency for the expected European user base.
- **Persistent volume: 3 GB `hollr_data`.** SQLite file and uploads live on `/data`. The volume survives deploys, restarts, and even app destruction (if the volume isn't explicitly deleted).
- **`--remote-only` flag.** Builds the Docker image on Fly's remote builders. Avoids arm64/amd64 cross-compilation issues on Apple Silicon Macs.
- **Health check.** Fly polls `GET /health` every 30s. If it fails, the machine is replaced. Response: `{ ok: true, version: "4.6.0" }`.
- **Zero-downtime deploys.** Rolling strategy: new machine starts, health check passes, old machine stops. Database migrations run on startup — they're fast (ALTER TABLE) so there's no meaningful window where the old and new schemas conflict.

**The CNAME trap:** When you rename a Fly.io app, the old `*.fly.dev` hostname disappears immediately. Any DNS CNAME pointing to the old name breaks silently — requests return DNS resolution failures, which surface in the browser as "Network error." Always update CNAMEs before or simultaneously with an app rename.

### SiteGround FTP deployment

```bash
lftp -u "ftp@hollr.to,PASSWORD" es61.siteground.eu << 'EOF'
  set ftp:ssl-allow no        # disable TLS negotiation (SiteGround plain FTP)
  set net:timeout 30          # prevent hanging on connection issues
  cd hollr.to/public_html
  mirror --reverse --delete --verbose /tmp/stage/ ./
  quit
EOF
```

`mirror --reverse --delete` is a one-way sync from local to remote. Files not in the local source are deleted on the server. This ensures stale files don't accumulate.

`set ftp:ssl-allow no` — SiteGround's shared hosting tier uses plain FTP (not FTPS or SFTP on the standard plan). Without this, lftp spends 30 seconds trying TLS negotiation before timing out.

### Resend

Resend is used for two purposes with two different keys:

1. **Platform key (`PLATFORM_RESEND_KEY`):** Sends all magic links and notification emails when the user hasn't set up their own key. Sender: `hollr <yo@hollr.to>`. The `hollr.to` domain is verified in Resend.

2. **User key (optional):** Users can add their own Resend key in Settings. When set, notification emails go through their account with their verified domain as the sender. The key is stored encrypted (AES-256-CBC) in the database.

**The `reply_to: null` lesson:** Resend returns a 422 if `reply_to` is explicitly set to `null`. The fix is to only add the `reply_to` key to the payload when the sender's contact field passes an email regex. Absent is different from null in JSON APIs.

---

## Deep-dive: Security decisions

### No passwords, ever

hollr has no password field anywhere in the codebase. Authentication is:
- Magic links (15-min, single-use, require email access)
- X OAuth 2.0 PKCE (requires X account access)

This eliminates an entire attack surface: no credential stuffing, no password spray, no leaked hash tables, no forgot-password flows (only PIN reset, which is much lower stakes).

### CSRF

- Magic links are the auth mechanism — no traditional form POST needs CSRF tokens.
- X OAuth uses the `state` parameter for CSRF protection (standard OAuth 2.0).
- Bearer tokens in `Authorization` headers are not sent by browsers automatically (unlike cookies). No CSRF risk for authenticated API endpoints.

### Content security (XSS prevention)

All user-generated content embedded in HTML email templates is escaped:

```javascript
const esc = str => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
```

PGP-armoured ciphertext is rendered in `<pre>` with the same escaping. The canvas itself does not render user content as HTML.

### Helmet.js

Sets security headers on every response: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`. CSP is disabled (`contentSecurityPolicy: false`) because the canvas loads OpenPGP.js from `esm.sh` — a strict CSP would block this external import. This is a deliberate trade-off.

### Email enumeration prevention

`POST /api/auth/forgot-pin` always returns `{ ok: true }` regardless of whether the email exists. An attacker cannot use the endpoint to determine which emails are registered.

---

## API reference

All routes are on `https://hollr-api.fly.dev`. Authenticated routes require `Authorization: Bearer <session_token>`.

### Auth

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/auth/magic-link` | — | `{ email, handle? }` | `{ ok }` |
| `GET` | `/api/auth/verify/:token` | — | — | `{ ok, session_token, is_new_user, pending_handle?, user? }` |
| `POST` | `/api/auth/forgot-pin` | — | `{ email }` | `{ ok }` (always) |
| `GET` | `/api/auth/x` | — | — | Redirect to X OAuth |
| `GET` | `/api/auth/x/callback` | — | — | Redirect to frontend |
| `POST` | `/api/auth/logout` | ✅ | — | `{ ok }` |

### User

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/me` | ✅ | — | `{ display_name, email, handle, has_api_key, pin_is_default, has_email, from_email, has_pgp, x_username }` |
| `POST` | `/api/handle/check` | — | `{ handle }` | `{ available, reason? }` |
| `POST` | `/api/handle/claim` | ✅ | `{ handle, pin, resend_key?, from_email?, pgp_public_key?, email?, display_name? }` | `{ ok, handle, pin_is_default }` |

### Settings

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/settings` | ✅ | — | `{ display_name, email, from_email, has_resend_key, pgp_public_key, pin_is_default }` |
| `POST` | `/api/settings` | ✅ | `{ pin, resend_key?, from_email?, pgp_public_key?, notification_email?, display_name? }` | `{ ok }` or `{ error: 'must_change_pin' }` |
| `POST` | `/api/settings/change-pin` | ✅ | `{ current_pin, new_pin }` | `{ ok }` |
| `POST` | `/api/settings/email` | ✅ | `{ pin, email }` | `{ ok }` |

### Canvas (public)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/profile/:handle` | — | — | `{ handle, display_name, pgp_public_key, active }` |
| `POST` | `/api/send/:handle` | — | `{ contact, message, is_pgp?, file_attachments?, audio_url?, audio_key?, audio_iv? }` | `{ ok }` |
| `POST` | `/api/upload/:handle` | — | multipart `file` | `{ url, file_key, file_iv, name }` |
| `GET` | `/api/decrypt/:handle/:filename` | — | — | Raw encrypted bytes |
| `GET` | `/health` | — | — | `{ ok, version }` |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_SECRET` | ✅ | 64-char hex. Master secret for AES key derivation. `openssl rand -hex 32`. Never change without re-encrypting all stored values. |
| `SESSION_SECRET` | ✅ | Any random string. Signs express-session cookies. `openssl rand -hex 32`. |
| `PLATFORM_RESEND_KEY` | ✅ | Resend API key for magic links + platform message notifications. |
| `PLATFORM_FROM_EMAIL` | ✅ | Platform sender address. Must be on a verified Resend domain. E.g. `hollr <yo@hollr.to>`. |
| `FRONTEND_URL` | ✅ | Frontend origin. E.g. `https://hollr.to`. Used in magic-link URLs and X OAuth redirect. |
| `BASE_URL` | ✅ | Backend origin. E.g. `https://hollr-api.fly.dev`. Used in X OAuth callback URL. |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins. E.g. `https://hollr.to,https://www.hollr.to`. |
| `X_CLIENT_ID` | — | X OAuth 2.0 client ID. Without this, X login returns 503 gracefully. |
| `X_CLIENT_SECRET` | — | X OAuth 2.0 client secret. |
| `PORT` | — | HTTP port. Default `3000`. |
| `NODE_ENV` | — | `production` enables secure cookies and disables dev CORS origins. |
| `DATA_DIR` | — | Path for SQLite DB + uploads. Default `./data`. Use `/data` on Fly.io. |

---

## Versioning guideline

> **This is a permanent rule — applied to every commit that changes behaviour.**

hollr uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

| | When |
|---|---|
| **PATCH** (x.x.1) | Bug fixes, copy corrections, dependency updates |
| **MINOR** (x.1.0) | New features, non-breaking API additions |
| **MAJOR** (2.0.0) | Breaking changes, schema incompatibilities, full rewrites |

**On every version bump:**
1. Update `"version"` in `backend/package.json`
2. Update version string in `server.js` (`/health` endpoint + startup log)
3. Update version headers in `db.js`, `crypto.js`, `mailer.js`
4. Add `[x.y.z] — YYYY-MM-DD` entry to `CHANGELOG.md`
5. Update the version badge in `README.md`
6. Commit: `feat/fix: description (vX.Y.Z)`
7. Create GitHub release tag `vX.Y.Z`

---

## Roadmap

These features are on the plan. None are live yet.

**REST API** — Full HTTP API to read hollrs, manage your handle, integrate with external tools. `GET /v1/hollrs`, `GET /v1/hollrs/:id`, handle management endpoints.

**Webhooks** — POST each incoming hollr to a URL of your choosing, the moment it arrives. No polling. Works with Zapier, Make, n8n, your own server, Notion API, anything.

**MCP Server** — Model Context Protocol integration so Claude, Cursor, and other AI tools can read your hollrs as a data source. Your inbox becomes a tool your AI can query.

**Verification Apps** — Before a sender can reach you, they complete a micro-task you define: donate to a charity, follow your account, download your app, solve a puzzle, pay a small fee. You set the gate, hollr handles the verification. Designed to make every incoming message meaningful — real signal, zero spam.

---

## Issues, bottlenecks & lessons learned

A complete record of everything that went wrong and why. Read this before you build something similar.

---

### 🔴 `api.hollr.to` CNAME pointed to a destroyed app

**Symptom:** Every API call from the frontend returned "Network error". Magic links failed to send. The health check still passed when called directly on `hollr-api.fly.dev`.

**Root cause:** The CNAME `api.hollr.to → howlr-api.fly.dev` was configured during initial setup, when the app was named `howlr-api` (original typo). After renaming the app to `hollr-api`, the old `howlr-api.fly.dev` hostname ceased to exist. DNS continued resolving `api.hollr.to` to a dead address.

**Fix:** Updated all frontend API references to `hollr-api.fly.dev` directly. The correct CNAME target (obtained from `flyctl certs setup`) includes a unique prefix: `xxxxxxx.hollr-api.fly.dev`.

**Lesson:** When you rename a Fly.io app, the old `*.fly.dev` hostname disappears immediately. Update DNS before or simultaneously. Never assume a CNAME is stable across app renames.

---

### 🔴 `howlr` directory — 18 versions of the wrong name

**Symptom:** The workspace directory was named `howlr/` throughout the entire development session — a typo from the very first commit that was never caught.

**Root cause:** The original project was named "howlr" (mishearing of "hollr"). The code and GitHub were correctly renamed to "hollr" early in development, but the local filesystem path `howlr/` was never corrected. It persisted in tool call logs, error messages, and mental model for dozens of sessions.

**Fix:** `mv /workspace/howlr /workspace/hollr`. Grep-verified zero remaining occurrences in code files.

**Lesson:** Typos in directory names compound. Fix them at the OS level immediately when discovered, not later.

---

### 🔴 `trust proxy` missing — every request returned 502

**Symptom:** `POST /api/auth/magic-link` returned a 502 immediately after v4.5.1 deployed. Backend logs showed `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false`.

**Root cause:** Fly.io's load balancer adds `X-Forwarded-For` headers. `express-rate-limit` reads this header to identify clients. With `trust proxy = false` (Express default), the library detects an untrusted `X-Forwarded-For` and throws a `ValidationError` that crashed the request handler entirely.

**Fix:** `app.set('trust proxy', 1)` before any middleware. One line.

**Lesson:** Any Express app behind a reverse proxy (Fly.io, Nginx, Cloudflare) must set `trust proxy`. The default is wrong for production deployments. Add it before your first deploy, not as a hotfix.

---

### 🔴 SQLite startup crash — index before column

**Symptom:** Backend failed to start with `SqliteError: table magic_links has no column named pending_handle`. This happened immediately after deploying v4.5.1.

**Root cause:** The `CREATE INDEX IF NOT EXISTS idx_users_x_id ON users(x_id)` statement was inside the initial `db.exec()` block, which ran before the runtime migration loop added the `x_id` column. `CREATE INDEX IF NOT EXISTS` only skips duplicate index names — it still fails if the column doesn't exist.

**Fix:** Moved the index creation to after the migration loop, in its own try/catch. Additionally, for `pending_handle`, also ran `ALTER TABLE magic_links ADD COLUMN pending_handle TEXT` directly via `flyctl ssh console` so the running DB was fixed without waiting for a deploy.

**Lesson:** Any index on a migration-added column must be created after the migration runs. The `IF NOT EXISTS` clause does not protect against missing columns.

---

### 🔴 `pending_handle` lost across browser tabs

**Symptom:** Users entered their handle in the landing modal, received a magic link, clicked it in their email client — and found the onboarding form with an empty handle field.

**Root cause:** The handle was stored in `sessionStorage`. `sessionStorage` is scoped to a single browser tab. Clicking an email link opens a new tab with completely empty `sessionStorage`. The handle was gone before the user ever saw the onboarding form.

**Fix:** The handle is now sent to `POST /api/auth/magic-link` as `handle` in the request body. The backend stores it as `magic_links.pending_handle`. The verify endpoint returns it in the response. The browser reads it from the API — no browser storage involved.

**Lesson:** `sessionStorage` is tab-scoped. Do not use it to pass data that must survive an external link click (email, shared link, notification). Use the server.

---

### 🔴 `reply_to: null` causes Resend 422

**Symptom:** Message forwarding failed silently. Resend returned 422 Unprocessable Entity with no useful error message surfaced to the user.

**Root cause:** When a sender's contact field was a name rather than an email address, the Resend payload included `reply_to: null`. Resend's API treats `null` and omitted differently. `null` is an invalid value; omitting the key entirely is fine.

**Fix:** Only add `reply_to` to the payload when the contact field passes a basic email regex. Never set a key to `null` when omitting is the correct behaviour.

**Lesson:** In REST APIs, `null` and absent are not equivalent. Read the API docs carefully for nullable vs omittable fields. When in doubt, omit.

---

### 🔴 AES-GCM authTag wire format mismatch

**Symptom:** The in-browser decrypt viewer failed silently. `SubtleCrypto.decrypt` returned a `DOMException: The operation failed for an operation-specific reason`.

**Root cause:** Node's `crypto` API produces the GCM auth tag separately via `cipher.getAuthTag()`. SubtleCrypto's `decrypt` expects the tag *appended* to the ciphertext as a single buffer: `[ciphertext][authTag]`. We were storing `[authTag][ciphertext]` on disk, and the browser was incorrectly slicing the data.

**Fix:** Defined a clear wire format: `[16-byte authTag][ciphertext]` on disk. The decrypt viewer slices `bytes.slice(0, 16)` (tag) and `bytes.slice(16)` (cipher), then re-concatenates as `[ciphertext][tag]` before passing to SubtleCrypto.

**Lesson:** When two cryptographic systems interoperate, document the wire format explicitly with byte offsets. Mismatches between "tag appended" and "tag prepended" produce silent failures in both directions.

---

### 🔴 Resend API key leaked to git

**Symptom:** A GitGuardian alert arrived by email minutes after a push. A Resend API key appeared in a commit's diff.

**Root cause:** The key was hardcoded in a configuration file during initial development and committed before the env-var pattern was established.

**Fix:**
1. `git filter-repo --path backend/.env --invert-paths` — rewrites all commits to remove the file.
2. Force-push to GitHub (`git push --force`).
3. Immediately rotate the key in the Resend dashboard (leaked keys must be considered compromised even if the window was short).
4. Moved all secrets to Fly.io secrets (`flyctl secrets set ...`).

**Lesson:** Secrets in git history are compromised even after deletion — the history is permanent unless rewritten. Use `git filter-repo` (not `git filter-branch`). Rotate immediately. Set up pre-commit hooks or a tool like `gitleaks` to catch secrets before they're committed.

---

### 🟡 better-sqlite3 async confusion

**Symptom:** Queries returned `undefined` or the prepared statement object itself instead of rows.

**Root cause:** better-sqlite3 is synchronous. There is no async interface. Code patterns like `await db.prepare(...)` silently return the statement. `const [row] = db.prepare(...).where(...)` tries to destructure a query builder object.

**Fix:** All queries terminated with `.get()` (one row), `.all()` (array), or `.run()` (for writes). No `await` anywhere near SQLite calls.

**Lesson:** Read the driver documentation before writing queries. better-sqlite3 is intentionally synchronous — this is a feature. Treating it like an async ORM produces subtle, silent bugs.

---

### 🟡 PGP tab invisible — tab switcher bug

**Symptom:** Clicking the "PGP" tab in the settings modal appeared to activate the button visually but showed no content below.

**Root cause:** The tab-switching JavaScript toggled `tab-resend` and `tab-pin` but never `tab-pgp`. Three mutually exclusive panels, two of which were handled.

**Fix:** Replaced three individual `display` assignments with a single `switchTab(name)` function that iterates all tab panels and shows only the active one:

```javascript
function switchTab(name) {
  ['tab-resend', 'tab-pgp', 'tab-pin'].forEach(id => {
    document.getElementById(id).style.display = id === `tab-${name}` ? '' : 'none';
  });
}
```

**Lesson:** When you have N mutually exclusive panels, use a function that resets all N and activates one. Never N−1 individual assignments — the missing one will always be the one that matters.

---

### 🟡 X OAuth PKCE state in the browser

**Symptom:** X OAuth callback failed with `state_mismatch` in production.

**Root cause:** The initial implementation stored `code_verifier` and `state` in `sessionStorage` on the frontend. But the callback URL (`/api/auth/x/callback`) is on the backend — `sessionStorage` is inaccessible there.

**Fix:** Store both values in `express-session` (server-side):
```javascript
req.session.xState        = state;
req.session.xCodeVerifier = codeVerifier;
```
The session cookie bridges the gap between the initial request and the callback.

**Lesson:** PKCE state must live server-side for server-side OAuth callbacks. The callback URL receives the authorization code at the backend, not the browser. Any browser storage is inaccessible.

---

### 🟡 `flyctl not found` on first deploy

**Symptom:** Running `flyctl deploy` returned `command not found`.

**Root cause:** The Fly.io CLI installer adds `~/.fly/bin` to PATH by modifying the shell RC file, but the current shell session doesn't reload it.

**Fix:** Use the full path: `/home/user/.fly/bin/flyctl`. Or source the RC file: `source ~/.bashrc`.

**Lesson:** CLI tools that modify PATH require a new shell session to take effect. Always verify installation with the full path before debugging further.

---

### 🟢 `sessionStorage` vs `localStorage` for auth tokens

**Decision:** Session tokens stored in `sessionStorage`.

**Reasoning:** `sessionStorage` is tab-scoped. Each browser tab gets its own auth context. This is correct for an embeddable canvas — if a page embeds the canvas in an `<iframe>`, the iframe's sessionStorage is isolated from the parent page's localStorage. Tokens don't leak across tabs.

**Trade-off:** The user is logged out when they close the tab. For a messaging canvas (not a persistent app), this is acceptable.

---

### 🟢 multer `memoryStorage` — encrypt before write

**Decision:** Use `multer.memoryStorage()` instead of `multer.diskStorage()`.

**Reasoning:** `diskStorage` would write the file to disk in plaintext before our code gets a chance to encrypt it. `memoryStorage` gives us the raw Buffer in memory, which we encrypt (AES-256-GCM) before writing the `.enc` file.

**Trade-off:** Large files (up to 50MB) are held in memory during upload. For the expected usage pattern, this is acceptable.

---

### 🟢 URL hash params for decrypt key delivery

**Decision:** Encrypt key and IV go in the URL hash (`#key=...&iv=...`), not as query parameters.

**Reasoning:** RFC 3986 §3.5 defines the hash fragment as client-side only. Browsers do not include it in HTTP requests. The key is therefore never sent to hollr's server (or any server, including CDN logs) when the decrypt viewer fetches the encrypted blob.

**Implication:** The key exists only in the notification email and the browser's address bar. If you lose the email, you lose the key.

---

## Self-hosting

See [INSTALL.md](INSTALL.md) for the complete guide. Quick version:

```bash
git clone https://github.com/paulfxyz/hollr.git
cd hollr/backend
cp .env.example .env   # fill in secrets

npm install
node server.js         # http://localhost:3000
```

Deploy to Fly.io:

```bash
flyctl apps create your-app-name
flyctl volumes create hollr_data --region cdg --size 3
flyctl secrets set \
  ENCRYPTION_SECRET=$(openssl rand -hex 32) \
  SESSION_SECRET=$(openssl rand -hex 32) \
  PLATFORM_RESEND_KEY=re_xxxx \
  PLATFORM_FROM_EMAIL="hollr <yo@yourdomain.com>" \
  FRONTEND_URL=https://yourdomain.com \
  BASE_URL=https://your-app-name.fly.dev \
  ALLOWED_ORIGINS=https://yourdomain.com
flyctl deploy --remote-only
```

---

## Contributing

PRs welcome. Please open an issue first for significant changes. Follow the [versioning guideline](#versioning-guideline) on every commit that changes behaviour.

```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: describe your change (vX.Y.Z)"
git push origin feat/your-feature
# open a PR
```

---

## License

MIT — see [LICENSE](LICENSE). Fork it, self-host it, extend it, sell it. No restrictions.

---

## A note on vibe coding

This project is 100% vibe-coded.

I'm Paul Fleury — a hacker turned entrepreneur. I don't have a computer science degree. I don't claim to be a software engineer. What I do claim is a few decades of curiosity, a hacker's instinct for breaking and building things, and an entrepreneur's obsession with shipping.

hollr was built entirely by piloting AI — specifically [Perplexity Computer](https://www.perplexity.ai/computer) — over the course of a few days. I described what I wanted, reviewed what came back, caught mistakes, redirected, iterated. The architecture decisions, the security choices, the debugging of production crashes, the CHANGELOG entries — all of it emerged from a conversation between a non-engineer with good instincts and an AI with broad technical knowledge.

The result is a full-stack SaaS platform with:
- X OAuth 2.0 PKCE
- AES-256-GCM file encryption with in-browser decryption
- PGP end-to-end encryption via OpenPGP.js
- SQLite with WAL mode on a persistent Fly.io volume
- Magic-link authentication that survives new-tab opens
- A 3-step onboarding wizard
- 10 languages

Is the code perfect? No. Are there things a senior engineer would do differently? Absolutely. Is it running in production, handling real requests, and doing what it's supposed to do? Yes.

That's the point.

This README — with its detailed explanations of PKCE, authTag wire formats, and SQLite migration strategies — exists not because I wrote it from memory, but because I asked good questions and understood the answers well enough to direct what came next. The distinction between "knowing how to build something" and "knowing enough to guide something being built" is collapsing fast.

hollr is less a claim about my engineering skills and more a demonstration of where vibe coding stands in early 2026: capable of producing systems with real security properties, real architectural coherence, and real documentation — when piloted by someone who knows what they want and can tell good from bad.

Take the code, learn from it, improve it. That's what MIT is for.

— Paul

> *"The best way to predict the future is to build it." — Alan Kay*
> *"The best way to build it is to holler at your AI until it works." — Paul Fleury, probably*
