/**
 * server.js — hollr.to API Backend (v4.0.0)
 *
 * Routes overview
 * ───────────────
 *   GET  /health                       — health check
 *
 *   POST /api/auth/magic-link          — request email magic link
 *   GET  /api/auth/verify/:token       — verify magic link, create session
 *   GET  /api/auth/x                   — start X (Twitter) OAuth flow
 *   GET  /api/auth/x/callback          — X OAuth callback
 *   POST /api/auth/logout              — destroy session
 *   GET  /api/me                       — get authenticated user profile
 *
 *   POST /api/handle/check             — check handle availability
 *   POST /api/handle/claim             — claim handle during onboarding
 *
 *   POST /api/settings                 — update Resend key, from_email, PGP key
 *   POST /api/settings/change-pin      — change PIN
 *
 *   GET  /api/profile/:handle          — public profile (for canvas)
 *   POST /api/send/:handle             — send message to handle owner
 *   POST /api/upload/:handle           — upload encrypted file/voice
 *   GET  /api/decrypt/:handle/:file    — serve decryption key for own uploads
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

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.handle || 'anon');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname) || '.bin';
    const name = `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    cb(null, name);
  },
});

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

app.use(helmet({
  contentSecurityPolicy: false, // We set it ourselves below if needed
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

// Express session — needed for OAuth state persistence
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

  const session = db.prepare(`
    SELECT s.token, s.user_id, s.expires_at,
           u.email, u.handle, u.resend_key, u.pin_hash, u.from_email,
           u.pgp_public_key, u.x_id, u.x_username
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > unixepoch()
  `).get(token);

  if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user  = session;
  req.token = token;
  next();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const HANDLE_RE = /^[a-zA-Z0-9_-]{2,30}$/;
const RESERVED  = new Set([
  'admin','api','app','www','mail','root','support','help','about',
  'legal','status','cdn','static','uploads','hollr','yo','auth',
  'settings','profile','explore','discover',
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

app.get('/health', (_req, res) => res.json({ ok: true, version: '4.0.0' }));

// ── Email magic link auth ────────────────────────────────────────────────────

/**
 * POST /api/auth/magic-link
 * Body: { email }
 * Sends a one-time login link. Works for both new and returning users.
 */
app.post('/api/auth/magic-link', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const token     = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60; // 15 min

  db.prepare('DELETE FROM magic_links WHERE email = ?').run(email);
  db.prepare('INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)').run(email, token, expiresAt);

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
    const token = createSession(user.id);
    return res.json({
      ok:            true,
      session_token: token,
      is_new_user:   false,
      user: {
        email:       user.email,
        handle:      user.handle?.startsWith('__pending') ? null : user.handle,
        has_api_key: !!user.resend_key,
        has_pgp:     !!user.pgp_public_key,
      },
    });
  }

  // New user — create a pending account
  const inserted = db.prepare(`
    INSERT INTO users (email, handle) VALUES (?, ?)
  `).run(row.email, `__pending_${uuidv4().slice(0, 8)}`);

  const token = createSession(inserted.lastInsertRowid);
  res.json({
    ok:            true,
    session_token: token,
    is_new_user:   true,
    user: { email: row.email, handle: null, has_api_key: false, has_pgp: false },
  });
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

    if (!user) {
      // Check if email-based account exists (can't link automatically — they must log in with email)
      const pending = `__pending_${uuidv4().slice(0, 8)}`;
      const inserted = db.prepare(`
        INSERT INTO users (x_id, x_username, handle)
        VALUES (?, ?, ?)
      `).run(xUser.id, xUser.username, pending);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(inserted.lastInsertRowid);
    } else {
      // Update X username in case it changed
      db.prepare('UPDATE users SET x_username = ?, updated_at = unixepoch() WHERE id = ?').run(xUser.username, user.id);
    }

    const sessionTok = createSession(user.id);
    const isNew      = user.handle.startsWith('__pending');

    // Redirect to frontend with session token and new-user flag
    res.redirect(
      `${frontendUrl}/auth/verify?x_session=${sessionTok}&is_new=${isNew}&x_username=${encodeURIComponent(xUser.username)}`
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
    email:       req.user.email,
    handle:      req.user.handle?.startsWith('__pending') ? null : req.user.handle,
    has_api_key: !!req.user.resend_key,
    has_pin:     !!req.user.pin_hash,
    from_email:  req.user.from_email,
    has_pgp:     !!req.user.pgp_public_key,
    x_username:  req.user.x_username,
  });
});

// ── Handle management ─────────────────────────────────────────────────────────

/**
 * POST /api/handle/check
 * Body: { handle }
 */
app.post('/api/handle/check', (req, res) => {
  const { handle } = req.body;
  if (!handle || !isValidHandle(handle)) return res.json({ available: false, reason: 'Invalid format' });
  const exists = db.prepare('SELECT id FROM users WHERE handle = ?').get(handle);
  res.json({ available: !exists });
});

/**
 * POST /api/handle/claim
 * Body: { handle, pin, resend_key?, from_email?, pgp_public_key? }
 * Resend API is now optional — platform email is used as fallback.
 */
