/**
 * db.js — SQLite database setup for hollr.to (v5.1.0)
 * ──────────────────────────────────────────────────────
 *
 * OVERVIEW
 * ─────────
 * Initialises a SQLite database using better-sqlite3, which is:
 *   • Synchronous  — no async/await needed, no callback hell
 *   • Fast         — in-process, no network overhead
 *   • Durable      — WAL mode gives concurrent reads + crash safety
 *
 * DATABASE LOCATION
 * ─────────────────
 *   Local dev:  ./data/hollr.db          (auto-created)
 *   Fly.io:     /data/hollr.db           (persistent volume, 3 GB)
 *   Set via:    DATA_DIR env var
 *
 * SCHEMA OVERVIEW
 * ────────────────
 *   users        — one row per registered account
 *   magic_links  — one-time login/reset tokens (15-min TTL, single-use)
 *   sessions     — active login sessions (30-day TTL, Bearer token auth)
 *   messages     — incoming hollrs (kept for future inbox feature)
 *
 * MIGRATION STRATEGY
 * ──────────────────
 *   SQLite doesn't support ALTER TABLE … IF NOT EXISTS, so we use a
 *   try/catch loop over ALTER TABLE ADD COLUMN statements. Errors mean
 *   the column already exists — safe to ignore. This lets us deploy new
 *   columns to a live database without downtime or manual migrations.
 *
 * BETTER-SQLITE3 USAGE NOTES
 * ──────────────────────────
 *   All queries are synchronous. The correct termination methods are:
 *     .get()    →  one row or undefined
 *     .all()    →  array of rows (may be empty)
 *     .run()    →  { changes, lastInsertRowid }
 *   Do NOT use:
 *     const [row] = db.select()...   ← always returns undefined
 *     await db.prepare(...)           ← there is no async interface
 *
 * KEY LESSON — idx_users_x_id
 * ────────────────────────────
 *   We tried to declare CREATE INDEX IF NOT EXISTS idx_users_x_id in the
 *   initial db.exec() block before the x_id column was added via ALTER.
 *   SQLite rejected it with "no such column". Fix: create this index
 *   *after* the ALTER TABLE migration loop completes.
 */

'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ── Database file location ────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'hollr.db'));

// ── Performance & safety pragmas ─────────────────────────────────────────────

// WAL (Write-Ahead Logging): readers don't block writers and vice versa.
// Essential on Fly.io where the health-check and web requests run concurrently.
db.pragma('journal_mode = WAL');

