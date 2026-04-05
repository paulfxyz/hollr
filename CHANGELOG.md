# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [4.0.0] — 2026-04-05

### 🚀 Major — Security & auth upgrade

v4.0.0 is a significant leap in privacy and authentication. Every handle is now a
fully encrypted communication channel: messages can be PGP-encrypted end-to-end,
files and voice recordings are encrypted at rest with AES-256-GCM, and login is
now available via X (Twitter) OAuth in addition to magic links. Resend API is
now optional — the platform sends notification emails from `yo@hollr.to` by default.

### Added

#### Authentication
- **X (Twitter) OAuth 2.0 PKCE login** — `GET /api/auth/x` + callback. Users can sign in with their X account in one click. PKCE `code_verifier` and `state` stored server-side in `express-session`.
- **express-session** added for server-side session storage (X OAuth state + PKCE verifier).
- `SESSION_SECRET` environment variable added.

#### PGP Encryption
- **PGP public key storage** — users can paste their OpenPGP public key in the Settings modal (`cog` icon). Stored in SQLite.
- **Client-side PGP encryption** on the canvas — when a handle owner has a PGP key set, OpenPGP.js v5 (loaded via `esm.sh`) encrypts the message text in-browser before sending. The ciphertext is stored in the `messages` table, not the plaintext.
- **PGP badge** — canvas shows a `🔐` badge when the handle owner has PGP enabled.
- New `pgp_public_key` column in the `users` table.
- `GET /api/profile/:handle` now includes `pgp_public_key` for client-side encryption.

#### Encrypted File & Voice Uploads
- **AES-256-GCM file encryption** — every uploaded file and voice recording is encrypted server-side with a random 32-byte key and 12-byte IV before writing to disk.
- `crypto.js` extended with `encryptBuffer(buffer)` → `{ ciphertext, key, iv }` and `decryptBuffer(ciphertext, key, iv)`.
- `POST /api/upload/:handle` returns `{ url, file_key, file_iv, name }` — `file_key` and `file_iv` are hex-encoded and included in the notification email as a decrypt link.
- `GET /api/decrypt/:handle/:filename` — streams the raw encrypted bytes to the client for in-browser decryption.
- `messages` table extended with `is_pgp`, `file_attachments` (JSON), `audio_key`, `audio_iv` columns.

#### In-Browser Decrypt Viewer
- **`/decrypt` page** — brand new `decrypt/index.html` providing a fully client-side AES-256-GCM decrypt-and-download viewer.
  - Accepts `key` and `iv` query parameters (pre-filled from email links).
  - Fetches raw encrypted bytes from `/api/decrypt/:handle/:filename`.
  - Decrypts using the Web Crypto API (`SubtleCrypto.decrypt`, `AES-GCM`).
  - Detects MIME type (audio/image/PDF/generic) and renders inline or offers download.
  - Zero server-side access to plaintext.
- `.htaccess` updated: `/decrypt` route added before the `/:handle` wildcard.

#### Optional Resend API
- **Platform fallback email** — if a handle owner has no Resend key configured, notification emails are sent from `yo@hollr.to` via the platform Resend key (`PLATFORM_RESEND_KEY`).
- `PLATFORM_FROM_EMAIL` and `PLATFORM_RESEND_KEY` env vars already existed but are now the primary delivery path.
- `mailer.js` updated to gracefully fall back to platform email when user has no `resend_key`.

#### Onboarding & Settings
- Auth verify page (`auth/verify.html`) updated: X OAuth login button added, Resend key field marked optional, PGP key textarea added to onboarding flow.
- Settings modal in the canvas updated: new **PGP** tab alongside Resend and PIN tabs.

#### Landing Page
- Hero subtitle, "How it works" steps, and Features section updated to reflect v4.0.0.
- Steps 1 and 3 rewritten: login now "X or email", step 3 now "Set your PIN" (Resend optional).
- New feature cards: `X & email login`, `PGP end-to-end encryption`, `Encrypted files & voice`, `Resend optional`.
- Old `AES-256 encryption` card replaced by `Encrypted files & voice` (AES-256-GCM).
- All 10 language packs updated with new strings.
- Meta description updated.

### Changed
- `db.js` — runtime migrations add `x_id`, `x_username`, `x_token`, `pgp_public_key` columns to `users` table and create the new `messages` table.
- `package.json` — added `openpgp@5`, `express-session`.
- `.env.example` — documents `SESSION_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`.

### Architecture (v4.0.0)
| Layer | Tech |
|---|---|
| Backend | Node.js 20 + Express 4 on Fly.io |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Auth | X OAuth 2.0 PKCE + magic links via Resend, sessions via express-session |
| Encryption (text secrets) | AES-256-CBC + PBKDF2-SHA256 (100k iterations) |
| Encryption (files/audio) | AES-256-GCM (random key+IV per file, stored in DB) |
| PGP | OpenPGP.js v5 (client-side, via esm.sh) |
| Email | Resend REST API (platform `yo@hollr.to` fallback + optional per-user key) |
| File uploads | Multer → Fly.io persistent volume (encrypted) |
| Frontend | Plain HTML/CSS/JS, no build step, deployed via FTP |
| Routing | Apache mod_rewrite on SiteGround |

---

## [3.0.0] — 2026-04-04

### 🚀 Major — Platform relaunch as hollr.to SaaS

This is a full architectural evolution. The project was previously a single-user
canvas (`to` / `to.paulfleury.com`). It is now a **free, open-source multi-user
SaaS platform** where anyone can claim a handle at `hollr.to/:handle`.