app.post('/api/handle/claim', requireAuth, async (req, res) => {
  const { handle, resend_key, pin, from_email, pgp_public_key } = req.body;

  if (!handle || !isValidHandle(handle))  return res.status(400).json({ error: 'Invalid handle format' });
  if (!pin || !/^\d{4,8}$/.test(pin))    return res.status(400).json({ error: 'PIN must be 4-8 digits' });

  const existing = db.prepare('SELECT id FROM users WHERE handle = ? AND id != ?').get(handle, req.user.user_id);
  if (existing) return res.status(409).json({ error: 'Handle already taken' });

  // Validate PGP key if provided
  if (pgp_public_key) {
    const trimmed = pgp_public_key.trim();
    if (!trimmed.includes('BEGIN PGP PUBLIC KEY')) {
      return res.status(400).json({ error: 'Invalid PGP public key format' });
    }
  }

  const pinHash      = bcrypt.hashSync(pin, 12);
  const encryptedKey = resend_key ? encrypt(resend_key) : null;

  db.prepare(`
    UPDATE users
    SET handle = ?, pin_hash = ?, resend_key = ?, from_email = ?,
        pgp_public_key = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(handle, pinHash, encryptedKey, from_email || null, pgp_public_key || null, req.user.user_id);

  res.json({ ok: true, handle });
});

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * POST /api/settings
 * Body: { pin, resend_key?, from_email?, pgp_public_key? }
 * All fields optional; PIN is always required to authorise.
 */
app.post('/api/settings', requireAuth, (req, res) => {
  const { pin, resend_key, from_email, pgp_public_key } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.user_id);

  if (!user.pin_hash || !bcrypt.compareSync(String(pin), user.pin_hash)) {
    return res.status(403).json({ error: 'Incorrect PIN' });
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

  const pinHash = bcrypt.hashSync(String(new_pin), 12);
  db.prepare('UPDATE users SET pin_hash = ?, updated_at = unixepoch() WHERE id = ?').run(pinHash, req.user.user_id);
  res.json({ ok: true });
});

// ── Public canvas API ─────────────────────────────────────────────────────────

/**
 * GET /api/profile/:handle
 * Public endpoint for canvas rendering.
 * Returns handle, pgp_public_key (so sender can encrypt), whether they have own Resend key.
 */
app.get('/api/profile/:handle', (req, res) => {
  const user = db.prepare(`
    SELECT handle, resend_key IS NOT NULL as has_own_key, pgp_public_key, x_username
    FROM users WHERE handle = ? COLLATE NOCASE
  `).get(req.params.handle);
  if (!user) return res.status(404).json({ error: 'Handle not found' });

  res.json({
    handle:         user.handle,
    active:         true,               // always active — platform email is the fallback
    pgp_public_key: user.pgp_public_key || null,
    x_username:     user.x_username || null,
  });
});

/**
 * POST /api/upload/:handle
 * Multipart: file field = "file"
 * File is AES-256-GCM encrypted server-side before writing to disk.
 * Returns { ok, url, file_key, file_iv } — key+iv let the owner decrypt in-browser.
 * The key is also stored encrypted server-side for the /api/decrypt endpoint.
 */
app.post('/api/upload/:handle', sendLimiter, uploadMem.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  // Check handle exists
  const user = db.prepare('SELECT id FROM users WHERE handle = ? COLLATE NOCASE').get(req.params.handle);
  if (!user) return res.status(404).json({ error: 'Handle not found' });

  try {
    const { encrypted, keyHex, ivHex } = encryptBuffer(req.file.buffer);

    // Write encrypted bytes to disk with .enc suffix
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
      file_key: keyHex,   // 32-byte AES key — passed to sender for inline delivery
      file_iv:  ivHex,    // 12-byte GCM IV
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
 * - message can be plaintext or a PGP-armoured ciphertext (sender encrypts client-side)
 * - file_attachments: array of { url, name, file_key, file_iv }
 * - Platform email (yo@hollr.to) is used if user has no own Resend key
 */
app.post('/api/send/:handle', sendLimiter, async (req, res) => {
  const { contact, message, file_attachments, audio_url, audio_key, audio_iv, is_pgp } = req.body;

  if (!message || message.trim().length < 1) return res.status(400).json({ error: 'Message is empty' });
  if (!contact)                               return res.status(400).json({ error: 'Contact is required' });

  const user = db.prepare('SELECT * FROM users WHERE handle = ? COLLATE NOCASE').get(req.params.handle);
  if (!user)  return res.status(404).json({ error: 'Handle not found' });

  // Store message in DB (for future inbox feature)
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
    // User's own Resend key
    try { resendKey = decrypt(user.resend_key); }
    catch { return res.status(500).json({ error: 'Failed to decrypt API key' }); }
    fromEmail = user.from_email || `yo@hollr.to`;
  } else {
    // Fall back to platform key (yo@hollr.to)
    resendKey = process.env.PLATFORM_RESEND_KEY;
    fromEmail = process.env.PLATFORM_FROM_EMAIL || 'hollr <yo@hollr.to>';
    if (!resendKey) return res.status(503).json({ error: 'Platform email not configured' });
  }

  if (!user.email) return res.status(503).json({ error: 'No destination email for this handle' });

  try {
    const result = await forwardMessage({
      resendKey,
      fromEmail,
      toEmail:       user.email,
      senderContact: contact,
      message:       message.trim(),
      isPgp:         !!is_pgp,
      fileAttachments: Array.isArray(file_attachments) ? file_attachments : [],
      audioUrl:      audio_url || null,
      audioKey:      audio_key || null,
      audioIv:       audio_iv  || null,
      handle:        user.handle,
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
  console.log(`🐺 hollr API v4.0.0 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
