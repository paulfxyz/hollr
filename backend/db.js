/**
 * db.js — SQLite database initialisation for hollr.to (v4.2.0)
 *
 * Schema overview
 * ───────────────
 * users       — registered accounts (email/x_id, handle, encrypted Resend key,
 *               PIN hash, PGP public key, X OAuth tokens)
 * magic_links — one-time login tokens (expire after 15 min)
 * sessions    — authenticated sessions (expire after 30 days)
 * messages    — stored messages (encrypted with user PGP key if set)
 *
 * The database file lives at DATA_DIR/hollr.db (configurable via env).
 * On Fly.io, DATA_DIR should point to a persistent volume, e.g. /data.
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'hollr.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    UNIQUE,                 -- null for X-only accounts
    x_id          TEXT    UNIQUE,                 -- Twitter/X user ID (for OAuth)
    x_username    TEXT,                           -- Twitter/X @username
    x_token       TEXT,                           -- encrypted OAuth access token
    x_token_secret TEXT,                          -- encrypted OAuth token secret
    handle        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    resend_key    TEXT,           -- AES-256-CBC encrypted Resend API key (optional)
    pin_hash      TEXT,           -- bcrypt hash of 4-8 digit PIN
    from_email    TEXT,           -- "from" address (defaults to yo@hollr.to)
    pgp_public_key TEXT,          -- armoured PGP public key block
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS magic_links (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    NOT NULL,
    token        TEXT    NOT NULL UNIQUE,
    expires_at   INTEGER NOT NULL,
    used         INTEGER NOT NULL DEFAULT 0,
    is_pin_reset INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    handle        TEXT    NOT NULL,   -- recipient handle
    sender        TEXT    NOT NULL,   -- freeform contact field
    body          TEXT    NOT NULL,   -- plaintext OR PGP-armoured ciphertext
    is_pgp        INTEGER NOT NULL DEFAULT 0,
    file_urls     TEXT    DEFAULT '[]', -- JSON array of {url, name, encrypted}
    audio_url     TEXT,
    audio_encrypted INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Migration: add new columns to existing tables if not present
  -- (safe to run on every startup — IF NOT EXISTS equivalent for columns via try/catch in app code)

  CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_users_handle      ON users(handle);
  CREATE INDEX IF NOT EXISTS idx_messages_handle   ON messages(handle);
`);

// ── Runtime migrations (add columns added in v4.2.0 to existing DBs) ─────────

const v4Columns = [
  { table: 'users',       col: 'x_id',          def: 'TEXT' },
  { table: 'users',       col: 'x_username',    def: 'TEXT' },
  { table: 'users',       col: 'x_token',       def: 'TEXT' },
  { table: 'users',       col: 'x_token_secret',def: 'TEXT' },
  { table: 'users',       col: 'pgp_public_key',def: 'TEXT' },
  // v4.1.0
  { table: 'users',       col: 'pin_is_default',def: 'INTEGER NOT NULL DEFAULT 0' },
  // v4.2.0
  { table: 'magic_links', col: 'is_pin_reset',  def: 'INTEGER NOT NULL DEFAULT 0' },
];

for (const { table, col, def } of v4Columns) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch {
    // Column already exists — safe to ignore
  }
}

// Create index on x_id after migrations (column may not exist on fresh DBs until after ALTER)
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_x_id ON users(x_id)');
} catch {
  // Ignore if already exists
}

module.exports = db;
