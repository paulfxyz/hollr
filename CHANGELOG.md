# Changelog

All notable changes to hollr.to are documented in this file.

> **⚠️ PERMANENT PROJECT RULE** — On every commit that changes observable behaviour:
> 1. Bump version in `package.json`
> 2. Update version string in `server.js` (`/health` endpoint, startup log, file header)
> 3. Update version headers in `db.js`, `crypto.js`, `mailer.js`
> 4. Add `[x.y.z] — YYYY-MM-DD` entry to this file (sections: Added / Changed / Fixed / Security)
> 5. Update the README version badge
> 6. Commit format: `feat: description (vX.Y.Z)` or `fix: description (vX.Y.Z)`
> 7. Create GitHub release tag `vX.Y.Z`
>
> Semver rules: PATCH = bug fix / internal refactor. MINOR = new feature, new endpoint, backwards-compatible change. MAJOR = breaking change, auth model change, schema restructure.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [4.3.0] — 2026-04-05

### Changed
- Purged all remaining `howlr/` directory references from the workspace. The old `howlr/` directory (typo remnant from the original project name) was deleted after confirming it contained no unique content not already present in `hollr/`.
- Added thorough inline code comments to all four backend source files: `server.js`, `db.js`, `crypto.js`, `mailer.js`. Every function, middleware registration, and non-obvious code path now has a comment explaining what it does and why.

### Added
- Complete README.md rewrite: deeply educational architecture documentation covering auth, encryption, database design, API design, frontend architecture, infrastructure decisions, and a comprehensive lessons-learned section with 14 annotated incidents.
- Complete INSTALL.md rewrite: step-by-step self-hosting guide covering local development, Fly.io deployment, X OAuth configuration, SiteGround FTP deployment, custom domain setup, Resend domain verification, full environment variable reference, upgrade procedure, and a troubleshooting table.
- Complete CHANGELOG.md: full version history from v1.0.0 through v4.3.0 with Keep a Changelog format.

---

## [4.2.0] — 2026-04-03

### Added
- New landing page design by Paul Fleury: Fraunces serif typeface, HOLLER wordmark, redesigned hero section.
- `GET /api/settings` endpoint: returns current user's settings (notification email, PGP key, Resend config) for the settings modal.
- Settings modal fully rebuilt: notification email field, PGP key management (now actually functional), Resend sender configuration, all wired to backend endpoints.
- Full authentication pipeline wired end-to-end: magic link → session → dashboard flow tested and confirmed working across all supported browsers.
- Landing page updated to 10 languages in the new design.

### Fixed
- CNAME trap: `api.hollr.to` was pointing to `howlr-api.fly.dev` (the old, deleted app name). Updated CNAME record to `hollr-api.fly.dev`. This was a silent production outage — the API was running but unreachable via the custom domain.
- PGP tab in settings modal was invisible: the tab switcher JavaScript toggled `tab-key` and `tab-pin` but did not include `tab-pgp` in its list. Added `tab-pgp` to the switcher.
- `GET /api/settings` was missing: the settings modal tried to fetch current settings on open but the endpoint didn't exist. The modal silently showed empty fields.

### Changed
- Settings modal architecture: moved from a multi-step inline form to a tabbed modal with sections for Notifications, PIN, PGP, and Resend.
- Resend sender address (`RESEND_FROM`) is now configurable per-user in settings, overriding the global environment variable default.

---

## [4.1.0] — 2026-04-02

### Added
- Default PIN of `1234` assigned to all new users. `pin_is_default` column added to `users` table to track whether the user has changed their PIN.
- Force-change PIN flow: if `pin_is_default = 1` when the user opens settings, a "choose a new PIN" screen is shown before the settings panel.
- Forgot-PIN flow: `POST /api/auth/forgot-pin` sends a magic link that, when clicked, allows the user to set a new PIN. Returns `{ ok: true }` unconditionally to prevent email enumeration.
- `POST /api/settings/email` endpoint: allows users to update their notification email address.
- Email requirement for X users: when an X OAuth user has no email on record, the callback redirect includes `needsEmail=1`. The frontend displays an email collection modal.

