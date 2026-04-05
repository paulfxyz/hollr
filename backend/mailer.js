/**
 * mailer.js — Email delivery via Resend REST API for hollr.to (v4.0.0)
 *
 * Two responsibilities:
 *   1. Send magic-link login emails (platform Resend key → yo@hollr.to)
 *   2. Forward user messages via either the per-user Resend key OR the platform key
 *
 * Messages may be PGP-encrypted (we include a note + decrypt link in that case).
 * File attachments are AES-encrypted; the email includes a JS decrypt viewer link.
 */

const https = require('https');

const RESEND_API = 'https://api.resend.com/emails';

/**
 * Low-level HTTP POST to the Resend emails endpoint.
 */
function resendPost(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url  = new URL(RESEND_API);
    const req  = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Sends a magic-link login email via the platform Resend key.
 */
async function sendMagicLink(toEmail, magicLink) {
  const apiKey = process.env.PLATFORM_RESEND_KEY;
  if (!apiKey) throw new Error('PLATFORM_RESEND_KEY not set');

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px">
      <h1 style="font-size:28px;margin-bottom:8px;color:#111">🐺 hollr</h1>
      <p style="color:#555;margin-bottom:32px">Your secure, one-time login link.</p>
      <a href="${magicLink}"
         style="display:inline-block;background:#ff6b35;color:#fff;padding:14px 28px;
                border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
        Log in to hollr →
      </a>
      <p style="color:#999;font-size:13px;margin-top:32px">
        This link expires in 15 minutes and can only be used once.<br>
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color:#ccc;font-size:12px;margin-top:24px">
        <a href="https://hollr.to" style="color:#ccc">hollr.to</a> — open-source messaging canvas
      </p>
    </div>`;

  return resendPost(apiKey, {
    from:    process.env.PLATFORM_FROM_EMAIL || 'hollr <yo@hollr.to>',
    to:      [toEmail],
    subject: 'Your hollr login link',
    html,
  });
}

/**
 * Forwards a user message to the handle owner.
 *
 * @param {object} opts
 * @param {string}   opts.resendKey       — Resend API key
 * @param {string}   opts.fromEmail       — verified "from" address
 * @param {string}   opts.toEmail         — handle owner's email
 * @param {string}   opts.senderContact   — freeform contact field
 * @param {string}   opts.message         — plaintext or PGP armoured ciphertext
 * @param {boolean}  opts.isPgp           — true if message is PGP encrypted
 * @param {Array}    opts.fileAttachments — [{ url, name, file_key, file_iv }]
 * @param {string}   [opts.audioUrl]      — URL to encrypted voice recording
 * @param {string}   [opts.audioKey]      — hex key for audio decryption
 * @param {string}   [opts.audioIv]       — hex IV for audio decryption
 * @param {string}   [opts.handle]        — recipient handle
 */
async function forwardMessage(opts) {
  const {
    resendKey, fromEmail, toEmail, senderContact,
    message, isPgp = false,
    fileAttachments = [], audioUrl, audioKey, audioIv,
    handle,
  } = opts;

  const frontendUrl = process.env.FRONTEND_URL || 'https://hollr.to';

  // ── Message body ────────────────────────────────────────────────────────────

  let messageHtml, messageText;

  if (isPgp) {
    // PGP-encrypted: show the armoured block and a decrypt button
    const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    messageHtml = `
      <div style="background:#1a1a1a;border-radius:8px;padding:20px 24px;border-left:4px solid #ff6b35">
        <p style="color:#ff6b35;font-size:12px;font-weight:600;margin:0 0 12px;letter-spacing:.06em">
          🔐 PGP ENCRYPTED MESSAGE
        </p>
        <pre style="font-family:monospace;font-size:12px;color:#ccc;white-space:pre-wrap;word-break:break-all;margin:0">${safe}</pre>
      </div>
      <p style="font-size:13px;color:#777;margin-top:16px">
        This message was encrypted with your PGP public key.<br>
        Decrypt it with your private key using GPG or a compatible tool.
      </p>`;
    messageText = `[PGP ENCRYPTED MESSAGE]\n\n${message}`;
  } else {
    const safe = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    messageHtml = `
      <div style="background:#f9f9f9;border-radius:8px;padding:20px 24px;
                  border-left:4px solid #111;white-space:pre-wrap;font-size:15px;
                  color:#222;line-height:1.6">
        ${safe}
      </div>`;
    messageText = message;
  }

  // ── File attachments ────────────────────────────────────────────────────────

  let filesHtml = '';
  let filesText = '';

  if (fileAttachments.length > 0) {
    const fileItems = fileAttachments.map(f => {
      // Build a decrypt viewer URL: pass url+key+iv as hash params so they never hit the server
      const viewerUrl = `${frontendUrl}/decrypt#url=${encodeURIComponent(f.url)}&key=${f.file_key}&iv=${f.file_iv}&name=${encodeURIComponent(f.name || 'file')}`;
      return `<li style="margin-bottom:8px">
        <a href="${viewerUrl}" style="color:#ff6b35;text-decoration:none">
          🔒 ${f.name || 'Encrypted file'} — Decrypt &amp; Download →
        </a>
      </li>`;
    }).join('');

    filesHtml = `
      <p style="margin-top:24px;font-weight:600;color:#111">Encrypted attachments:</p>
      <ul style="padding-left:20px;margin-top:8px">${fileItems}</ul>`;

    filesText = '\n\nAttachments:\n' + fileAttachments.map(f =>
      `${f.name || 'file'}: ${frontendUrl}/decrypt#url=${encodeURIComponent(f.url)}&key=${f.file_key}&iv=${f.file_iv}&name=${encodeURIComponent(f.name || 'file')}`
    ).join('\n');
  }

  // ── Audio recording ─────────────────────────────────────────────────────────

  let audioHtml = '';
  let audioText = '';

  if (audioUrl) {
    if (audioKey && audioIv) {
      const viewerUrl = `${frontendUrl}/decrypt#url=${encodeURIComponent(audioUrl)}&key=${audioKey}&iv=${audioIv}&name=voice-recording.webm&type=audio`;
      audioHtml = `
        <p style="margin-top:20px">
          <a href="${viewerUrl}" style="color:#ff6b35;text-decoration:none;font-weight:600">
            🎙️ Encrypted voice recording — Decrypt &amp; Play →
          </a>
        </p>`;
      audioText = `\n\nVoice recording: ${viewerUrl}`;
    } else {
      audioHtml = `<p style="margin-top:16px"><a href="${audioUrl}" style="color:#ff6b35">🎙️ Listen to voice recording →</a></p>`;
      audioText = `\n\nVoice: ${audioUrl}`;
    }
  }

  // ── Full email ──────────────────────────────────────────────────────────────

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 24px">
      <h2 style="font-size:18px;color:#111;margin-bottom:4px">
        ✉️ New message on hollr.to/${handle || ''}
      </h2>
      <p style="color:#777;font-size:13px;margin-bottom:24px">
        From: <strong>${senderContact}</strong>
      </p>
      ${messageHtml}
      ${filesHtml}
      ${audioHtml}
      <p style="color:#bbb;font-size:12px;margin-top:40px">
        Sent via <a href="https://hollr.to" style="color:#bbb">hollr.to</a>
      </p>
    </div>`;

  const payload = {
    from:    fromEmail,
    to:      [toEmail],
    subject: `${isPgp ? '🔐 ' : ''}New message on hollr.to/${handle || ''}`,
    html,
    text:    `New message from ${senderContact}:\n\n${messageText}${filesText}${audioText}`,
  };

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderContact)) {
    payload.reply_to = [senderContact];
  }

  return resendPost(resendKey, payload);
}

module.exports = { sendMagicLink, forwardMessage };
