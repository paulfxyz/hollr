# Installing hollr

This guide covers three deployment scenarios:

1. **Full self-host** — Fly.io backend + any Apache/Nginx frontend
2. **Local development** — backend on your machine, frontend served statically
3. **Frontend only** — just deploy the static HTML to any web host

---

## Requirements

| Component | Minimum |
|---|---|
| Node.js | 20+ |
| npm | 9+ |
| Fly.io CLI (`flyctl`) | latest |
| A [Resend](https://resend.com) account | free tier works |
| A domain (optional) | for custom `From:` email address |

---

## 1 — Local development

```bash
# Clone the repo
git clone https://github.com/paulfxyz/hollr.git
cd hollr/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — at minimum set ENCRYPTION_SECRET and PLATFORM_RESEND_KEY

# Generate secrets
echo "ENCRYPTION_SECRET=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"

# Start the backend
npm run dev
# → listening on http://localhost:3000

# Health check
curl http://localhost:3000/health
# → {"ok":true,"version":"4.3.0"}
```

Open `landing/index.html` in your browser (or serve it with any static server):

```bash
cd ../landing
python3 -m http.server 8080
# → http://localhost:8080
```

> **Note:** The frontend makes API calls to `hollr-api.fly.dev` by default.
> For local development, change `API_BASE` in each HTML file to `http://localhost:3000`.

---

## 2 — Deploy backend to Fly.io

### 2a. Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login
```

### 2b. Create the app and persistent volume

```bash
cd hollr/backend

# Create the app (pick a name — it becomes your-app.fly.dev)
flyctl apps create hollr-api

# Create a 3 GB persistent volume for SQLite + uploads
# cdg = Paris (change to a region near you: sjc, iad, lhr, …)
flyctl volumes create hollr_data --region cdg --size 3
```

### 2c. Set secrets

```bash
flyctl secrets set \
  ENCRYPTION_SECRET="$(openssl rand -hex 32)" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  PLATFORM_RESEND_KEY="re_your_resend_key_here" \
  PLATFORM_FROM_EMAIL="hollr <yo@yourdomain.com>" \
  FRONTEND_URL="https://yourdomain.com" \
  BASE_URL="https://hollr-api.fly.dev" \
  ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com" \
  NODE_ENV="production"
```

> **ENCRYPTION_SECRET** must be a 64-character hex string.
> If you ever change it, all existing encrypted data (Resend keys, tokens) becomes unreadable.
> Store it somewhere safe.

### 2d. Configure X OAuth (optional)

1. Create an app at [developer.twitter.com](https://developer.twitter.com)
2. Set the callback URL to: `https://hollr-api.fly.dev/api/auth/x/callback`
3. Set these secrets:

```bash
flyctl secrets set \
  X_CLIENT_ID="your_x_client_id" \
  X_CLIENT_SECRET="your_x_client_secret"
```

Without these, X login will return a friendly 503 error. Email login still works.

### 2e. Deploy

```bash
flyctl deploy --remote-only -a hollr-api
```

Verify:

```bash
curl https://hollr-api.fly.dev/health
# → {"ok":true,"version":"4.3.0"}
```

### 2f. Custom domain (api.yourdomain.com)

```bash
flyctl certs create api.yourdomain.com -a hollr-api
flyctl certs setup  api.yourdomain.com -a hollr-api
# Follow the DNS instructions shown
```

Add a CNAME in your DNS:

```
CNAME  api  →  <shown by flyctl certs setup>.fly.dev
```

> ⚠️ **Important:** The CNAME target is specific to your app and looks like
> `xxxxxxx.hollr-api.fly.dev`, NOT `hollr-api.fly.dev`. Get the exact value
> from `flyctl certs setup`.

---

## 3 — Deploy frontend to Apache/SiteGround

The frontend is static HTML — no build step needed.

```bash
# Using lftp (replace with your host credentials)
FTPPASS='yourpassword'
lftp -u "ftp@yourdomain.com,$FTPPASS" ftp.yourdomain.com << 'LFTP'
  set ftp:ssl-allow no
  set net:timeout 30
  cd public_html
  mirror --reverse --delete --verbose ./landing/ ./
  quit
LFTP
```

Required files on the server:

```
public_html/
├── .htaccess            ← required for SPA routing
├── index.html           ← landing page
├── auth/
│   └── verify.html      ← auth + onboarding
├── handle/
│   └── index.html       ← per-handle canvas
└── decrypt/
    └── index.html       ← in-browser decrypt viewer
```

The `.htaccess` routes `/:handle` → `handle/index.html` and `/decrypt` → `decrypt/index.html`.
Without it, direct URL access returns 404.

> **Nginx equivalent:**
> ```nginx
> location /auth/verify  { try_files $uri /auth/verify.html; }
> location /decrypt      { try_files $uri /decrypt/index.html; }
> location ~^/[^/]+/?$  { try_files $uri /handle/index.html; }
> ```

---

## 4 — Update the API base URL in the frontend

By default the frontend calls `hollr-api.fly.dev`. If you renamed your Fly.io app or set up a custom domain, update `API_BASE` / `API` in each HTML file:

| File | Variable | Default |
|---|---|---|
| `landing/index.html` | `const API_BASE = '…'` (in X button handler) | `https://hollr-api.fly.dev` |
| `landing/auth/verify.html` | `const API = '…'` | `https://hollr-api.fly.dev` |
| `landing/handle/index.html` | `var API_BASE = '…'` | `https://hollr-api.fly.dev` |

---

## 5 — Environment variable reference

See [README.md → Environment variables](README.md#environment-variables) for the full table.

A minimal `.env` for local development:

```env
PORT=3000
DATA_DIR=./data
ENCRYPTION_SECRET=<64-char hex>
SESSION_SECRET=<random string>
PLATFORM_RESEND_KEY=re_xxx
PLATFORM_FROM_EMAIL=hollr <yo@hollr.to>
FRONTEND_URL=http://localhost:8080
BASE_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:8080
NODE_ENV=development
```

---

## 6 — Upgrading

```bash
git pull origin main
cd backend
npm install       # picks up any new dependencies
flyctl deploy --remote-only -a hollr-api
```

Database migrations run automatically on startup — no manual SQL needed.

---

## 7 — Resend setup

1. Create a free account at [resend.com](https://resend.com)
2. Add and verify your domain (e.g. `yourdomain.com`) under **Domains**
3. Create an API key under **API Keys → Create API Key** (full access)
4. Set `PLATFORM_RESEND_KEY` to this key in your Fly.io secrets
5. Set `PLATFORM_FROM_EMAIL` to an address on your verified domain

Users can optionally supply their own Resend key in the Settings modal.
If they don't, all message notifications go through the platform key.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Network error` in browser | `API_BASE` points to wrong URL | Check `api.hollr.to` CNAME or update to `hollr-api.fly.dev` |
| Magic link not arriving | `PLATFORM_RESEND_KEY` not set or wrong | Run `flyctl secrets list` and verify |
| `ENCRYPTION_SECRET not set` on startup | Secret not deployed | `flyctl secrets set ENCRYPTION_SECRET=…` |
| Upload 500 error | `/data` volume not mounted | Check `fly.toml` `[mounts]` section and `DATA_DIR` env var |
| X OAuth `state_mismatch` | Express session not persisting across redirect | Ensure `SESSION_SECRET` is set and `NODE_ENV=production` |
| SQLite `no such column` on startup | Old migration order bug | Update to v4.3.0 which fixes index creation order |
