/**
 * server.js — hollr.to API Backend (v5.2.1)
 *
 * Routes overview
 * ───────────────
 *   GET  /health                       — health check
 *
 *   POST /api/auth/magic-link          — request email magic link
 *   GET  /api/auth/verify/:token       — verify magic link, create session
 *   GET  /api/auth/x                   — start X (Twitter) OAuth flow
 *   GET  /api/auth/x/callback          — X OAuth callback
 *   POST /api/auth/forgot-pin          — send PIN reset magic link to email on file
 *   POST /api/auth/logout              — destroy session
 *   GET  /api/me                       — get authenticated user profile
 *
 *   POST /api/handle/check             — check handle availability
 *   POST /api/handle/claim             — claim handle during onboarding
 *
 *   POST /api/settings                 — update Resend key, from_email, email, PGP key
 *   POST /api/settings/change-pin      — change PIN (clears default flag)
 *   POST /api/settings/email           — update contact email (requires PIN)
 *
 *   GET  /api/profile/:handle          — public profile (for canvas)
 *   POST /api/send/:handle             — send message to handle owner
 *   POST /api/upload/:handle           — upload encrypted file/voice
 *   GET  /api/decrypt/:handle/:file    — serve encrypted bytes for client-side decrypt
 *
 * v4.3.0 additions
 * ────────────────
 *   • Default PIN is 1234. First settings open forces a PIN change.
 *   • Settings are always locked by PIN (no longer separate "setup" flow).
 *   • X-registered users must provide an email (for PIN reset + notifications).
 *   • POST /api/auth/forgot-pin sends magic link to email on file.
 *   • POST /api/settings/email lets users update their contact email.
 *
 * Auth: Bearer session token in Authorization header.
 *
 * Environment variables (see .env.example)
 * ─────────────────────────────────────────
 *   PORT                  — HTTP port (default 3000)
 *   DATA_DIR              — path for SQLite + uploads (default ./data)
 *   ENCRYPTION_SECRET     — server-side AES-256 secret
 *   PLATFORM_RESEND_KEY   — Resend key for platform emails (magic links)
 *   PLATFORM_FROM_EMAIL   — from address for magic links
 *   BASE_URL              — public URL of this server
 *   FRONTEND_URL          — public URL of the frontend
 *   ALLOWED_ORIGINS       — extra CORS origins (comma-separated)
 *   X_CLIENT_ID           — Twitter/X OAuth 2.0 client ID
 *   X_CLIENT_SECRET       — Twitter/X OAuth 2.0 client secret
 *   SESSION_SECRET        — express-session secret (for OAuth state)
 */

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const session   = require('express-session');
const crypto    = require('crypto');
const path      = require('path');
const fs        = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt    = require('bcryptjs');
const multer    = require('multer');

const db                           = require('./db');
const { encrypt, decrypt,
        encryptBuffer, decryptBuffer } = require('./crypto');
const { sendMagicLink, forwardMessage } = require('./mailer');

// ── Upload directory ─────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// We encrypt the file in memory then write — so we use memoryStorage for upload
const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// ── Express setup ────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
  'https://hollr.to',
  'https://www.hollr.to',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5500']
      : []),
];

// Trust Fly.io's proxy layer so express-rate-limit can read the real client IP
// from X-Forwarded-For headers. Without this, rate limiting throws a ValidationError
// and the app crashes on every request behind a reverse proxy.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Express session — needed for OAuth state persistence during the X OAuth flow.
// SESSION_SECRET must be set in env on Fly.io; without it a random fallback is used
// per-process and all in-flight OAuth sessions are lost on every restart.
app.use(session({
  secret:            process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 10 * 60 * 1000 },
}));

// ── Rate limiting ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10,  message: { error: 'Too many requests' } });
const sendLimiter = rateLimit({ windowMs: 60 * 1000,      max: 5,   message: { error: 'Too many requests' } });

// ── Auth middleware ──────────────────────────────────────────────────────────

