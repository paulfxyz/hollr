# 📯 hollr

[![Version](https://img.shields.io/badge/version-4.3.0-1a1814?style=flat-square&logo=github)](https://github.com/paulfxyz/hollr/releases/tag/v4.3.0)
[![License: MIT](https://img.shields.io/badge/license-MIT-c96a2a?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003b57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![Deployed on Fly.io](https://img.shields.io/badge/Fly.io-deployed-7c3aed?style=flat-square&logo=fly.io&logoColor=white)](https://fly.io)
[![Open Source](https://img.shields.io/badge/open_source-MIT-f9f6f1?style=flat-square)](https://github.com/paulfxyz/hollr)

**hollr** is a free, open-source SaaS platform where anyone can claim a personal handle and receive encrypted, timed messages at `hollr.to/:handle`.

Sign in with **X (Twitter)** or a **magic-link email** — no passwords. Pick your handle, set a PIN, share your link. Senders get a distraction-free, timed canvas. Messages can be end-to-end **PGP-encrypted**. Files and voice recordings are **AES-256-GCM encrypted** at rest, decryptable in-browser. Resend API is **optional** — the platform sends from `yo@hollr.to` by default.

> **Live demo:** [hollr.to](https://hollr.to) · **Example canvas:** [hollr.to/paulfxyz](https://hollr.to/paulfxyz)

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start — self-hosting](#quick-start--self-hosting)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Tech stack](#tech-stack)
- [Versioning guideline](#versioning-guideline)
- [Issues, bottlenecks & lessons learned](#issues-bottlenecks--lessons-learned)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| | Feature | Details |
|---|---|---|
| 🔐 | **PGP end-to-end encryption** | Paste your OpenPGP public key in settings. Senders encrypt in-browser via OpenPGP.js — only you can read it. |
| 🔒 | **AES-256-GCM file & voice encryption** | Every upload is encrypted at rest with a fresh per-file key. Decrypt in your browser — our server never sees plaintext. |
| 𝕏 | **X (Twitter) OAuth 2.0 PKCE** | One-click sign-in with your X account. No DMs, no posting, public username only. |
| 📬 | **Magic-link email auth** | No passwords ever. Enter email → click link → you're in. |
| 📧 | **Resend API optional** | Platform sends from `yo@hollr.to` by default. Plug in your own Resend key + verified domain for custom delivery. |
| ⏱️ | **Timed canvas** | A live stopwatch shows senders how long they've been writing. Intentional, focused messaging. |
| 🎤 | **Voice recording** | Record directly in the browser. Encrypted, linked in your notification email. |
| 📎 | **File attachments** | Drag and drop any file. Encrypted, uploaded, linked via the `/decrypt` viewer. |
| 🌐 | **10 languages** | EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU with auto-detection. |
| 🌙 | **Dark / light mode** | System-aware, no flash, localStorage persisted. |
| 🛠️ | **Fully open source** | MIT licensed. Fork, self-host, extend. No vendor lock-in. |

---

## Architecture

```
                 ┌──────────────────────────────────────────┐
                 │   hollr.to  (SiteGround, Apache)          │
                 │                                           │
                 │   /           → landing/index.html        │
                 │   /auth/verify→ auth/verify.html          │
                 │   /decrypt    → decrypt/index.html        │
                 │   /:handle    → handle/index.html         │
                 └─────────────────┬────────────────────────┘
                                   │ REST API calls
                                   ▼
                 ┌──────────────────────────────────────────┐
                 │   hollr-api.fly.dev  (Fly.io, Paris)     │
                 │                                           │
                 │   Node.js 20 + Express 4                  │
                 │   SQLite (WAL) on /data/hollr.db          │
                 │   Persistent volume: hollr_data (3 GB)    │
                 └────┬─────────────┬────────────────────────┘
                      │             │
           ┌──────────▼──┐   ┌──────▼────────────┐
           │  Resend API │   │  X (Twitter) API   │
           │  magic links│   │  OAuth 2.0 PKCE    │
           │  + messages │   │  user.fields=name  │
           └─────────────┘   └────────────────────┘
```

### Encryption layers

| Data | Algorithm | Where stored |
|---|---|---|
| Resend API key | AES-256-CBC + PBKDF2 (100k iter, SHA-256) | SQLite `users.resend_key` |
| PIN | bcrypt (cost 12) | SQLite `users.pin_hash` |
| File / audio uploads | AES-256-GCM (random key+IV per file) | Fly.io persistent volume |
| Message text (optional) | OpenPGP (client-side, sender's browser) | SQLite `messages.body` |

### Auth flow

```
Email path:
  Landing modal → POST /api/auth/magic-link → email sent
  → click link → GET /api/auth/verify/:token → session created
  → onboarding (pick handle, optional PIN/Resend/PGP)
  → /:handle?setup=1 → settings modal auto-opens

X OAuth path:
  Landing → GET /api/auth/x → X OAuth PKCE → callback
  → GET /api/auth/x/callback → session created
  → if no email: stateNeedEmail → collect email
  → onboarding → /:handle?setup=1
```

---

## Project structure

```
hollr/
├── backend/                    # Node.js/Express API (Fly.io)
│   ├── server.js               # All Express routes, middleware, auth logic
│   ├── db.js                   # SQLite schema, indexes, runtime migrations
│   ├── crypto.js               # AES-256-CBC (text) + AES-256-GCM (files)
│   ├── mailer.js               # Resend email: magic links + message forwarding
│   ├── package.json            # Dependencies + npm scripts
│   ├── fly.toml                # Fly.io app config (app=hollr-api, region=cdg)
│   ├── Dockerfile              # Production Docker image
│   └── .env.example            # All env vars documented
│
├── landing/                    # Static frontend (SiteGround FTP)
│   ├── index.html              # Landing page (Fraunces, warm parchment, i18n×10)
│   ├── auth/
│   │   └── verify.html         # Auth: magic link verify, X callback, onboarding
│   ├── handle/
│   │   └── index.html          # Per-handle canvas (send, PGP, file upload, voice)
│   ├── decrypt/
│   │   └── index.html          # In-browser AES-256-GCM file/audio decrypt viewer
│   └── .htaccess               # Apache mod_rewrite routing
│
├── landing-src/                # Unminified source for the landing page
│   ├── index.html
│   ├── style.css
│   └── main.js
│
├── README.md                   # This file
├── INSTALL.md                  # Self-hosting guide
├── CHANGELOG.md                # Full version history
└── LICENSE
```

---

## Quick start — self-hosting

See [INSTALL.md](INSTALL.md) for the full guide. TL;DR:

```bash
git clone https://github.com/paulfxyz/hollr.git
cd hollr/backend

cp .env.example .env          # fill in your secrets

npm install
node server.js                # runs on http://localhost:3000
```

Deploy to Fly.io:

```bash
flyctl apps create hollr-api
flyctl volumes create hollr_data --region cdg --size 3
flyctl secrets set \
  ENCRYPTION_SECRET=$(openssl rand -hex 32) \
  SESSION_SECRET=$(openssl rand -hex 32) \
  PLATFORM_RESEND_KEY=re_xxx \
  PLATFORM_FROM_EMAIL="hollr <yo@hollr.to>" \
  FRONTEND_URL=https://hollr.to \
  BASE_URL=https://hollr-api.fly.dev \
  ALLOWED_ORIGINS=https://hollr.to
flyctl deploy --remote-only
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_SECRET` | ✅ | 64-char hex. Master secret for AES-256 key derivation. Generate: `openssl rand -hex 32` |
| `SESSION_SECRET` | ✅ | Random string for express-session signing. Generate: `openssl rand -hex 32` |
| `PLATFORM_RESEND_KEY` | ✅ | Resend API key for platform emails (magic links + fallback messages) |
| `PLATFORM_FROM_EMAIL` | ✅ | Sender for platform emails, e.g. `hollr <yo@hollr.to>` |
| `FRONTEND_URL` | ✅ | Frontend origin, e.g. `https://hollr.to` |
| `BASE_URL` | ✅ | Backend origin, e.g. `https://hollr-api.fly.dev` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `X_CLIENT_ID` | — | X (Twitter) OAuth 2.0 client ID. Without this, X login returns 503 gracefully. |
| `X_CLIENT_SECRET` | — | X (Twitter) OAuth 2.0 client secret |
| `PORT` | — | HTTP port (default `3000`) |
| `NODE_ENV` | — | Set to `production` to enable secure cookies |
| `DATA_DIR` | — | Path for SQLite DB + uploads (default `./data`; use `/data` on Fly.io) |

---

## API reference

All routes are on the backend (`hollr-api.fly.dev`). Auth uses `Authorization: Bearer <session_token>`.

### Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/magic-link` | — | Send a one-time login link to an email address |
| `GET` | `/api/auth/verify/:token` | — | Verify magic link, create session. Returns `{ session_token, is_new_user, user }` |
| `POST` | `/api/auth/forgot-pin` | — | Send PIN-reset magic link to email on file |
| `GET` | `/api/auth/x` | — | Start X OAuth 2.0 PKCE flow (redirects to Twitter) |
| `GET` | `/api/auth/x/callback` | — | X OAuth callback → redirect to `FRONTEND_URL/auth/verify?x_session=…` |
| `POST` | `/api/auth/logout` | ✅ | Destroy session token |

### User

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/me` | ✅ | Get current user (`email`, `handle`, `has_api_key`, `pin_is_default`, etc.) |

### Handle

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/handle/check` | — | Check if a handle is available. Body: `{ handle }` |
| `POST` | `/api/handle/claim` | ✅ | Claim a handle. Body: `{ handle, pin?, resend_key?, from_email?, pgp_public_key?, email? }` |

### Settings

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/settings` | ✅ | Get current settings (non-secret: `email`, `from_email`, `pgp_public_key`, `has_resend_key`, `pin_is_default`) |
| `POST` | `/api/settings` | ✅ | Update settings. Body: `{ pin, resend_key?, from_email?, pgp_public_key?, notification_email? }`. Returns `{ error:'must_change_pin' }` if PIN is still default. |
| `POST` | `/api/settings/change-pin` | ✅ | Change PIN. Body: `{ current_pin, new_pin }`. Clears `pin_is_default`. |
| `POST` | `/api/settings/email` | ✅ | Update notification email. Body: `{ pin, email }` |

### Canvas (public)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/profile/:handle` | — | Public profile for canvas: `{ handle, pgp_public_key, active }` |
| `POST` | `/api/send/:handle` | — | Send a message. Body: `{ contact, message, is_pgp?, file_attachments?, audio_url?, audio_key?, audio_iv? }` |
| `POST` | `/api/upload/:handle` | — | Upload a file (multipart, field `file`). Returns `{ url, file_key, file_iv, name }` |
| `GET` | `/api/decrypt/:handle/:filename` | — | Stream raw encrypted bytes for client-side decryption |

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Backend runtime | Node.js 20 + Express 4 | Lightweight, no framework overhead |
| Database | SQLite via better-sqlite3 (WAL) | No separate DB server needed on Fly.io; sync API simplifies code |
| Auth | Magic links (Resend) + X OAuth 2.0 PKCE | No passwords to hash, store, or leak |
| Session storage | express-session (server-side, needed for PKCE state) | X OAuth requires state + code_verifier to survive the redirect |
| Text encryption | AES-256-CBC + PBKDF2-SHA256 | Battle-tested; PBKDF2 with 100k iterations is OWASP-compliant |
| File encryption | AES-256-GCM | Authenticated encryption + native Web Crypto support in all browsers |
| PGP encryption | OpenPGP.js v5 (client-side, via esm.sh) | No build step; lazy-loaded only when a PGP key is present |
| Email | Resend REST API (no SDK) | Small dependency footprint; Node's built-in `https` module suffices |
| File uploads | Multer (memory storage) | Encrypt buffer before touching disk |
| Backend hosting | Fly.io (Paris, cdg) | Persistent volumes, zero-config TLS, GitHub CI-friendly |
| Frontend hosting | SiteGround (FTP, Apache) | Existing domain + mod_rewrite for SPA routing |
| Frontend stack | Pure HTML + CSS + JS | No build step, no framework; instant deploy via FTP |
| Fonts | Fraunces + Inter (Google Fonts) | Editorial warmth meets functional clarity |

---

## Versioning guideline

> **This is a permanent project rule — follow it on every commit.**

hollr uses [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

| Increment | When |
|---|---|
| **PATCH** (x.x.1) | Bug fixes, copy corrections, small UI tweaks |
| **MINOR** (x.1.0) | New features, non-breaking API additions |
| **MAJOR** (2.0.0) | Breaking changes, full rewrites, schema incompatibilities |

**On every version bump, you must:**

1. Update `version` in `backend/package.json`
2. Update the version string in `backend/server.js` (`/health` endpoint + startup log)
3. Update the version comment header in `backend/db.js`, `crypto.js`, `mailer.js`
4. Add a `[x.y.z] — YYYY-MM-DD` entry to `CHANGELOG.md`
5. Update the version badge in `README.md`
6. Commit with message `feat/fix: description (vX.Y.Z)`
7. Create a GitHub release tag `vX.Y.Z`

---

## Issues, bottlenecks & lessons learned

### 🔴 `api.hollr.to` CNAME broken — all API calls silently fail
**Problem:** The CNAME `api.hollr.to → howlr-api.fly.dev` pointed to a destroyed app (renamed from `howlr-api` to `hollr-api`). Every frontend API call returned a DNS resolution error, surfacing as "Network error" in the UI.

**Fix:** Updated all frontend API references to `hollr-api.fly.dev` directly. The correct CNAME target is `gmrgw5w.hollr-api.fly.dev`. DNS needs to be updated at the registrar.

**Lesson:** After renaming a Fly.io app, all CNAME records pointing to the old `*.fly.dev` URL must be updated immediately. The old hostname disappears as soon as the app is destroyed.

---

### 🔴 `howlr` vs `hollr` directory name contamination
**Problem:** The workspace directory was named `howlr/` — the original typo from the project's first version — and persisted through dozens of subsequent sessions, polluting log output, tool call paths, and mental model.

**Fix:** Renamed `howlr/` → `hollr/` and `howlr-repo/` → `hollr-repo/` at the OS level. Full grep scan confirmed no remaining references in code files.

**Lesson:** Rename directories at the start of a project correction, not the end. Typos in directory names compound over time.

---

### 🔴 SQLite: `idx_users_x_id` created before `x_id` column exists
**Problem:** The initial `db.exec()` block included `CREATE INDEX IF NOT EXISTS idx_users_x_id ON users(x_id)`. On an existing database, `x_id` didn't exist yet — it was added in the migration loop below. SQLite threw `"no such column: x_id"` at startup, crashing the app on Fly.io.

**Fix:** Moved the index creation to *after* the ALTER TABLE migration loop, wrapped in its own try/catch.

**Lesson:** Any index on a column added via migration must itself be created after that migration runs. SQLite's `CREATE INDEX IF NOT EXISTS` only skips duplicate names, not missing columns.

---

### 🟡 `reply_to: null` causes Resend 422
**Problem:** When a sender's contact field was not an email address (e.g. just a name), we set `reply_to: null` in the Resend payload. Resend rejects null values with a 422 Unprocessable Entity.

**Fix:** Only add `reply_to` to the payload object when the contact field passes a basic email regex. Omitting the key entirely is fine; setting it to null is not.

**Lesson:** Read the API docs for nullable vs omittable fields. For Resend (and many REST APIs), `null` and "absent" are not equivalent.

---

### 🟡 AES-GCM authTag placement mismatch between Node and Web Crypto
**Problem:** Node's `crypto.createCipheriv('aes-256-gcm')` produces the authTag separately via `cipher.getAuthTag()`. SubtleCrypto's `decrypt()` expects the tag *appended* to the ciphertext as a single buffer. When we stored `[ciphertext][authTag]` and sliced the same way in the browser, decryption silently failed.

**Fix:** Defined a clear wire format: `[16-byte authTag][ciphertext...]` on disk. The browser decrypt viewer re-orders to `[ciphertext][authTag]` before calling SubtleCrypto.

**Lesson:** Always document your binary wire format with byte offsets. When two cryptographic systems need to interoperate, the format specification must be explicit and match both sides.

---

### 🟡 `better-sqlite3` is synchronous — no `await`
**Problem:** Early code had `const [row] = db.prepare(...).where(...)` patterns that returned undefined because the query builder isn't an array. Other spots had `await db.prepare(...)` which silently returned the prepared statement itself (not a Promise).

**Fix:** All queries terminated with `.get()`, `.all()`, or `.run()`. No `await` anywhere near SQLite calls.

**Lesson:** Read the driver documentation. better-sqlite3 is intentionally synchronous — this is a feature, not a limitation. Mixing async patterns with it causes subtle data bugs.

---

### 🟡 PGP tab invisible — JS only toggled two of three tabs
**Problem:** The settings modal tab-switcher toggled `tab-key` and `tab-pin` but never `tab-pgp`. Clicking the PGP tab activated its button visually but showed nothing below.

**Fix:** Replaced the three separate `display` assignments with a `switchTab(name)` function that iterates all tab panels and shows only the active one.

**Lesson:** When you have N mutually exclusive panels, use a function that resets all N and activates one — never N-1 individual assignments.

---

### 🟢 X OAuth PKCE state must survive HTTP redirect
**Problem:** X OAuth requires storing `code_verifier` and `state` between the initial redirect and the callback. We initially stored these in the frontend, but the callback arrives at the *backend* URL, where they're not accessible.

**Fix:** Stored `req.session.xState` and `req.session.xCodeVerifier` in express-session (server-side, memory-backed, 10-minute cookie). The callback reads from the same session.

**Lesson:** PKCE state must live server-side for server-side OAuth callbacks. Client-side storage (sessionStorage, cookies) isn't available at the backend callback URL.

---

## Contributing

PRs welcome. Please open an issue first for significant changes.

```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: describe your change (vX.Y.Z)"
git push origin feat/your-feature
# open a PR
```

Follow the [versioning guideline](#versioning-guideline) on every commit that changes behaviour.

---

## License

MIT — see [LICENSE](LICENSE). Free to fork, self-host, and extend.

---

*Built with care by [Paul Fleury](https://paulfleury.com) · [hollr.to](https://hollr.to)*