### Added
- **Multi-user platform** — anyone can register at [hollr.to](https://hollr.to), claim a unique handle, and receive messages at `hollr.to/:handle`
- **Node.js / Express backend** deployed on Fly.io (`api.hollr.to`)
  - Magic-link email authentication (no passwords, ever)
  - SQLite + better-sqlite3 for persistent storage (Fly.io volume)
  - AES-256-CBC + PBKDF2 encryption of per-user Resend API keys
  - bcrypt PIN hashing
  - Rate limiting (express-rate-limit) on auth and send routes
  - Multer for file/audio uploads → `/data/uploads/:handle/`
  - `nodemailer` + Resend REST API for magic-link emails
  - Full REST API: `/api/auth/*`, `/api/handle/*`, `/api/settings`, `/api/send/:handle`, `/api/upload/:handle`, `/api/profile/:handle`
- **Multi-language landing page** (`hollr.to`) in 10 languages: EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU
  - Language auto-detection from browser
  - Manual language picker modal
  - Dark / light theme toggle (system default)
  - Cabinet Grotesk + Satoshi font pairing
  - Animated handle demo typewriter
  - Live preview timer simulation
  - Signup form that calls the magic-link API
- **Auth verify page** (`hollr.to/auth/verify`) — handles magic link verification and new-user onboarding
  - Live handle availability check (debounced)
  - Resend key + from email + PIN collection
  - Immediate redirect to canvas after claiming
- **Per-handle canvas page** (`hollr.to/:handle`) — the full v2.0.0 canvas, adapted to:
  - Load the handle owner's profile from `/api/profile/:handle` dynamically
  - Replace all "Paul Fleury" references with the actual handle owner's name
  - Route uploads and sends through the REST API
  - Wire settings modal to REST endpoints with Bearer token auth
  - Show a friendly 404 page if the handle doesn't exist
- **Apache `.htaccess`** routing: `/` → landing, `/auth/verify` → auth, `/:handle` → canvas
- **GitHub repo renamed** from `paulfxyz/to` → `paulfxyz/hollr`
- **Fly.io deployment config** (`fly.toml`): Paris region, 256 MB shared CPU, persistent `/data` volume

### Architecture
| Layer | Tech |
|---|---|
| Backend | Node.js 20 + Express 4 on Fly.io |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Auth | Magic links via Resend, sessions in SQLite |
| Encryption | AES-256-CBC + PBKDF2-SHA256 (100k iterations) |
| Email | Resend REST API (platform key for auth, per-user key for messages) |
| File uploads | Multer → Fly.io persistent volume, served as static |
| Frontend | Plain HTML/CSS/JS, no build step, deployed via FTP |
| Routing | Apache mod_rewrite on SiteGround |
| DNS | `api.hollr.to` CNAME → `hollr-api.fly.dev` |

### Changed
- Project renamed: **to** → **hollr**
- Domain: `to.paulfleury.com` → `hollr.to`
- The per-handle canvas is now fully dynamic (no hardcoded owner names)

---

## [2.0.0] — 2026-04-04

### Added
- **Full i18n system** — 10 languages: English, French, German, Italian, Spanish, Dutch, Chinese, Hindi, Japanese, Russian
- **Language picker modal** — flag icon in top-right opens a grid of 10 language options with auto-detection from browser locale
- **Dark / light / system theme** — bulb icon in top-right opens theme picker modal; CSS custom properties for all colours; `data-theme` attribute on `<html>`
- **Welcome modal flag strip** — compact flag row added to welcome card for immediate language switching

### Changed
- All CSS colours converted to `--custom-properties` with full dark/light variants
- All UI text extracted into `STRINGS[lang]` i18n map

---

## [1.2.2] — 2026-04-04

### Fixed
- `reply_to` validation: contact field now accepts any freeform text; `reply_to` only sent to Resend if value is a valid email address (Resend rejected non-email `reply_to` values)

---

## [1.2.1] — 2026-04-04

### Changed
- Page title and topbar renamed: "Message to Paul Fleury" → "Send a message to Paul Fleury"

---

## [1.2.0] — 2026-04-04

### Added
- Deep documentation pass on all PHP files (`send.php`, `upload.php`, `settings.php`)
- README expanded with detailed lessons learned, tech stack table, bottlenecks, solutions

---

## [1.1.0] — 2026-04-04

### Added
- README badges (version, license, PHP version)
- Quick-start / INSTALL.md guide
- Improved README structure (ToC, sections)

---

## [1.0.0] — 2026-04-04

### Added
- Initial release: personal message canvas at `to.paulfleury.com`
- `index.html` — Notion-inspired fullscreen canvas with:
  - Stopwatch timer (start/pause/reset)
  - Rich textarea with word/character count
  - Voice recording (MediaRecorder API, WebM)
  - File drag-and-drop upload
  - Send modal (Resend API via PHP backend)
  - Settings modal (AES-256-CBC + PBKDF2, PIN protection)
  - Keyboard shortcuts (⌘↵ to send, Space to start, Esc to close)
- `send.php` — decrypts API key, builds HTML+text email, calls Resend REST API via cURL
- `upload.php` — multipart upload to `/cache/`, probabilistic 30-day cleanup
- `settings.php` — AES-256-CBC + PBKDF2-SHA256 encryption of Resend key; PIN hashing; JSON settings file
- `.htaccess` — security headers, PHP error suppression
- GitHub repository created: `paulfxyz/to` (public)
- FTP deployed to `to.paulfleury.com`