/**
 * requireAuth — injects req.user from a valid Bearer session token.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const sess = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at,
           u.email, u.handle, u.resend_key, u.pin_hash, u.from_email,
           u.pgp_public_key, u.x_id, u.x_username, u.pin_is_default, u.display_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > unixepoch()
  `).get(token);

  if (!sess) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user  = sess;
  req.token = token;
  next();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_PIN = '1234';
const HANDLE_RE   = /^[a-zA-Z0-9_-]{2,30}$/;
const RESERVED    = new Set([
  'admin','api','app','www','mail','root','support','help','about',
  'legal','status','cdn','static','uploads','hollr','yo','auth',
  'settings','profile','explore','discover','decrypt',
]);

function isValidHandle(h) {
  return HANDLE_RE.test(h) && !RESERVED.has(h.toLowerCase());
}

function sessionToken() { return crypto.randomBytes(32).toString('hex'); }

function createSession(userId) {
  const token     = sessionToken();
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days
  db.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);
  return token;
}

// ── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, version: '5.2.1' }));

// ── Email magic link auth ────────────────────────────────────────────────────

/**
 * POST /api/auth/magic-link
 * Body: { email }
 * Sends a one-time login link. Works for both new and returning users.
 */
app.post('/api/auth/magic-link', authLimiter, async (req, res) => {
  const { email, handle } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Validate handle format if provided
  let pendingHandle = null;
  if (handle) {
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(handle)) {
      return res.status(400).json({ error: 'Invalid handle format' });
    }
    // Security: reject immediately if handle is already taken.
    // This prevents sending magic links that would let someone land on
    // onboarding with a pre-filled handle they can't actually claim.
    const takenByOther = db.prepare(
      'SELECT id FROM users WHERE handle = ? COLLATE NOCASE AND handle NOT LIKE \'__pending_%\''
    ).get(handle);
    if (takenByOther) {
      return res.status(409).json({
        error: `hollr.to/${handle} is already taken.`,
        code:  'handle_taken',
      });
    }
    pendingHandle = handle;
  }

  const token     = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60; // 15 min

  db.prepare('DELETE FROM magic_links WHERE email = ?').run(email);
  // Use pending_handle column if it exists (v4.5.1+), fall back gracefully for older DBs
  try {
    db.prepare('INSERT INTO magic_links (email, token, expires_at, pending_handle) VALUES (?, ?, ?, ?)').run(email, token, expiresAt, pendingHandle);
  } catch {
    db.prepare('INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)').run(email, token, expiresAt);
  }

  const frontendUrl = process.env.FRONTEND_URL || 'https://hollr.to';
  const link = `${frontendUrl}/auth/verify?token=${token}`;

  try {
    await sendMagicLink(email, link);
    res.json({ ok: true });
  } catch (err) {
    console.error('Magic link email failed:', err.message);
    res.status(500).json({ error: 'Failed to send login email' });
  }
});

/**
 * GET /api/auth/verify/:token
 * Validates magic link. Returns { session_token, is_new_user, user? }.
 */