// Enforce foreign-key constraints (SQLite ignores them by default).
db.pragma('foreign_keys = ON');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`

  -- ── users ──────────────────────────────────────────────────────────────────
  -- One row per registered account. A user may sign in via email (magic link)
  -- or X OAuth, or both — at least one of (email, x_id) must be non-null.
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Auth identity (at least one must be set)
    email          TEXT UNIQUE,       -- notification address + magic-link login
    x_id           TEXT UNIQUE,       -- Twitter/X numeric user ID
    x_username     TEXT,              -- Twitter/X @handle (display only)
    x_token        TEXT,              -- reserved for future X API calls

    -- Handle (the user's public URL path, e.g. "hollr.to/paul")
    handle         TEXT NOT NULL UNIQUE COLLATE NOCASE,

    -- Settings (all optional)
    resend_key     TEXT,              -- AES-256-CBC encrypted Resend API key
    from_email     TEXT,              -- verified Resend sender address
    pin_hash       TEXT,              -- bcrypt(pin, 12) — 4-8 digit PIN
    pin_is_default INTEGER NOT NULL DEFAULT 0,  -- 1 if PIN is still "1234"
    pgp_public_key TEXT,             -- armoured OpenPGP public key block
    display_name   TEXT,             -- shown as "Message to [name]" on the canvas (max 60 chars)

    created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at     INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- ── magic_links ─────────────────────────────────────────────────────────────
  -- One-time tokens emailed to users for passwordless login or PIN reset.
  -- Tokens expire after 15 minutes and are marked used=1 immediately on click.
  -- is_pin_reset=1 causes the verify endpoint to reset pin_hash to bcrypt("1234")
  -- and set pin_is_default=1, forcing a PIN change on the next settings open.
  CREATE TABLE IF NOT EXISTS magic_links (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    NOT NULL,
    token        TEXT    NOT NULL UNIQUE,   -- UUID v4, 36 chars
    expires_at   INTEGER NOT NULL,          -- Unix timestamp
    used           INTEGER NOT NULL DEFAULT 0,
    is_pin_reset   INTEGER NOT NULL DEFAULT 0,
    pending_handle TEXT                          -- desired handle chosen on landing page
  );

  -- ── sessions ─────────────────────────────────────────────────────────────────
  -- Active login sessions. Each session is a 32-byte random hex Bearer token
  -- stored in the client's sessionStorage (not localStorage — iframe safe).
  -- Sessions expire after 30 days and are deleted on explicit logout.
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,  -- crypto.randomBytes(32).toString('hex')
    expires_at INTEGER NOT NULL          -- Unix timestamp
  );

  -- ── messages ─────────────────────────────────────────────────────────────────
  -- Incoming hollrs stored for a future inbox / analytics feature.
  -- body is either plaintext or a PGP-armoured ciphertext (is_pgp=1).
  -- file_urls is a JSON array of {url,name,encrypted} objects.
  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    handle          TEXT    NOT NULL,       -- recipient handle
    sender          TEXT    NOT NULL,       -- freeform contact field from sender
    body            TEXT    NOT NULL,       -- message text or PGP block
    is_pgp          INTEGER NOT NULL DEFAULT 0,
    file_urls       TEXT    DEFAULT '[]',   -- JSON [{url,name,encrypted}]
    audio_url       TEXT,
    audio_encrypted INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- ── Indexes ──────────────────────────────────────────────────────────────────
  -- Covering the most common WHERE clauses: token lookups and handle lookups.
  -- x_id index is created below after the ALTER TABLE migration (see note above).
  CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_users_handle      ON users(handle);
  CREATE INDEX IF NOT EXISTS idx_messages_handle   ON messages(handle);
`);

// ── Runtime migrations ────────────────────────────────────────────────────────
// Adds columns introduced after the initial schema. ALTER TABLE errors are
// swallowed — they always mean the column already exists (idempotent).
//
// Format: { table, col, def } where def is the full column definition string.

const migrations = [
  // v4.0.0 — X OAuth columns
  { table: 'users', col: 'x_id',           def: 'TEXT' },
  { table: 'users', col: 'x_username',     def: 'TEXT' },
  { table: 'users', col: 'x_token',        def: 'TEXT' },
  { table: 'users', col: 'x_token_secret', def: 'TEXT' },
  { table: 'users', col: 'pgp_public_key', def: 'TEXT' },

  // v4.1.0 — PIN default flag
  { table: 'users',       col: 'pin_is_default', def: 'INTEGER NOT NULL DEFAULT 0' },

  // v4.2.0 — PIN-reset magic links
  { table: 'magic_links', col: 'is_pin_reset',   def: 'INTEGER NOT NULL DEFAULT 0' },
  // v4.4.0 — display name
  { table: 'users',       col: 'display_name',  def: 'TEXT' },

  // v4.5.1 — pending_handle on magic_links (survives new-tab magic link opens)
  // This column already exists in CREATE TABLE above, but databases that were
  // created before v4.5.1 won't have it. The ALTER TABLE below adds it safely.
  { table: 'magic_links', col: 'pending_handle', def: 'TEXT' },
];

for (const { table, col, def } of migrations) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch {
    // Column already exists on this database — safe to skip.
  }
}

// Create the x_id index *after* migrations because the column may not have
// existed in the original schema on already-running databases.
try {
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_x_id ON users(x_id)');
} catch { /* already exists */ }

module.exports = db;