### Fixed
- X OAuth users who authenticated without email could not receive magic links or notification emails. The `needsEmail` flow ensures email is collected before the user reaches the dashboard.
- `pin_hash` was null for new users, causing settings access to fail (no PIN to compare against). New users now get `bcrypt.hash('1234', 12)` inserted on account creation.

### Changed
- PIN validation in settings: now checks `pin_is_default` first. If true, forces PIN change before any settings are revealed.

---

## [4.0.0] — 2026-04-01

### Added
- **X OAuth 2.0 PKCE**: full RFC 7636 PKCE flow. `GET /api/auth/x` generates code_verifier/code_challenge, stores them in express-session, redirects to Twitter. `GET /api/auth/x/callback` verifies state, exchanges code with verifier, upserts user, creates session.
- **PGP end-to-end encryption**: users can set an OpenPGP public key in settings. When set, the sender's canvas loads OpenPGP.js from `esm.sh` (lazy, deferred) and encrypts the message body client-side before transmission. Server receives only ciphertext.
- **AES-256-GCM file encryption**: `POST /api/files/upload` accepts multipart file uploads via multer memoryStorage. Files are encrypted with a random per-file 32-byte key and 12-byte IV using AES-256-GCM. Only the `.enc` ciphertext is written to the Fly.io volume. Key and IV are returned to the client and never stored server-side.
- **`/decrypt` viewer**: static HTML page that reads `key`, `iv`, and `fileId` from the URL hash fragment, fetches raw encrypted bytes from `GET /api/files/raw/:fileId`, decrypts using SubtleCrypto AES-GCM, detects MIME type, and renders or downloads the result. Hash fragment is never sent to the server (RFC 3986 §3.5).
- **Optional Resend**: the app now starts and runs fully without `RESEND_API_KEY`. Without it, magic links and notification emails are logged to stdout. Per-user Resend credentials (stored AES-256-CBC encrypted in the DB) override the global key.
- **Runtime schema migrations**: db.js now runs a try/catch ALTER TABLE loop on every startup to apply new columns idempotently. Safe to run on any existing schema version.

### Fixed
- SQLite startup crash: `idx_users_x_id` was created before the `ALTER TABLE users ADD COLUMN x_id` migration. Reordered initialization so all ALTER TABLE migrations run before any CREATE INDEX statements that depend on new columns.
- `reply_to: null` caused Resend API 422 error. Now using conditional spread to omit `reply_to` from the payload entirely when no reply-to address is set.
- AES-GCM authTag byte-order mismatch: Node writes `[authTag][ciphertext]` to disk; SubtleCrypto expects `[ciphertext][authTag]`. The decrypt viewer now correctly re-orders bytes before calling `SubtleCrypto.decrypt`.

### Security
- Per-file random keys for all file attachments: compromise of one file's key reveals nothing about others.
- PKCE prevents authorization code interception attacks in X OAuth flow.
- `code_verifier` stored in express-session (server-side), not in browser storage — backend callback can access it; client-side storage cannot be read by the backend.

---

## [3.0.0] — 2026-03-30

### Added
- Complete backend rewrite: Node.js + Express + SQLite (better-sqlite3), replacing the PHP canvas.
- **Magic-link authentication**: `POST /api/auth/magic-link` generates UUID v4 token stored in `magic_links` table with 15-minute TTL and `used=0` flag. `GET /api/auth/verify` validates token atomically (sets `used=1` before creating session), creates session row, redirects with Bearer token.
- **Handle claiming**: `POST /api/user/handle` validates and claims a unique handle. `COLLATE NOCASE` on the `users.handle` column ensures case-insensitive uniqueness.
- **Pending handles**: new users get `__pending_xxxxxxxx` handle immediately on first auth, so the user row exists before onboarding completes. `handle.startsWith('__pending')` exposes null to frontend.
- **Fly.io deployment**: `fly.toml`, `Dockerfile`, and persistent volume at `/data`. SQLite database and `.enc` attachments stored on volume. Region: `cdg` (Paris).
- **WAL mode**: `PRAGMA journal_mode=WAL` enabled on startup. Readers no longer block writers.
- **Rate limiting**: `express-rate-limit` applied to auth routes (10/15min) and send route (5/min per IP).
- **`requireAuth` middleware**: validates Bearer token from Authorization header with a single JOIN query (users + sessions). Uses `unixepoch()` for TTL comparison.
- **Helmet.js**: security headers on all responses. CSP disabled to allow OpenPGP.js from esm.sh.
- **CORS**: dynamic origin function with production whitelist. Dev origins (`localhost:3000`, `localhost:5500`) added only in non-production mode.
- **`esc()` function**: HTML-escapes all user-generated content in email templates (prevents XSS in email clients).
- **AES-256-CBC encryption** for DB text secrets: PBKDF2 key derivation (100,000 iterations, per-value salt), `saltHex:ivHex:ciphertextHex` wire format in TEXT columns.
- **bcrypt for PINs**: cost factor 12 (~250ms). PINs gate the settings panel only, not account access.