app.get('/api/auth/verify/:token', (req, res) => {
  const row = db.prepare(`
    SELECT * FROM magic_links
    WHERE token = ? AND expires_at > unixepoch() AND used = 0
  `).get(req.params.token);

  if (!row) return res.status(400).json({ error: 'Invalid or expired link' });
  db.prepare('UPDATE magic_links SET used = 1 WHERE id = ?').run(row.id);

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(row.email);

  if (user) {
    // If user came via forgot-pin link, reset the default pin flag so they
    // can set a fresh PIN through the normal change-pin flow on next settings open
    if (row.is_pin_reset) {
      db.prepare('UPDATE users SET pin_is_default = 1, pin_hash = ? WHERE id = ?')
        .run(bcrypt.hashSync(DEFAULT_PIN, 12), user.id);
    }
    const token = createSession(user.id);
    return res.json({
      ok:             true,
      session_token:  token,
      is_new_user:    false,
      is_pin_reset:   !!row.is_pin_reset,
      // pending_handle is only useful for new users — returning users already have a handle
      pending_handle: user.handle?.startsWith('__pending') ? (row.pending_handle || null) : null,
      user: {
        email:           user.email,
        handle:          user.handle?.startsWith('__pending') ? null : user.handle,
        has_api_key:     !!user.resend_key,
        has_pgp:         !!user.pgp_public_key,
        pin_is_default:  user.pin_is_default ? true : false,
      },
    });
  }

  // New user — create a pending account with default PIN
  const pinHash = bcrypt.hashSync(DEFAULT_PIN, 12);
  const inserted = db.prepare(`
    INSERT INTO users (email, handle, pin_hash, pin_is_default) VALUES (?, ?, ?, 1)
  `).run(row.email, `__pending_${uuidv4().slice(0, 8)}`, pinHash);

  const token = createSession(inserted.lastInsertRowid);
  res.json({
    ok:             true,
    session_token:  token,
    is_new_user:    true,
    // Return the handle they chose on the landing page so the onboarding
    // form can be pre-filled — this survives the email-tab context switch
    pending_handle: row.pending_handle || null,
    user: { email: row.email, handle: null, has_api_key: false, has_pgp: false, pin_is_default: true },
  });
});

/**
 * POST /api/auth/forgot-pin
 * Body: { email }
 * Sends a magic link that — when clicked — resets PIN to 1234 and forces change.
 * Rate-limited. Returns generic success to avoid email enumeration.
 */
app.post('/api/auth/forgot-pin', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  // Always return ok to avoid email enumeration
  if (!user) return res.json({ ok: true });

  const token     = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60;

  db.prepare('DELETE FROM magic_links WHERE email = ?').run(email);
  db.prepare('INSERT INTO magic_links (email, token, expires_at, is_pin_reset) VALUES (?, ?, ?, 1)').run(email, token, expiresAt);

  const frontendUrl = process.env.FRONTEND_URL || 'https://hollr.to';
  const link = `${frontendUrl}/auth/verify?token=${token}&pin_reset=1`;

  try {
    await sendMagicLink(email, link, { subject: 'Reset your hollr PIN', isPinReset: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('Forgot-pin email failed:', err.message);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ── X (Twitter) OAuth 2.0 ────────────────────────────────────────────────────

/**
 * GET /api/auth/x
 * Redirects the user to Twitter/X for OAuth 2.0 authorization.
 * Requires X_CLIENT_ID and X_CLIENT_SECRET in env.
 */
app.get('/api/auth/x', (req, res) => {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'X login not configured' });

  const state        = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  // Store state + verifier in session for callback
  req.session.xState        = state;
  req.session.xCodeVerifier = codeVerifier;

  const baseUrl     = process.env.BASE_URL || `http://localhost:${PORT}`;
  const redirectUri = `${baseUrl}/api/auth/x/callback`;

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             clientId,
    redirect_uri:          redirectUri,
    scope:                 'tweet.read users.read offline.access',
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });

  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
});

/**
 * GET /api/auth/x/callback
 * Handles the OAuth callback from Twitter/X.
 * Creates or links an account, then redirects to the frontend with a session token.
 * New X users without an email will get needs_email=1 in the redirect.
 */
