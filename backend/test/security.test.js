/**
 * hollr — backend integration tests (v5.3.0)
 * ----------------------------------------------------------------------------
 * Boots the real server against a throw-away SQLite database in a temp folder and
 * exercises the security-relevant behaviour over HTTP: PIN verification & lockout,
 * token revocation, default-PIN handling, attachment validation, PGP policy,
 * encryption at rest, reserved / placeholder handles, upload isolation.
 *
 * No network access, no real e-mail is sent (the Resend key is a dummy, so the
 * delivery step fails after validation — that is expected and asserted around).
 *
 *   npm test        (from /backend)
 *
 * Exit code is non-zero if any assertion fails.
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const BE = path.join(__dirname, '..');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const openpgp = require('openpgp');
const fs = require('fs');
const DATA = path.join(os.tmpdir(), 'hollr-test-' + process.pid); fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const PORT = 39000 + (process.pid % 900), B = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL:', m)); console.log((c ? 'ok   ' : 'FAIL ') + m); };
let xff = 1; const ip = () => '10.0.' + (xff >> 8) + '.' + (xff++ & 255);
const J = async (p, o = {}) => { const r = await fetch(B + p, { ...o, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip(), ...(o.headers || {}) } }); let b = null; try { b = await r.json(); } catch {} return { s: r.status, b }; };
(async () => {
  const srv = spawn('node', ['server.js'], { cwd: BE, env: { ...process.env, PORT, DATA_DIR: DATA, ENCRYPTION_SECRET: 'a'.repeat(64), PLATFORM_RESEND_KEY: 're_fake', BASE_URL: B, NODE_ENV: 'production', SESSION_SECRET: 'x' } });
  srv.stderr.on('data', d => process.stderr.write(d));
  await new Promise(r => setTimeout(r, 2500));
  const db = new Database(DATA + '/hollr.db');
  const mk = (h, email, pin, def, pgp) => db.prepare('INSERT INTO users (email,handle,pin_hash,pin_is_default,pgp_public_key) VALUES (?,?,?,?,?)').run(email, h, bcrypt.hashSync(pin, 4), def, pgp || null);
  const { privateKey, publicKey } = await openpgp.generateKey({ type: 'ecc', curve: 'curve25519', userIDs: [{ name: 'b' }] });
  mk('alice', 'a@x.io', '4321', 0); mk('bob', 'b@x.io', '2468', 0, publicKey); mk('carol', 'c@x.io', '1234', 1);
  mk('__pending_abc12345', 'p@x.io', '1111', 0); mk('mypendingtask', 'm@x.io', '1111', 0);

  console.log('--- health / basics');
  let r = await J('/health'); ok(r.b && r.b.ok, 'health ' + JSON.stringify(r.b));
  r = await J('/api/profile/mypendingtask'); ok(r.s === 200, 'handle containing "pending" (mypendingtask) is a real profile');
  r = await J('/api/profile/__pending_abc12345'); ok(r.s === 404, 'placeholder __pending_ handle hidden from profile');
  r = await J('/api/profile/ALICE'); ok(r.s === 200 && r.b.handle === 'alice', 'profile is case-insensitive');

  console.log('--- PIN verify');
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'alice', pin: '4321' }) }); ok(r.s === 200 && r.b.token, 'correct PIN -> settings token');
  const tok = r.b.token;
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'nobody', pin: '0000' }) }); const unk = r;
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'alice', pin: '0000' }) });
  ok(unk.s === 403 && r.s === 403 && JSON.stringify(unk.b) === JSON.stringify(r.b), 'unknown handle and wrong PIN: identical 403 body');
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'carol', pin: '1234' }) }); ok(r.s === 403 && r.b.code === 'pin_reset_required', 'default PIN 1234 cannot mint a settings token');
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'carol', pin: '9999' }) }); ok(r.s === 403 && !r.b.code, 'wrong PIN on default account stays generic');
  // timing
  const time = async (h) => { const t = process.hrtime.bigint(); await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: h, pin: '7777' }) }); return Number(process.hrtime.bigint() - t) / 1e6; };
  // lockout of bob via many IPs (each request different XFF)
  let last; for (let i = 0; i < 12; i++) last = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'bob', pin: '000' + (i % 10) }) });
  ok(last.s === 429, 'per-handle lockout after 10 failures across different IPs (got ' + last.s + ')');
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'bob', pin: '2468' }) }); ok(r.s === 429, 'even the correct PIN is refused while locked');
  r = await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'alice', pin: '4321' }) }); ok(r.s === 200, 'other handles unaffected by bob lockout');

  console.log('--- change-pin revokes other tokens');
  const t2 = (await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'alice', pin: '4321' }) })).b.token;
  r = await J('/api/settings/change-pin', { method: 'POST', headers: { Authorization: 'Bearer ' + t2 }, body: JSON.stringify({ current_pin: '4321', new_pin: '5555' }) }); ok(r.s === 200, 'change-pin works');
  r = await J('/api/settings', { headers: { Authorization: 'Bearer ' + tok } }); ok(r.s === 401, 'older settings token revoked after PIN change (' + r.s + ')');
  r = await J('/api/settings', { headers: { Authorization: 'Bearer ' + t2 } }); ok(r.s === 200, 'token used for the change keeps working');

  console.log('--- upload + send');
  const up = async (h, name) => { const fd = new FormData(); fd.append('file', new Blob([Buffer.from('hello secret')]), name); const rr = await fetch(`${B}/api/upload/${h}`, { method: 'POST', body: fd, headers: { 'X-Forwarded-For': ip() } }); return { s: rr.status, b: await rr.json() }; };
  let u1 = await up('ALICE', 'my doc"<x>.p d f');
  ok(u1.s === 200 && u1.b.url.startsWith(B + '/uploads/alice/') && /^[a-z0-9.\/:\-]+$/.test(u1.b.url.replace(/^https?:\/\//,'')), 'upload under canonical handle + sanitised ext: ' + u1.b.url);
  const send = (h, body) => J('/api/send/' + h, { method: 'POST', body: JSON.stringify(body) });
  const att = { url: u1.b.url, file_key: u1.b.file_key, file_iv: u1.b.file_iv, name: 'x.pdf' };
  r = await send('alice', { contact: 'Sam (sam@x.io)', message: 'hi', file_attachments: [att] }); ok([200, 502, 500].includes(r.s) && r.s !== 400, 'valid attachment passes validation (status ' + r.s + ' = Resend stub)');
  const row = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1').get();
  ok(row.body.startsWith('enc:v1:') && !row.body.includes('hi'), 'non-PGP body encrypted at rest');
  ok(!row.file_urls.includes(u1.b.file_key), 'file key NOT persisted in DB');
  r = await send('alice', { contact: 'S', message: 'hi', file_attachments: [{ ...att, url: 'https://evil.example/x' }] }); ok(r.s === 400, 'foreign attachment URL rejected');
  r = await send('alice', { contact: 'S', message: 'hi', file_attachments: [{ ...att, file_key: '" onmouseover="x' }] }); ok(r.s === 400, 'attribute-injection in key rejected');
  r = await send('alice', { contact: 'S', message: 'hi', audio_url: 'javascript:alert(1)' }); ok(r.s === 400, 'javascript: audio_url rejected');
  r = await send('alice', { contact: 'S', message: 'hi', file_attachments: Array(11).fill(att) }); ok(r.s === 400, '>10 attachments rejected');
  r = await send('alice', { contact: 'x'.repeat(401), message: 'hi' }); ok(r.s === 400, 'oversize contact rejected');
  r = await send('bob', { contact: 'S', message: 'plain text' }); ok(r.s === 400 && r.b.code === 'pgp_required', 'plaintext refused when owner has PGP key');
  r = await send('bob', { contact: 'S', message: 'plain', is_pgp: true }); ok(r.s === 400, 'is_pgp flag alone not trusted');
  const ct = await openpgp.encrypt({ message: await openpgp.createMessage({ text: 'secret' }), encryptionKeys: await openpgp.readKey({ armoredKey: publicKey }) });
  r = await send('bob', { contact: 'S', message: ct, is_pgp: true }); ok(r.s !== 400, 'real PGP block accepted (status ' + r.s + ')');
  const row2 = db.prepare("SELECT * FROM messages WHERE handle='bob' ORDER BY id DESC LIMIT 1").get(); ok(row2.is_pgp === 1 && row2.body.includes('BEGIN PGP MESSAGE'), 'PGP stored as ciphertext, is_pgp=1');
  r = await send('__pending_abc12345', { contact: 'S', message: 'x' }); ok(r.s === 404, 'cannot send to placeholder handle');

  console.log('--- handles');
  r = await J('/api/auth/magic-link', { method: 'POST', body: JSON.stringify({ email: 'new@x.io', handle: 'paul' }) }); ok(r.s === 409, 'reserved handle rejected at magic-link');
  r = await J('/api/auth/magic-link', { method: 'POST', body: JSON.stringify({ email: 'new@x.io', handle: '__pending_zzz' }) }); ok(r.s === 409, '__pending_ prefix not claimable');
  r = await J('/api/handle/check', { method: 'POST', body: JSON.stringify({ handle: 'mypendingtask' }) }); ok(r.b && r.b.available === false, 'check: mypendingtask correctly reported taken');
  r = await J('/api/handle/check', { method: 'POST', body: JSON.stringify({ handle: 'pf' }) }); ok(r.b && r.b.available === false, 'check: pf reserved');
  r = await J('/api/nope'); ok(r.s === 404, '404 json');

  console.log('--- v5.3.0 additions');
  const st = (await J('/api/settings/verify', { method: 'POST', body: JSON.stringify({ handle: 'alice', pin: '5555' }) })).b.token;
  r = await J('/api/handle/claim', { method: 'POST', headers: { Authorization: 'Bearer ' + st }, body: JSON.stringify({ handle: 'alicenew', pin: '9999' }) }); ok(r.s === 403, 'settings token cannot call /handle/claim');
  const sess = require('uuid').v4(); db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,unixepoch()+3600)').run(sess, db.prepare("SELECT id FROM users WHERE handle='alice'").get().id);
  r = await J('/api/handle/claim', { method: 'POST', headers: { Authorization: 'Bearer ' + sess }, body: JSON.stringify({ handle: 'alice', pin: '1234' }) }); ok(r.s === 200 && r.b.pin_is_default === true, 'explicit 1234 at claim is flagged as default (must change)');
  const t0 = Date.now(); const f1 = await J('/api/auth/forgot-pin', { method: 'POST', body: JSON.stringify({ email: 'nobody@nowhere.io' }) }); const f2 = await J('/api/auth/forgot-pin', { method: 'POST', body: JSON.stringify({ email: 'b@x.io' }) });
  ok(f1.s === 200 && f2.s === 200 && JSON.stringify(f1.b) === JSON.stringify(f2.b), 'forgot-pin: identical 200 for unknown / known email');
  // 8 uploads in a minute must not be throttled; sends keep their own budget
  let upOk = 0; for (let i = 0; i < 8; i++) { const x = await up('alice', 'f' + i + '.txt'); if (x.s === 200) upOk++; } ok(upOk === 8, '8 uploads/min allowed (separate budget) -> ' + upOk);
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.kill(); fs.rmSync(DATA, { recursive: true, force: true }); process.exit(fail ? 1 : 0);
})();
