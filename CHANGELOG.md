# Changelog

All notable changes are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/)

> **Permanent rule:** Every commit that changes behaviour must bump the version,
> add a CHANGELOG entry, update the README badge, and create a GitHub release.

---

## [4.3.0] — 2026-04-06

### 🧹 Code quality, docs, and directory correctness

The directory was still named `howlr/` internally — a typo from v1.0.0 that
was never caught at the OS level. Everything is now `hollr/` throughout.
All four backend modules received thorough educational comments.
README, INSTALL, and CHANGELOG were rewritten from scratch.

### Changed

- **Directory rename:** `howlr/` → `hollr/`, `howlr-repo/` → `hollr-repo/` everywhere in the workspace. Grep-verified no remaining `howlr` strings in any code file.
- **`crypto.js`** — Full JSDoc, wire-format documentation for both CBC and GCM, explanation of why tag-first storage was chosen, PBKDF2 iteration count justification.
- **`db.js`** — Full schema commentary per column, migration strategy explanation, better-sqlite3 usage notes, lesson learned on index-before-column crash.
- **`mailer.js`** — Full JSDoc on both public functions, HTML-escape rationale, decrypt-viewer URL format documentation, `reply_to: null` lesson learned.
- **`server.js`** — Version bumped to 4.3.0 in health endpoint and startup log.
- **`README.md`** — Completely rewritten: badges, architecture diagram, full API reference table, tech-stack rationale, versioning guideline, 8 documented issues/lessons learned.
- **`INSTALL.md`** — Completely rewritten: replaces the outdated PHP guide with current Node.js/Fly.io/FTP instructions, troubleshooting table.
- **`CHANGELOG.md`** — Rewritten: complete history from v1.0.0 to v4.3.0, permanent versioning rule documented at top.

---

## [4.2.0] — 2026-04-05

### 🎨 New landing page + full auth pipeline wired

#### Landing page
- New design from Paul's Figma: **Fraunces** serif, warm parchment (`#f9f6f1`), full-bleed `HOLLER.` outline wordmark as hero.
- Two-column hero: headline + animated canvas mockup (PGP ENCRYPTED badge, live timer).
- Stats strip, "How it works" numbered rows (01–04), canvas showcase, features grid, API & MCP developer section, delivery options, CTA footer.
- **Claim modal**: `hollr × 𝕏` branding, X OAuth button → `hollr-api.fly.dev/api/auth/x`, OR divider, email + handle form → magic-link API inline.
- "Check your inbox" state shown inside modal on success — no redirect needed.
- 10 language packs updated (EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU).
- Single-file deploy: CSS + JS + favicon inlined into `index.html`.

#### Auth pipeline
- **Root cause fix:** `api.hollr.to` CNAME pointed to destroyed `howlr-api.fly.dev`. All API calls now use `hollr-api.fly.dev` directly. Fly.io `BASE_URL` secret updated to match.
- **`auth/verify.html`** completely rewritten: Fraunces design, 7 states (`stateVerifying`, `stateError`, `stateChoose`, `stateSent`, `stateNeedEmail`, `stateOnboarding`, `statePinChange`).
  - Auto-expands email input when arrived from landing modal (handle in sessionStorage).
  - `stateNeedEmail` for X users without an email (can skip).
  - Redirects to `/:handle?setup=1` after claiming — canvas auto-opens settings.
- **`handle/index.html`** settings modal rebuilt:
  - **Notification email** section above tabs — where messages go (distinct from Resend sender).
  - **Resend tab**: API key + sender email/domain, "must be verified in Resend" hint.
  - **PGP tab**: full-height textarea, pre-filled, openpgp.org link, save/cancel wired (were missing before), live badge update.
  - **Change PIN tab**: default-PIN banner, rejects `1234`, clears banner on success.
  - `switchTab()` helper — fixes PGP tab always being invisible.
  - `loadSettingsValues()` — pre-fills all fields from `GET /api/settings` on modal open.
  - Auto-opens settings on `?setup=1` or `?pin_reset=1` URL param.
  - Also auto-opens if `/api/me` returns `pin_is_default: true`.
  - Forgot PIN → calls `/api/auth/forgot-pin`, shows confirmation.
- **Backend:**
  - `GET /api/settings` added — returns current settings for pre-fill.
  - `POST /api/settings` accepts `notification_email` to update destination inbox.
  - `GET /api/me` returns `pin_is_default` and `has_email`.

---

## [4.1.0] — 2026-04-05

### 🔑 PIN defaults, email-required for X users, forgot PIN

- **Default PIN is 1234.** Set automatically on account creation. First settings open returns `{ error: 'must_change_pin' }`, forcing a PIN change before other edits.
- **X users must supply an email.** Without one, no notifications and no PIN recovery. The `needs_email=1` URL param on the OAuth callback triggers a collection step.
- **`POST /api/auth/forgot-pin`** — sends a magic link that resets PIN to 1234 and sets `pin_is_default=1`, then forces change on next settings open.
- **`POST /api/settings/change-pin`** — now clears `pin_is_default` and rejects `1234` as the new PIN.
- **`POST /api/settings/email`** — lets users update their notification email (requires PIN).
- **`auth/verify.html`** — `stateNeedEmail` for X users; PIN change prompted via `statePinChange` after onboarding with blank PIN.
- **Schema:** `pin_is_default` column on `users`; `is_pin_reset` column on `magic_links`.
- **Onboarding:** PIN field is now optional — leaving it blank sets the default 1234 and `pin_is_default=1`.

