# hollr.to — Self-Hosting Guide

This guide covers everything needed to run a fully functional instance of hollr.to: local development, backend deployment to Fly.io, frontend deployment to Apache/SiteGround, custom domain configuration, and transactional email via Resend. Read top to bottom on first setup; use individual sections as reference later.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Deploy Backend to Fly.io](#deploy-backend-to-flyio)
4. [X OAuth Setup](#x-oauth-setup)
5. [Deploy Frontend to Apache / SiteGround](#deploy-frontend-to-apache--siteground)
6. [Update API_BASE in Frontend Files](#update-api_base-in-frontend-files)
7. [Custom Domain for the API](#custom-domain-for-the-api)
8. [Resend Domain Verification](#resend-domain-verification)
9. [Environment Variable Reference](#environment-variable-reference)
10. [Upgrading](#upgrading)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Requirement | Minimum Version | Notes |
|---|---|---|
| Node.js | 20 LTS | Use `nvm` or the official installer. `better-sqlite3` requires a compatible native build toolchain. |
| npm | 9 | Comes with Node 20. |
| flyctl | Latest | The Fly.io CLI. Install at [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/). |
| Git | Any | For cloning the repo and managing versions. |
| Resend account | — | Free tier: 100 emails/day. Optional — the app works without it (no notification emails). |
| Domain name | — | Optional. You can run entirely on `*.fly.dev` and a SiteGround subdomain. |
| FTP client (lftp) | Any | For frontend deployment. `brew install lftp` on macOS; `apt install lftp` on Linux. |

**Note on `better-sqlite3`:** This package includes a native Node.js addon compiled with `node-gyp`. On macOS, install Xcode Command Line Tools (`xcode-select --install`). On Linux, install `python3`, `make`, and `g++` (`apt install build-essential`). On Windows, use WSL2.

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/paulfxyz/hollr.git
cd hollr
```

### 2. Install dependencies

```bash
npm install
```

This compiles the `better-sqlite3` native addon. It will take 30–60 seconds on first install.

### 3. Create your `.env` file

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Minimum `.env` for local development (no X OAuth, no email):

```env
NODE_ENV=development
PORT=3001
SESSION_SECRET=any-long-random-string-here
MASTER_SECRET=another-long-random-string-here
```

Full `.env` with all features:

```env
# App
NODE_ENV=development
PORT=3001

# Session (express-session)
SESSION_SECRET=replace-with-64-random-chars

# Encryption master secret (AES-256-CBC for DB values)
MASTER_SECRET=replace-with-64-random-chars

# X / Twitter OAuth 2.0
X_CLIENT_ID=your-twitter-client-id
X_CLIENT_SECRET=your-twitter-client-secret
X_CALLBACK_URL=http://localhost:3001/api/auth/x/callback

# Resend (transactional email)
RESEND_API_KEY=re_your_key_here
RESEND_FROM=hollr <hello@yourdomain.com>
```

**Generating secrets:** Use Node.js directly:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this twice — once for `SESSION_SECRET`, once for `MASTER_SECRET`. These values must be consistent across restarts (changing `MASTER_SECRET` invalidates all encrypted DB values).

### 4. Start the development server

```bash
npm run dev
```

This starts the Express server with `nodemon` (file watching, auto-restart on changes). The server binds to `http://localhost:3001` (or whatever `PORT` you set).

### 5. Verify the server is running

```bash
curl http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "version": "4.3.0",
  "uptime": 3
}
```

The SQLite database is created automatically at `./data/db.db` on first startup. All schema migrations run automatically.

### 6. Test a local magic-link flow (no Resend required)

Without Resend configured, the server logs the magic link to stdout instead of sending an email. Watch the terminal output when you call:

```bash
curl -X POST http://localhost:3001/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

The response will be `{"ok":true}` and the magic link will be printed to the console.

---

## Deploy Backend to Fly.io

### 1. Install and authenticate flyctl

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
# Add ~/.fly/bin to PATH — restart your shell or:
export PATH="$HOME/.fly/bin:$PATH"

# Authenticate
flyctl auth login
```

### 2. Create the Fly.io app

From the project root (where `fly.toml` lives):

```bash
flyctl apps create hollr-api
```

Choose a unique name — `hollr-api` is used in this guide. The app name determines your default hostname: `hollr-api.fly.dev`.

### 3. Create a persistent volume

The volume stores the SQLite database and encrypted file attachments:

```bash
flyctl volumes create hollr_data \
  --app hollr-api \
  --region cdg \
  --size 3
```

- `--region cdg`: Paris. Choose the region closest to your users. Run `flyctl platform regions` for the full list.
- `--size 3`: 3 GB. The free tier allows up to 3 GB of volume storage.

Confirm the volume is listed:

```bash
flyctl volumes list --app hollr-api
```

### 4. Set secrets (environment variables)

Fly.io secrets are encrypted environment variables injected at runtime. Set them one at a time or all at once:

```bash
flyctl secrets set \
  NODE_ENV=production \
  SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  MASTER_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  --app hollr-api
```

If you have X OAuth credentials:

```bash
flyctl secrets set \
  X_CLIENT_ID=your-client-id \
  X_CLIENT_SECRET=your-client-secret \
  X_CALLBACK_URL=https://hollr-api.fly.dev/api/auth/x/callback \
  --app hollr-api
```

If you have Resend credentials:

```bash
flyctl secrets set \
  RESEND_API_KEY=re_your_key_here \
  RESEND_FROM="hollr <hello@yourdomain.com>" \
  --app hollr-api
```

View currently set secrets (names only — values are never shown):

```bash
flyctl secrets list --app hollr-api
```

### 5. Review `fly.toml`

The `fly.toml` in the project root should look like this. Adjust the `app` name if you chose a different name:

```toml
app = "hollr-api"
primary_region = "cdg"

[build]

[env]
  PORT = "3001"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[mounts]]
  source = "hollr_data"
  destination = "/data"

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1

[checks]
  [checks.health]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    port = 3001
    timeout = "5s"
    type = "http"
```

### 6. Deploy

```bash
flyctl deploy --remote-only --app hollr-api
```

`--remote-only` builds the Docker image on Fly.io's build infrastructure rather than locally. This avoids arm64/amd64 architecture mismatches (common on Apple Silicon Macs).

The deploy process:
1. Uploads your source code to Fly.io's builders
2. Runs `docker build` on their servers (amd64)
3. Pushes the image to Fly.io's registry
4. Starts a new VM with the image and the attached volume
5. Waits for `/health` to return 200 before completing
6. Shifts traffic from the old VM to the new one

### 7. Verify the deployment

```bash
curl https://hollr-api.fly.dev/health
```

Expected:

```json
{
  "status": "ok",
  "version": "4.3.0",
  "uptime": 12
}
```

View live logs:

```bash
flyctl logs --app hollr-api
```

---

## X OAuth Setup

### 1. Create a Twitter Developer App

1. Go to [developer.twitter.com/en/portal/dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Create a new project and app
3. Set the app's **User authentication settings**:
   - OAuth 2.0: **Enabled**
   - App type: **Web App, Automated App, or Bot**
   - Callback URI: `https://hollr-api.fly.dev/api/auth/x/callback`
   - Website URL: `https://hollr.to` (or your domain)
4. Request **OAuth 2.0** scopes: `tweet.read`, `users.read`, `offline.access`

### 2. Get your credentials

In the app's "Keys and tokens" tab:
- Copy **Client ID** → `X_CLIENT_ID`
- Generate and copy **Client Secret** → `X_CLIENT_SECRET`

### 3. Set the callback URL

The callback URL must exactly match what's registered in the Twitter Developer Portal. If you're using a custom domain for the API, use that URL:

```
https://api.yourdomain.com/api/auth/x/callback
```

If you're using the default Fly.io hostname:

```
https://hollr-api.fly.dev/api/auth/x/callback
```

Update the secret on Fly.io if the URL changes:

```bash
flyctl secrets set \
  X_CALLBACK_URL=https://api.yourdomain.com/api/auth/x/callback \
  --app hollr-api
```

### 4. Re-deploy after setting secrets

Fly.io restarts the app automatically when secrets are updated. Verify with:

```bash
flyctl logs --app hollr-api --tail
```

---

## Deploy Frontend to Apache / SiteGround

### 1. File structure

The frontend directory contains:

```
frontend/
├── index.html        # Landing page (CSS+JS inlined by build script)
├── canvas.html       # The send-message canvas
├── auth/
│   ├── verify.html   # Auth callback page
│   └── magic.html    # Magic-link sent confirmation
├── dashboard.html    # Logged-in user dashboard
├── settings.html     # Settings modal page
├── onboarding.html   # Handle selection
├── decrypt.html      # In-browser file decrypt viewer
├── .htaccess         # Apache URL rewriting rules
├── style.css         # Global styles
└── js/
    ├── config.js     # API_BASE and other constants
    ├── i18n.js       # STRINGS translations object
    └── ...
```

### 2. Update API_BASE before deploying

See the [Update API_BASE in Frontend Files](#update-api_base-in-frontend-files) section below.

### 3. Deploy via lftp

```bash
lftp -e "
  set ftp:ssl-allow no;
  set net:timeout 30;
  open -u YOUR_FTP_USERNAME,YOUR_FTP_PASSWORD ftp.siteground.com;
  mirror --reverse --delete ./frontend/ /public_html/;
  bye
"
```

Replace:
- `YOUR_FTP_USERNAME` — your SiteGround FTP username
- `YOUR_FTP_PASSWORD` — your SiteGround FTP password
- `ftp.siteground.com` — your SiteGround FTP host (found in the SiteGround control panel under FTP Accounts)
- `/public_html/` — the root of your domain on SiteGround

**`set ftp:ssl-allow no`:** Disables TLS negotiation on plain FTP. Without this, lftp may hang indefinitely waiting for TLS handshake with some SiteGround servers.

**`--delete`:** Removes remote files not present locally. Omit this flag on first deploy if you want to keep any existing files.

### 4. Verify the `.htaccess` is active

Visit your domain in a browser and navigate to `yourdomain.com/nonexistentpage`. If you see a 404 with your custom page (or a blank canvas page), mod_rewrite is working. If you see Apache's default 404, `.htaccess` is not being applied — check that `AllowOverride All` is enabled in the SiteGround vhost config (contact SiteGround support to confirm).

---

## Update API_BASE in Frontend Files

Every frontend file that makes API calls reads from a `config.js` constant. Update this before deploying:

| File | Variable | Default (dev) | Production value |
|---|---|---|---|
| `js/config.js` | `API_BASE` | `http://localhost:3001` | `https://hollr-api.fly.dev` or `https://api.yourdomain.com` |

Edit `js/config.js`:

```javascript
// js/config.js
const API_BASE = 'https://hollr-api.fly.dev';
// or, with a custom domain:
// const API_BASE = 'https://api.hollr.to';
```

Some pages may also hardcode `API_BASE` locally (for standalone files). Grep for any remaining occurrences:

```bash
grep -r "localhost:3001" frontend/
```

Replace all occurrences with your production API URL before deploying.

---

## Custom Domain for the API

### 1. Add a certificate to your Fly.io app

```bash
flyctl certs add api.yourdomain.com --app hollr-api
```

Fly.io will provision a Let's Encrypt certificate and output a validation token.

### 2. Add a CNAME record

In your DNS provider, add:

| Type | Name | Value |
|---|---|---|
| CNAME | `api` | `hollr-api.fly.dev` |

**The CNAME trap:** The CNAME target must exactly match your Fly.io app's `.fly.dev` hostname. If you ever rename or recreate the app, update this CNAME immediately. The old hostname disappears instantly when the app is renamed — the CNAME will return `NXDOMAIN` until updated.

**The `gmrgw5w` prefix:** When Fly.io provisions your certificate, it may ask you to add a specific CNAME for certificate validation:

| Type | Name | Value |
|---|---|---|
| CNAME | `_acme-challenge.api` | `api.yourdomain.com.gmrgw5w.flydns.net` |

The random prefix (`gmrgw5w` or similar) is unique to your app — Fly.io generates it. Add exactly what `flyctl certs add` outputs, not what this guide shows.

### 3. Verify certificate status

```bash
flyctl certs show api.yourdomain.com --app hollr-api
```

Wait for the status to show `Issued` (usually 2–5 minutes after DNS propagates). Test:

```bash
curl https://api.yourdomain.com/health
```

### 4. Update X OAuth callback URL

If you're using X OAuth, update the callback URL secret to use your custom domain:

```bash
flyctl secrets set \
  X_CALLBACK_URL=https://api.yourdomain.com/api/auth/x/callback \
  --app hollr-api
```

Also update the callback URL in the Twitter Developer Portal to match.

---

## Resend Domain Verification

Sending emails from `hello@yourdomain.com` via Resend requires proving you control the domain.

### 1. Add your domain in Resend

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click "Add domain" → enter `yourdomain.com`
3. Resend shows you DNS records to add

### 2. Add the DNS records

Resend requires two records (example values — use what Resend provides):

| Type | Name | Value |
|---|---|---|
| TXT | `resend._domainkey.yourdomain.com` | `v=DKIM1; k=rsa; p=MIGfMA...` |
| MX | `send.yourdomain.com` | `feedback-smtp.us-east-1.amazonses.com` |

In some configurations, Resend provides a CNAME instead of a TXT record. Add exactly what the dashboard shows.

### 3. Wait for verification

DNS propagation takes 5–30 minutes. The Resend dashboard shows a green checkmark when the domain is verified. You can also check propagation status:

```bash
dig TXT resend._domainkey.yourdomain.com
```

### 4. Test email delivery

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "hollr <hello@yourdomain.com>",
    "to": ["you@example.com"],
    "subject": "Test",
    "html": "<p>Test email from hollr</p>"
  }'
```

A `{"id":"..."}` response means it was accepted. Check your inbox (and spam folder) for delivery.

---

## Environment Variable Reference

All environment variables are set as Fly.io secrets in production. Locally, they live in `.env`.

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | `production` or `development`. Controls CORS origins, error verbosity, and dev-only features. | `production` |
| `PORT` | No | Port the Express server listens on. Default: `3001`. Fly.io injects this automatically. | `3001` |
| `SESSION_SECRET` | Yes | Secret for signing `express-session` cookies. Must be long and random. Change invalidates all active OAuth sessions. | `a3f1b2...64 hex chars...` |
| `MASTER_SECRET` | Yes | Master key for AES-256-CBC encryption of DB values (Resend API key, sender address). Change invalidates all encrypted DB values. | `d9c7e4...64 hex chars...` |
| `X_CLIENT_ID` | No | Twitter OAuth 2.0 Client ID. Required only if X login is enabled. | `abc123XYZ...` |
| `X_CLIENT_SECRET` | No | Twitter OAuth 2.0 Client Secret. Keep this private — never commit it. | `xyzSecretABC...` |
| `X_CALLBACK_URL` | No | Full URL of the OAuth callback endpoint. Must match Twitter Developer Portal exactly. | `https://hollr-api.fly.dev/api/auth/x/callback` |
| `RESEND_API_KEY` | No | Resend API key (`re_...`). Required for sending magic links and notifications. Without it, links are logged to console. | `re_abc123...` |
| `RESEND_FROM` | No | Verified sender address for Resend emails. Must be on a domain verified in the Resend dashboard. | `hollr <hello@hollr.to>` |

**Notes:**
- Variables marked "No" in the Required column are optional — the app starts and runs without them but with reduced functionality.
- `RESEND_API_KEY` and `RESEND_FROM` can also be set per-user in the settings panel (they override the global defaults for that user's notifications). The environment variables provide the default for the platform owner's notifications.
- Never commit real values to git. Use `.env.example` with placeholder values for documentation.

---

## Upgrading

Upgrading hollr is a three-step process. Schema migrations run automatically on startup — no manual SQL required.

### 1. Pull the latest code

```bash
git pull origin main
```

### 2. Install any new dependencies

```bash
npm install
```

Run this even if `package.json` doesn't appear to have changed — a patch release may update a dependency.

### 3. Deploy

```bash
flyctl deploy --remote-only --app hollr-api
```

Fly.io will:
1. Build the new image
2. Start a new VM with the new image, attached to the same volume
3. Run schema migrations on startup (the try/catch ALTER TABLE loop)
4. Shift traffic when the health check passes

**If migration fails:** Check `flyctl logs --app hollr-api` immediately. The most common cause is an ordering issue in the migration array (see the [SQLite startup crash lesson](README.md#-sqlite-startup-crash---index-before-column) in the README).

**Rolling back:** Fly.io keeps previous image versions. To roll back:

```bash
flyctl releases list --app hollr-api
flyctl deploy --image <previous-image-id> --app hollr-api
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `curl https://hollr-api.fly.dev/health` → connection refused | App not running or health check failing | `flyctl logs --app hollr-api` to diagnose; `flyctl status --app hollr-api` to check machine state |
| `curl https://api.yourdomain.com/health` → DNS error | CNAME not set or pointing to wrong hostname | `dig CNAME api.yourdomain.com` — verify CNAME target matches `hollr-api.fly.dev` |
| Frontend gets CORS errors in browser | `API_BASE` in frontend pointing to wrong URL, or origin not in CORS whitelist | Check `js/config.js`, check backend CORS config for correct production origins |
| Magic links not arriving in email | `RESEND_API_KEY` not set, or sender domain not verified | Check `flyctl secrets list`; check Resend dashboard for domain verification status and send logs |
| Resend returns 422 | Sender domain not verified, or `RESEND_FROM` address format wrong | Verify domain in Resend dashboard; ensure `RESEND_FROM` is `Name <user@verified-domain.com>` |
| X OAuth login fails with "state mismatch" | `SESSION_SECRET` not set, or session cookie not being sent cross-origin | Ensure `SESSION_SECRET` is set as a Fly.io secret; ensure frontend is sending `credentials: 'include'` on OAuth initiation |
| X OAuth callback returns 401 from Twitter | `X_CALLBACK_URL` doesn't match what's registered in Twitter Developer Portal | Update either the Fly.io secret or the Twitter app's callback URL to match exactly |
| File upload succeeds but decrypt page fails | `MASTER_SECRET` changed between upload and decrypt, or URL hash was truncated | Never change `MASTER_SECRET` after files are uploaded; check that the full URL hash survived copy-paste |
| `better-sqlite3` fails to compile on `npm install` | Missing native build tools | macOS: `xcode-select --install`; Linux: `apt install build-essential python3`; Windows: use WSL2 |
| `flyctl: command not found` after install | `~/.fly/bin` not in PATH | `export PATH="$HOME/.fly/bin:$PATH"` then restart shell, or call `~/.fly/bin/flyctl` directly |
| App crashes on startup with "no such column" | Index created before ALTER TABLE migration adds the column | Check migration ordering in `db.js` — all ALTER TABLE migrations must run before any CREATE INDEX that references new columns |
| Settings panel PGP tab not visible | Tab switcher JS not updated to include `tab-pgp` | Check `settings.html` tab switcher function — ensure all tab names are in the array |
| `reply_to: null` causes email failure | Passing null `reply_to` to Resend API | Use conditional spread: `...(replyTo ? { reply_to: replyTo } : {})` |
| Decryption fails in browser with DOMException | AES-GCM authTag byte order mismatch (Node vs SubtleCrypto) | Verify decrypt viewer re-orders bytes: fetch `[authTag][ciphertext]` → pass `[ciphertext][authTag]` to SubtleCrypto |
| Auth token missing after page navigation | Using `localStorage` instead of `sessionStorage` | Auth token must be in `sessionStorage` — check `js/auth.js` |