app.get('/api/auth/x/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://hollr.to';

  if (error || !code) {
    return res.redirect(`${frontendUrl}/auth/verify?x_error=${encodeURIComponent(error || 'cancelled')}`);
  }

  if (state !== req.session.xState) {
    return res.redirect(`${frontendUrl}/auth/verify?x_error=state_mismatch`);
  }

  const clientId     = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const baseUrl      = process.env.BASE_URL || `http://localhost:${PORT}`;
  const redirectUri  = `${baseUrl}/api/auth/x/callback`;
  const codeVerifier = req.session.xCodeVerifier;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        code,
        grant_type:    'authorization_code',
        client_id:     clientId,
        redirect_uri:  redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('No access token from X');

    // Get user info from X
    const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });
    const xUser = (await userRes.json()).data;
    if (!xUser?.id) throw new Error('Could not fetch X user info');

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE x_id = ?').get(xUser.id);
    let isNew = false;

    if (!user) {
      // Brand-new X user — create pending account with default PIN
      const pinHash = bcrypt.hashSync(DEFAULT_PIN, 12);
      const pending  = `__pending_${uuidv4().slice(0, 8)}`;
      const inserted = db.prepare(`
        INSERT INTO users (x_id, x_username, handle, pin_hash, pin_is_default)
        VALUES (?, ?, ?, ?, 1)
      `).run(xUser.id, xUser.username, pending, pinHash);
      user  = db.prepare('SELECT * FROM users WHERE id = ?').get(inserted.lastInsertRowid);
      isNew = true;
    } else {
      // Update X username in case it changed
      db.prepare('UPDATE users SET x_username = ?, updated_at = unixepoch() WHERE id = ?').run(xUser.username, user.id);
    }

    const sessionTok   = createSession(user.id);
    const needsHandle  = user.handle.startsWith('__pending');
    // X users need to supply an email if they don't have one yet
    const needsEmail   = !user.email ? 1 : 0;

    res.redirect(
      `${frontendUrl}/auth/verify?x_session=${sessionTok}` +
      `&is_new=${needsHandle}` +
      `&needs_email=${needsEmail}` +
      `&x_username=${encodeURIComponent(xUser.username)}`
    );
  } catch (err) {
    console.error('X OAuth error:', err.message);
    res.redirect(`${frontendUrl}/auth/verify?x_error=oauth_failed`);
  }
});

/**
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
  res.json({ ok: true });
});

// ── User profile ─────────────────────────────────────────────────────────────

/**
 * GET /api/me
 */
app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    display_name:   req.user.display_name || null,
    email:          req.user.email,
    handle:         req.user.handle?.startsWith('__pending') ? null : req.user.handle,
    has_api_key:    !!req.user.resend_key,
    has_pin:        !!req.user.pin_hash,
    pin_is_default: !!req.user.pin_is_default,
    has_email:      !!req.user.email,
    from_email:     req.user.from_email,
    has_pgp:        !!req.user.pgp_public_key,
    x_username:     req.user.x_username,
  });
});

// ── Handle management ─────────────────────────────────────────────────────────

/**
 * POST /api/handle/check
 * Body: { handle }
 */
app.post('/api/handle/check', (req, res) => {
  const { handle } = req.body;

  // Basic format validation first
  if (!handle) return res.json({ available: false, reason: 'Please enter a handle.' });
  if (!isValidHandle(handle)) {
    // Give a human reason for each failure type
    if (handle.length < 2)  return res.json({ available: false, reason: 'Too short — minimum 2 characters.' });
    if (handle.length > 30) return res.json({ available: false, reason: 'Too long — maximum 30 characters.' });
    if (RESERVED.has(handle.toLowerCase())) {
      return res.json({ available: false, reason: `“${handle}” is a reserved word.` });
    }
    return res.json({ available: false, reason: 'Letters, numbers, hyphens and underscores only.' });
  }

  // Database uniqueness check — only consider real (non-pending) handles as taken
  const exists = db.prepare(
    'SELECT id FROM users WHERE handle = ? COLLATE NOCASE AND handle NOT LIKE \'__pending_%\''
  ).get(handle);
  if (exists) {
    return res.json({
      available: false,
      reason:    `hollr.to/${handle} is already taken. Try another name.`,
    });
  }

  res.json({ available: true });
});

/**
 * POST /api/handle/claim
 * Body: { handle, pin?, resend_key?, from_email?, pgp_public_key?, email? }
 * PIN defaults to 1234 (pin_is_default=1) if not provided.
 * Email is required for X-only users (no email on file).
 */