---

## [4.0.0] — 2026-04-05

### 🚀 X OAuth, PGP, encrypted files, optional Resend

#### Authentication
- **X (Twitter) OAuth 2.0 PKCE** — `GET /api/auth/x` + callback. PKCE `code_verifier` + `state` stored in `express-session`.
- **`express-session`** added; `SESSION_SECRET` env var required.

#### PGP end-to-end encryption
- Users paste their OpenPGP public key in Settings → PGP tab.
- Canvas loads the key via `GET /api/profile/:handle` (includes `pgp_public_key`).
- Senders encrypt in-browser via **OpenPGP.js v5** (loaded from `esm.sh`, no build step).
- `is_pgp` flag stored on messages. Email renders the armoured block with a GPG hint.
- `🔐` badge shown on canvas topbar when PGP is active.

#### Encrypted file & voice uploads
- Every file and voice recording encrypted server-side with **AES-256-GCM** (fresh 32-byte key + 12-byte IV per file).
- `crypto.js` extended with `encryptBuffer()` / `decryptBuffer()`.
- `POST /api/upload/:handle` returns `{ url, file_key, file_iv, name }`.
- **`/decrypt` page** — brand-new client-side AES-256-GCM viewer using Web Crypto API. Key material lives in the URL hash — never sent to the server.
- `.htaccess` updated: `/decrypt` route added before the `/:handle` wildcard.

#### Optional Resend
- If user has no Resend key, notifications sent via `PLATFORM_RESEND_KEY` from `yo@hollr.to`.
- `mailer.js` falls back gracefully to the platform key.

#### Schema changes
- `users`: added `x_id`, `x_username`, `x_token`, `x_token_secret`, `pgp_public_key`.
- New `messages` table: `handle`, `sender`, `body`, `is_pgp`, `file_urls`, `audio_url`, `audio_encrypted`.
- Runtime migration system: `ALTER TABLE … ADD COLUMN` wrapped in try/catch, runs on every startup.

#### Landing page
- Sections updated in all 10 languages: X login, PGP, encrypted files, optional Resend.
- Step 1 updated to "Sign in with X or email"; step 3 updated to "Set your PIN".

---

## [3.0.0] — 2026-04-04

### 🏗️ Full SaaS rewrite — Node.js backend, SQLite, magic links, handle canvas

**Renamed:** `paulfxyz/to` → `paulfxyz/hollr`. Domain: `hollr.to`.

#### Backend (new, Fly.io)
- **Node.js 20 + Express 4** replaces PHP.
- **SQLite** (better-sqlite3, WAL mode) on a persistent Fly.io volume.
- **Magic-link auth** via Resend — no passwords.
- **Handle claiming** — `hollr.to/:handle` is yours forever, first-come first-served.
- **AES-256-CBC + PBKDF2** for Resend key encryption at rest.
- **bcrypt** for PIN hashing (cost 12).
- Deployed to `hollr-api.fly.dev` (Paris, `cdg`).

#### Frontend
- **Multi-language landing** — `hollr.to` with 10 languages, dark/light mode, handle strip.
- **`auth/verify.html`** — magic-link verification + new-user onboarding.
- **`handle/index.html`** — per-handle canvas adapted from v2.0.0.
- **`.htaccess`** Apache mod_rewrite routing.

#### Infrastructure
- `api.hollr.to` CNAME configured (pointed to Fly.io).
- GitHub repo renamed `paulfxyz/hollr`.
- Git history cleaned: Resend API key removed via `git-filter-repo`, key rotated.

---

## [2.0.0] — 2026-04-03

### 🌐 i18n + dark/light mode

- **10 languages**: EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU with auto-detection.
- **Dark / light / system** theme modes, CSS custom properties.
- 🌐 language picker (flag dropdown) and 🌙 theme toggle added to topbar.
- Language flag strip added to the welcome modal.
- Called 2.0.0 because the UX surface changed substantially.

---

## [1.2.2] — 2026-04-03

### Fixed
- Contact field now accepts any input (was previously restricted to email-only).

---

## [1.2.1] — 2026-04-03

### Fixed
- Title changed from "Message to Paul Fleury" → "Send a message to Paul Fleury".
- Empty JSON body from PHP handler caused `undefined` errors — added guard.
- "Sending…" hint now resets correctly after error responses.

---

## [1.2.0] — 2026-04-03

### Added
- Deep code documentation and inline comments throughout all PHP files.
- Lessons learned section in README.
- `INSTALL.md` with step-by-step setup guide.
- Version bumped to 1.2.0.

---

## [1.1.0] — 2026-04-02

### Added
- README badges (version, license, PHP, node).
- Formal versioning established (semver).

---

## [1.0.0] — 2026-04-02

### 🎉 Initial release

- **"to"** — personal timed message canvas for Paul Fleury.
- PHP 8.1 backend: `send.php`, `upload.php`, `settings.php`.
- AES-256-CBC encryption for Resend API key at rest.
- File uploads (drag and drop, any type).
- Voice recording directly in the browser.
- Timed canvas with ⌘↵ / Ctrl+Enter shortcut.
- Resend integration for email delivery.
- Deployed to `to.paulfleury.com` via SiteGround FTP.
- GitHub: `paulfxyz/to` (public, MIT).
