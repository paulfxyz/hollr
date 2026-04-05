# 📯 hollr

[![Version](https://img.shields.io/badge/version-4.0.0-ff6b35?style=flat-square)](https://github.com/paulfxyz/hollr/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-black?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-20-green?style=flat-square)](https://nodejs.org)
[![Fly.io](https://img.shields.io/badge/backend-Fly.io-6366f1?style=flat-square)](https://fly.io)
[![Open Source](https://img.shields.io/badge/open_source-yes-orange?style=flat-square)](https://github.com/paulfxyz/hollr)

**hollr** is a free, open-source SaaS platform where anyone can claim a personal handle and receive **PGP-encrypted**, timed, distraction-free messages at `hollr.to/:handle`.

Sign in with **X (Twitter)** or email, pick a handle, set a PIN — and you're done. Messages can be end-to-end encrypted with your PGP key. Files and voice recordings are encrypted at rest with AES-256-GCM and decryptable in-browser. Resend API is optional — platform emails work out of the box.

> **Live:** [hollr.to](https://hollr.to) · **Example:** [hollr.to/paulfxyz](https://hollr.to/paulfxyz)

---

## What it does

| For message senders | For handle owners |
|---|---|
| Visit `hollr.to/yourfriend` | Claim `hollr.to/yourname` |
| Compose on a distraction-free timed canvas | Receive messages in your inbox |
| Attach encrypted files or record a voice note | PGP end-to-end encryption with your key |
| Hit send — that's it | Platform emails work without Resend setup |

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started (self-host)](#getting-started-self-host)
- [API reference](#api-reference)
- [Stack](#stack)
- [Environment variables](#environment-variables)
- [Lessons learned](#lessons-learned)
- [Contributing](#contributing)
- [License](#license)
- [Disclaimer](#disclaimer)

---

## Features

- **X (Twitter) OAuth 2.0 PKCE login** — sign in with your X account in one click.
- **Magic-link email auth** — no passwords, ever. Enter email → get link → you're in.
- **PGP end-to-end encryption** — add your PGP public key in settings. Senders encrypt with your key; only you can decrypt.
- **Encrypted file uploads** — every uploaded file is encrypted at rest with AES-256-GCM. Decrypt and download via the in-browser `/decrypt` viewer.
- **Encrypted voice recording** — record directly in the browser; audio encrypted at rest and decryptable via the same viewer.
- **In-browser decrypt viewer** — `hollr.to/decrypt` — paste `file_key` + `file_iv` from the email link, decrypt and download entirely client-side. No server sees your data.
- **Resend API optional** — platform sends notification emails from `yo@hollr.to` by default. Plug in your own Resend key in settings for custom delivery.
- **Handle claiming** — `hollr.to/:handle` is yours forever. First come, first served.
- **Timed canvas** — a live stopwatch reminds senders how long they've been writing.
- **10 languages** — EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU with auto-detection.
- **Dark / light / system theme** — CSS custom properties, zero flicker.
- **AES-256-CBC encryption** — your Resend API key is encrypted at rest with PBKDF2 key derivation.
- **Keyboard shortcuts** — `⌘↵` / `Ctrl+Enter` to open send modal, `Space` to start timer, `Esc` to close modals.
- **Fully open source** — MIT. Fork it, self-host it, extend it.

---

## Architecture

```
┌─────────────────────────────────┐   CNAME    ┌────────────────────────┐
│   hollr.to (SiteGround)         │ ─────────► │  api.hollr.to          │
│                                 │            │  (Fly.io, Paris)        │
│   landing/index.html            │            │                         │
│   landing/auth/verify.html      │  REST API  │  Node.js / Express      │
│   landing/handle/index.html     │ ◄────────► │  SQLite (WAL)           │
│   landing/decrypt/index.html    │            │  Fly persistent volume  │
│   .htaccess (mod_rewrite)       │            │                         │
└─────────────────────────────────┘            └────────────────────────┘
                                                         │
                         ┌───────────────────────────────┤
                         │                               │
               ┌─────────▼──────────┐      ┌────────────▼───────────┐
               │   Resend API        │      │   X (Twitter) OAuth     │
               │  (magic links +     │      │   2.0 PKCE              │
               │   user messages)    │      │   (optional)            │
               └─────────────────────┘      └─────────────────────────┘
```

**Routing (Apache .htaccess):**
- `/` → landing page
- `/auth/verify` → magic-link verification + X OAuth callback + onboarding
- `/decrypt` → in-browser AES-256-GCM file/audio decrypt viewer
- `/:handle` → per-handle message canvas

**Encryption layers:**
| What | Algorithm | Where |
|---|---|---|
| Resend API key at rest | AES-256-CBC + PBKDF2 | SQLite |
| PIN | bcrypt | SQLite |
| File / audio uploads | AES-256-GCM | Fly.io volume |
| Message text (optional) | PGP / OpenPGP.js | Client-side + SQLite |

---

## Project structure

```
hollr/
├── backend/
│   ├── server.js          # Express app: routes, X OAuth, auth, send, upload, decrypt
│   ├── db.js              # SQLite schema + runtime migrations
│   ├── crypto.js          # AES-256-CBC (text secrets) + AES-256-GCM (file buffers)
│   ├── mailer.js          # Resend email: magic links, PGP-aware message notifications
│   ├── package.json
│   ├── fly.toml           # Fly.io config (app=hollr-api, region=cdg, volume=hollr_data)
│   ├── Dockerfile
│   └── .env.example
└── landing/
    ├── index.html          # Multi-language landing page (10 langs, dark/light mode)
    ├── auth/
    │   └── verify.html     # X OAuth + magic link verify + new-user onboarding
    ├── handle/
    │   └── index.html      # Per-handle canvas (PGP encrypt, encrypted upload, voice)
    ├── decrypt/
    │   └── index.html      # In-browser AES-256-GCM file/audio decrypt viewer
    └── .htaccess           # Apache routing rules
```

---

## Getting started (self-host)

### Prerequisites

- Node.js 20+
- A [Fly.io](https://fly.io) account (backend)
- A [Resend](https://resend.com) account (platform email; optional per-user)
- A web host supporting Apache mod_rewrite (frontend)
- A domain, e.g. `example.com`

### 1. Clone the repo

```bash
git clone https://github.com/paulfxyz/hollr.git
cd hollr
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env — see Environment variables section below
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run locally

```bash
node server.js
# Backend on http://localhost:3000
```

### 5. Deploy backend to Fly.io

```bash
# Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/
flyctl auth login
flyctl apps create hollr-api          # or your chosen name
flyctl volumes create hollr_data --region cdg --size 3
flyctl secrets set \
  ENCRYPTION_SECRET=$(openssl rand -hex 32) \
  SESSION_SECRET=$(openssl rand -hex 32) \
  PLATFORM_RESEND_KEY=re_xxx \
  PLATFORM_FROM_EMAIL="hollr <yo@yourdomain.com>" \
  FRONTEND_URL=https://yourdomain.com \
  BASE_URL=https://api.yourdomain.com \
  ALLOWED_ORIGINS=https://yourdomain.com
flyctl deploy --remote-only
```

### 6. Deploy frontend

Upload the contents of `landing/` to your web host's public root. Ensure Apache `mod_rewrite` is enabled.

### 7. Configure X OAuth (optional)

Create an app at [developer.twitter.com](https://developer.twitter.com), set callback URL to `https://api.yourdomain.com/api/auth/x/callback`, then:

```bash
flyctl secrets set X_CLIENT_ID=xxx X_CLIENT_SECRET=xxx
```

---

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/magic-link` | — | Send magic link email |
| `GET` | `/api/auth/verify` | — | Verify magic link token, set session |
| `GET` | `/api/auth/x` | — | Start X OAuth 2.0 PKCE flow |
| `GET` | `/api/auth/x/callback` | — | X OAuth callback |
| `GET` | `/api/auth/me` | Session | Get current user |
| `POST` | `/api/auth/logout` | Session | Destroy session |
| `POST` | `/api/handle/claim` | Session | Claim a handle + set PIN + optional Resend key |
| `GET` | `/api/profile/:handle` | — | Get public profile for handle canvas |
| `POST` | `/api/send/:handle` | — | Send a message (text, PGP, file/audio metadata) |
| `POST` | `/api/upload/:handle` | — | Upload + AES-256-GCM encrypt file or audio |
| `GET` | `/api/decrypt/:handle/:filename` | — | Download encrypted file bytes for client-side decrypt |
| `GET` | `/api/settings` | Session + PIN | Get current settings |
| `POST` | `/api/settings` | Session + PIN | Update Resend key, FROM email, PIN, PGP public key |

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20 + Express 4 |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Auth | X OAuth 2.0 PKCE + magic links via Resend, sessions via express-session |
| Encryption (text) | AES-256-CBC + PBKDF2-SHA256 (100k iterations) |
| Encryption (files) | AES-256-GCM (random key+IV per file, stored in DB) |
| PGP | OpenPGP.js v5 (client-side, via esm.sh CDN) |
| Email | Resend REST API |
| File uploads | Multer → Fly.io persistent volume |
| Frontend | Plain HTML/CSS/JS, no build step |
| Hosting | Fly.io (backend) + SiteGround FTP (frontend) |
| Routing | Apache mod_rewrite |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_SECRET` | ✅ | 64-char hex secret for AES-256 key derivation |
| `SESSION_SECRET` | ✅ | Random string for express-session signing |
| `PLATFORM_RESEND_KEY` | ✅ | Resend API key for platform emails (magic links + fallback) |
| `PLATFORM_FROM_EMAIL` | ✅ | Platform sender email, e.g. `hollr <yo@yourdomain.com>` |
| `FRONTEND_URL` | ✅ | Frontend origin, e.g. `https://hollr.to` |
| `BASE_URL` | ✅ | Backend origin, e.g. `https://api.hollr.to` |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `X_CLIENT_ID` | — | X (Twitter) OAuth 2.0 client ID |
| `X_CLIENT_SECRET` | — | X (Twitter) OAuth 2.0 client secret |
| `PORT` | — | HTTP port (default: `3000`) |
| `NODE_ENV` | — | `production` to enable secure cookies |

See `.env.example` for a full template.

---

## Lessons learned

- **better-sqlite3 is synchronous** — no `await`, use `.get()` / `.all()` / `.run()`. Trying to destructure the query builder directly (`const [row] = db.select()...`) returns undefined; always chain `.get()`.
- **Resend rejects `reply_to: null`** — omit the key entirely rather than passing `null`.
- **AES-256-GCM wire format pitfall** — `SubtleCrypto.decrypt` expects `[ciphertext][authTag]` but our storage format is `[authTag][ciphertext]`. Rearrange on the client-side decrypt viewer before passing to `SubtleCrypto`.
- **OpenPGP.js via esm.sh** — `import('https://esm.sh/openpgp@5')` works perfectly in the browser with no build step. Load lazily only when a PGP key is set.
- **X OAuth PKCE** — store `code_verifier` and `state` in `express-session` (server-side), not in the frontend. The callback must read from the same session.
- **FTP deploy** — SiteGround lftp with `set ftp:ssl-allow no` avoids TLS negotiation hangs on plain FTP.
- **Git history security** — if a secret leaks into git history, use `git-filter-repo` to rewrite all commits, force-push, then rotate the key immediately.
- **Session tokens in sessionStorage** — not `localStorage`, for iframe compatibility in canvas embeds.

---

## Contributing

PRs welcome. Please open an issue first for large changes.

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a pull request

---

## License

MIT — see [LICENSE](LICENSE).

---

## Disclaimer

hollr is a personal/community project. Use at your own risk. PGP encryption is only as strong as your key management. The platform does not store unencrypted message content, but server-side file encryption keys are stored in the database — for true end-to-end security, use PGP encryption on message text.