app.post('/api/handle/claim', requireAuth, async (req, res) => {
  const { handle, resend_key, pin, from_email, pgp_public_key, email, display_name } = req.body;

  if (!handle || !isValidHandle(handle)) return res.status(400).json({ error: 'Invalid handle format' });

  // Validate PIN if provided, otherwise use default
  const pinValue = pin || DEFAULT_PIN;
  if (!/^\d{4,8}$/.test(pinValue)) return res.status(400).json({ error: 'PIN must be 4-8 digits' });

  // Case-insensitive uniqueness check — prevents PAULFXYZ from slipping past paulfxyz
  const existing = db.prepare(
    'SELECT id FROM users WHERE handle = ? COLLATE NOCASE AND id != ? AND handle NOT LIKE \'__pending_%\''
  ).get(handle, req.user.user_id);
  if (existing) return res.status(409).json({ error: 'Handle already taken', code: 'handle_taken' });

  // If user has no email yet (X-only), require one
  const currentUser = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.user_id);
  if (!currentUser.email && !email) {
    return res.status(400).json({ error: 'Email required for PIN reset and notifications', code: 'email_required' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Validate PGP key if provided
  if (pgp_public_key) {
    const trimmed = pgp_public_key.trim();
    if (!trimmed.includes('BEGIN PGP PUBLIC KEY')) {
      return res.status(400).json({ error: 'Invalid PGP public key format' });
    }
  }

  const isDefaultPin  = !pin;  // no pin provided → using default
  const pinHash       = bcrypt.hashSync(pinValue, 12);
  const encryptedKey  = resend_key ? encrypt(resend_key) : null;

  // Trim display name to max 60 chars if provided
  const trimmedDisplayName = display_name ? String(display_name).trim().slice(0, 60) : null;

  db.prepare(`
    UPDATE users
    SET handle = ?, pin_hash = ?, pin_is_default = ?,
        resend_key = ?, from_email = ?,
        pgp_public_key = ?,
        display_name = COALESCE(?, display_name),
        email = COALESCE(?, email),
        updated_at = unixepoch()
    WHERE id = ?
  `).run(
    handle, pinHash, isDefaultPin ? 1 : 0,
    encryptedKey, from_email || null,
    pgp_public_key || null,
    trimmedDisplayName || null,
    email || null,
    req.user.user_id,
  );

  res.json({ ok: true, handle, pin_is_default: isDefaultPin });
});

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * GET /api/settings
 * Returns current (non-secret) settings values for pre-filling the UI.
 */
app.get('/api/settings', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);
  res.json({
    ok:             true,
    display_name:   user.display_name   || null,  // shown as "Message to [name]" on canvas
    email:          user.email          || null,  // notification destination
    from_email:     user.from_email     || null,  // Resend sender address
    has_resend_key: !!user.resend_key,
    pgp_public_key: user.pgp_public_key || null,
    pin_is_default: !!user.pin_is_default,
  });
});

/**
 * POST /api/settings
 * Body: { pin, resend_key?, from_email?, pgp_public_key?, notification_email? }
 *
 * Settings are always locked by PIN.
 * If pin_is_default is set, returns { error: 'must_change_pin' } so the
 * frontend can redirect to the PIN-change step before allowing other changes.
 */