### Changed
- Authentication model: from stateless PHP session tokens to stateful SQLite sessions with Bearer tokens.
- File storage: from PHP `move_uploaded_file` to Node multer + AES-256-GCM encrypt-before-write.
- Email: from direct SMTP to Resend REST API via Node `https.request()`.

### Security
- Git history cleaned: `git-filter-repo` used to remove `.env` (containing a live Resend API key) from all commits. Key rotated in Resend dashboard immediately after GitGuardian alert. `.env` added to `.gitignore`.
- All `howlr` → `hollr` typo fixes applied throughout codebase. The old typo in the Fly.io app name (`howlr-api`) was the root cause of the CNAME outage fixed in v4.2.0.
- No passwords stored — magic links and session tokens only.

---

## [2.0.0] — 2026-03-25

### Added
- **i18n system**: 10 languages (English, French, Spanish, Portuguese, German, Italian, Dutch, Polish, Japanese, Chinese). `STRINGS` object in `i18n.js` keyed by language code and string key. `data-i18n` attributes on HTML elements. `applyTranslations()` walks the DOM on load.
- Language auto-detection from `navigator.language`. Selected language persisted to `localStorage['hollr-lang']`.
- **Dark / light / system mode**: CSS custom properties (`--bg`, `--text`, `--accent`) on `:root` and `[data-theme="dark"]`. No-flash inline `<script>` in `<head>` reads `localStorage['hollr-theme']` and sets `data-theme` before first paint. System preference via `window.matchMedia('(prefers-color-scheme: dark)')` as fallback.
- **Flag strip in welcome modal**: visual language selector showing flag emoji and language name for all 10 supported languages.
- Theme toggle button in header: cycles dark → light → system.

### Changed
- All UI strings moved from hardcoded HTML text to `data-i18n` attributes wired to the STRINGS object.
- Landing page hero copy updated to reflect multi-language capability.

---

## [1.2.2] — 2026-03-22

### Added
- Freeform contact field on the canvas: senders can optionally provide a contact method (email, phone, social handle, or anything). Field is plain text, no validation. Included in the notification email to the recipient.

---

## [1.2.1] — 2026-03-21

### Fixed
- Page `<title>` still showed "Canvas" instead of "hollr — send a message". Updated all HTML `<title>` tags.
- Canvas submit returned empty JSON (`{}`) on success instead of `{ ok: true, messageId: "..." }`. Fixed the Express `res.json()` call in the send route.
- "Sending..." button state persisted after a failed send (no spinner reset on error). Added `finally` block to reset button text and disabled state after any outcome.

---

## [1.2.0] — 2026-03-20

### Added
- Deep inline code comments on all source files. Every function, route handler, and non-obvious expression now has a comment.
- Lessons-learned section in README: first version of the annotated incident log (expanded significantly in v4.3.0).

---

## [1.1.0] — 2026-03-19

### Added
- README badges: version, license, Node version, platform.
- Semantic versioning adopted. Version string added to `package.json`.
- Versioning guideline documented in README as a permanent project rule.

---

## [1.0.0] — 2026-04-02

### Added
- Initial release: PHP canvas for Paul Fleury at `to.paulfleury.com`.
- Single canvas page: recipient-specific URL, timed distraction-free send experience.
- File upload: PHP `move_uploaded_file` to a server directory. Files served via direct URL.
- Voice recording: Web MediaRecorder API, blob uploaded as multipart form data.
- Transactional email via Resend REST API: notification email sent to Paul on each message.
- Static HTML/CSS/JS frontend hosted on SiteGround.
- No authentication: any visitor could send; recipient (Paul) was fixed.