app.post('/api/settings', requireAuth, (req, res) => {
  const { pin, resend_key, from_email, pgp_public_key, notification_email, display_name } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);

  // PIN is required and must match
  if (!user.pin_hash || !bcrypt.compareSync(String(pin), user.pin_hash)) {
    return res.status(403).json({ error: 'Incorrect PIN' });
  }

  // If this is still the default PIN, force a change before allowing other edits
  if (user.pin_is_default) {
    return res.status(403).json({
      error:  'must_change_pin',
      message: 'You must set a new PIN before changing other settings.',
    });
  }

  // Validate PGP key if provided
  if (pgp_public_key !== undefined && pgp_public_key !== null && pgp_public_key !== '') {
    const trimmed = String(pgp_public_key).trim();
    if (trimmed && !trimmed.includes('BEGIN PGP PUBLIC KEY')) {
      return res.status(400).json({ error: 'Invalid PGP public key format' });
    }
  }

  const updates = [];
  const params  = [];

  if (resend_key !== undefined) {
    updates.push('resend_key = ?');
    params.push(resend_key ? encrypt(resend_key) : null);
  }
  if (from_email !== undefined) {
    updates.push('from_email = ?');
    params.push(from_email || null);
  }
  if (pgp_public_key !== undefined) {
    updates.push('pgp_public_key = ?');
    params.push(pgp_public_key || null);
  }
  if (display_name !== undefined) {
    // Trim and cap at 60 chars — display name, not a username
    const trimmedName = display_name ? String(display_name).trim().slice(0, 60) : null;
    updates.push('display_name = ?');
    params.push(trimmedName || null);
  }
  if (notification_email !== undefined) {
    // Validate email if provided
    if (notification_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notification_email)) {
      return res.status(400).json({ error: 'Invalid notification email' });
    }
    // Check not taken by another user
    if (notification_email) {
      const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(notification_email, req.user.user_id);
      if (taken) return res.status(409).json({ error: 'That email is already used by another account' });
    }
    updates.push('email = ?');
    params.push(notification_email || null);
  }

  if (updates.length) {
    updates.push('updated_at = unixepoch()');
    params.push(req.user.user_id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  res.json({ ok: true });
});

/**
 * POST /api/settings/change-pin
 * Body: { current_pin, new_pin }
 * Clears the pin_is_default flag on success.
 */
app.post('/api/settings/change-pin', requireAuth, (req, res) => {
  const { current_pin, new_pin } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);

  if (!user.pin_hash || !bcrypt.compareSync(String(current_pin), user.pin_hash)) {
    return res.status(403).json({ error: 'Incorrect current PIN' });
  }
  if (!new_pin || !/^\d{4,8}$/.test(new_pin)) {
    return res.status(400).json({ error: 'New PIN must be 4-8 digits' });
  }
  if (new_pin === DEFAULT_PIN) {
    return res.status(400).json({ error: 'New PIN cannot be 1234' });
  }

  const pinHash = bcrypt.hashSync(String(new_pin), 12);
  db.prepare('UPDATE users SET pin_hash = ?, pin_is_default = 0, updated_at = unixepoch() WHERE id = ?').run(pinHash, req.user.user_id);
  res.json({ ok: true });
});

/**
 * POST /api/settings/email
 * Body: { pin, email }
 * Updates (or adds) the contact email for the user.
 * Required for X-only accounts to enable notifications + PIN recovery.
 */
app.post('/api/settings/email', requireAuth, (req, res) => {
  const { pin, email } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);

  if (!user.pin_hash || !bcrypt.compareSync(String(pin), user.pin_hash)) {
    return res.status(403).json({ error: 'Incorrect PIN' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Check email not already taken by another user
  const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.user_id);
  if (existing) return res.status(409).json({ error: 'Email already in use by another account' });

  db.prepare('UPDATE users SET email = ?, updated_at = unixepoch() WHERE id = ?').run(email, req.user.user_id);
  res.json({ ok: true });
});

// ── Public canvas API ─────────────────────────────────────────────────────────

/**
 * GET /api/profile/:handle
 * Public endpoint for canvas rendering.
 */
app.get('/api/profile/:handle', (req, res) => {
  const user = db.prepare(`
    SELECT handle, resend_key IS NOT NULL as has_own_key, pgp_public_key, x_username, display_name
    FROM users WHERE handle = ? COLLATE NOCASE
  `).get(req.params.handle);
  if (!user) return res.status(404).json({ error: 'Handle not found' });

  res.json({
    handle:         user.handle,
    active:         true,
    pgp_public_key: user.pgp_public_key  || null,
    x_username:     user.x_username      || null,
    // display_name is what appears as "Message to [name]" on the canvas.
    // Falls back to the handle if not set.
    display_name:   user.display_name    || user.handle,
  });
});

/**
 * POST /api/upload/:handle
 * Multipart: file field = "file"
 * File is AES-256-GCM encrypted server-side before writing to disk.
 */
app.post('/api/upload/:handle', sendLimiter, uploadMem.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const user = db.prepare('SELECT id FROM users WHERE handle = ? COLLATE NOCASE').get(req.params.handle);
  if (!user) return res.status(404).json({ error: 'Handle not found' });

  try {
    const { encrypted, keyHex, ivHex } = encryptBuffer(req.file.buffer);

    const ext      = path.extname(req.file.originalname) || '.bin';
    const filename = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}.enc`;
    const dir      = path.join(UPLOAD_DIR, req.params.handle);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), encrypted);

    const baseUrl  = process.env.BASE_URL || `http://localhost:${PORT}`;
    const url      = `${baseUrl}/uploads/${req.params.handle}/${filename}`;
    const origName = req.file.originalname;

    res.json({
      ok:       true,
      url,
      file_key: keyHex,
      file_iv:  ivHex,
      name:     origName,
    });
  } catch (err) {
    console.error('Upload encrypt error:', err.message);
    res.status(500).json({ error: 'Encryption failed' });
  }
});

// Serve encrypted files (raw bytes — decryption happens client-side)
app.use('/uploads', express.static(UPLOAD_DIR));

/**
 * POST /api/send/:handle
 * Body: { contact, message, file_attachments?, audio_url?, audio_key?, audio_iv? }
 */
app.post('/api/send/:handle', sendLimiter, async (req, res) => {
  const { contact, message, file_attachments, audio_url, audio_key, audio_iv, is_pgp } = req.body;

  if (!message || message.trim().length < 1) return res.status(400).json({ error: 'Message is empty' });
  if (!contact)                               return res.status(400).json({ error: 'Contact is required' });

  const user = db.prepare('SELECT * FROM users WHERE handle = ? COLLATE NOCASE').get(req.params.handle);
  if (!user)  return res.status(404).json({ error: 'Handle not found' });

  // Store message in DB
  db.prepare(`
    INSERT INTO messages (handle, sender, body, is_pgp, file_urls, audio_url, audio_encrypted)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.handle,
    contact,
    message.trim(),
    is_pgp ? 1 : 0,
    JSON.stringify(file_attachments || []),
    audio_url || null,
    (audio_key && audio_iv) ? 1 : 0,
  );

  // Determine which Resend key + from address to use
  let resendKey, fromEmail;

  if (user.resend_key) {
    try { resendKey = decrypt(user.resend_key); }
    catch { return res.status(500).json({ error: 'Failed to decrypt API key' }); }
    // Use the owner's custom sender address if set, otherwise fall back to platform address.
    fromEmail = user.from_email || process.env.PLATFORM_FROM_EMAIL || 'hollr <yo@hollr.to>';
  } else {
    resendKey = process.env.PLATFORM_RESEND_KEY;
    fromEmail = process.env.PLATFORM_FROM_EMAIL || 'hollr <yo@hollr.to>';
    if (!resendKey) return res.status(503).json({ error: 'Platform email not configured' });
  }

  // Handle owner hasn't set a notification email yet — sender gets a friendly error,
  // and the canvas should prompt the owner to add one in settings.
  if (!user.email) {
    return res.status(503).json({
      error:   'This handle has no notification email configured yet.',
      code:    'no_notification_email',
    });
  }

  try {
    const result = await forwardMessage({
      resendKey,
      fromEmail,
      toEmail:        user.email,
      senderContact:  contact,
      message:        message.trim(),
      isPgp:          !!is_pgp,
      fileAttachments: Array.isArray(file_attachments) ? file_attachments : [],
      audioUrl:       audio_url || null,
      audioKey:       audio_key || null,
      audioIv:        audio_iv  || null,
      handle:         user.handle,
    });

    if (result.id) {
      res.json({ ok: true });
    } else {
      console.error('Resend error:', JSON.stringify(result));
      res.status(502).json({ error: result.message || 'Email delivery failed' });
    }
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── 404 + error handler ───────────────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`📢 hollr API v5.2.1 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
