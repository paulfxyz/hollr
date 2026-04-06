/**
 * mailer.js — Email delivery via Resend REST API for hollr.to (v5.1.0)
 * ──────────────────────────────────────────────────────────────────────
 *
 * OVERVIEW
 * ─────────
 * Two public functions handle all outbound email:
 *
 *   sendMagicLink(email, link, opts?)
 *     Platform-sent login / PIN-reset links using the platform Resend key.
 *     Always sent from yo@hollr.to (PLATFORM_FROM_EMAIL env var).
 *
 *   forwardMessage(opts)
 *     Delivers a user's incoming hollr to the handle owner's inbox.
 *     Uses the owner's own Resend key + from_email if configured,
 *     otherwise falls back to the platform key (yo@hollr.to).
 *
 * RESEND API
 * ──────────
 * We call Resend's REST API directly with Node's built-in https module —
 * no external HTTP client dependency. The payload is a simple JSON POST.
 * Resend returns { id } on success or { name, message } on error.
 *
 * DESIGN NOTES
 * ────────────
 *   • reply_to is set only when the sender's contact field is a valid email.
 *     Resend rejects requests where reply_to is null — omit the key entirely.
 *
 *   • File decrypt links use URL hash params (#key=…&iv=…) so the key
 *     material never reaches our server during the viewer request — it is
 *     parsed entirely client-side by decrypt/index.html.
 *
 *   • PGP-encrypted messages are rendered as a dark code block with a
 *     GPG usage hint. We never try to decrypt them server-side.
 *
 * KEY LESSON — null vs omitted keys
 * ───────────────────────────────────
 *   Early versions sent `reply_to: null` when the contact field was not
 *   an email. Resend rejected these with a 422. The fix is to only add
 *   the reply_to key to the payload when we have a valid email address.
 */

'use strict';

const https = require('https');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL HTTP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * resendPost
 * Raw HTTPS POST to the Resend /emails endpoint.
 * Returns the parsed JSON response (may contain { id } or { name, message }).
 *
 * We use Node's built-in https module to avoid adding an http-client
 * dependency — the payload is always small enough that streaming is not needed.
 *
 * @param  {string} apiKey   Resend API key (re_xxxx…)
 * @param  {object} payload  Resend email payload object
 * @returns {Promise<object>}
 */
function resendPost(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const url  = new URL(RESEND_ENDPOINT);

    const req = https.request({
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ raw }); }  // fallback if Resend sends non-JSON
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAGIC LINK / PIN RESET EMAILS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendMagicLink
 * Sends a one-time login link or PIN-reset link to the given address.
 *
 * Always uses the platform Resend key (PLATFORM_RESEND_KEY) — this is the
 * one hollr.to email function that is never delegated to the user's own key.
 *
 * @param  {string}  toEmail   recipient address
 * @param  {string}  link      full magic-link URL
 * @param  {object}  [opts]    optional overrides
 * @param  {string}  [opts.subject]     custom subject line
 * @param  {boolean} [opts.isPinReset]  true → show PIN-reset copy
 * @returns {Promise<object>}
 */
async function sendMagicLink(toEmail, link, opts = {}) {
  const apiKey = process.env.PLATFORM_RESEND_KEY;
  if (!apiKey) throw new Error('PLATFORM_RESEND_KEY is not set in environment');

  const isPinReset = opts.isPinReset || false;

  // Subject line
  const subject = opts.subject || (isPinReset
    ? 'Reset your hollr PIN'
    : 'Sign in to hollr');

  // Hero copy changes for PIN reset vs normal login
  const headline  = isPinReset ? '🔑 Reset your PIN' : '📢 hollr';
  const bodyText  = isPinReset
    ? 'Click below to reset your PIN. Your current PIN will be set back to 1234 — you\'ll be prompted to choose a new one immediately.'
    : 'Your secure, one-time login link. No password needed.';
  const btnLabel  = isPinReset ? 'Reset my PIN →' : 'Sign in to hollr →';

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#111">
      <h1 style="font-size:26px;margin:0 0 8px">${headline}</h1>
      <p style="color:#555;margin:0 0 32px;line-height:1.6">${bodyText}</p>

      <a href="${link}"
         style="display:inline-block;background:#1a1814;color:#f9f6f1;
                padding:14px 28px;border-radius:8px;text-decoration:none;
                font-weight:600;font-size:15px;letter-spacing:-.01em">
        ${btnLabel}
      </a>

      <p style="color:#999;font-size:13px;margin-top:32px;line-height:1.6">
        This link expires in 15 minutes and can only be used once.<br>
        If you didn't request this, you can safely ignore this email.
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
      <p style="color:#bbb;font-size:12px;margin:0">
        <a href="https://hollr.to" style="color:#bbb;text-decoration:none">hollr.to</a>
        — open-source encrypted messaging canvas
      </p>
    </div>`;

  return resendPost(apiKey, {
    from:    process.env.PLATFORM_FROM_EMAIL || 'hollr <yo@hollr.to>',
    to:      [toEmail],
    subject,
    html,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE FORWARDING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * forwardMessage
 * Delivers an incoming hollr to the handle owner's inbox.
 *
 * Delivery key selection (in priority order):
 *   1. User's own Resend key + from_email  (custom delivery)
 *   2. Platform key, from yo@hollr.to      (zero-config default)
 *
 * Message rendering:
 *   • Plain text  →  warm card block, sender name in header
 *   • PGP armour  →  dark code block with GPG usage hint
 *   • Files       →  list of decrypt viewer links (AES-256-GCM key in hash)
 *   • Voice       →  decrypt viewer link if encrypted, direct if not
 *
 * @param {object} opts
 * @param {string}   opts.resendKey         Resend API key to use
 * @param {string}   opts.fromEmail         Verified sender address
 * @param {string}   opts.toEmail           Handle owner's notification address
 * @param {string}   opts.senderContact     Freeform "from" field (name / email)
 * @param {string}   opts.message           Plaintext or PGP-armoured ciphertext
 * @param {boolean}  [opts.isPgp=false]     Is message PGP-encrypted?
 * @param {Array}    [opts.fileAttachments] [{url, name, file_key, file_iv}]
 * @param {string}   [opts.audioUrl]        URL to (possibly encrypted) voice
 * @param {string}   [opts.audioKey]        Hex key for encrypted voice
 * @param {string}   [opts.audioIv]         Hex IV for encrypted voice
 * @param {string}   [opts.handle]          Recipient handle (for subject line)
 * @returns {Promise<object>}               Resend API response
 */
async function forwardMessage(opts) {
  const {
    resendKey,
    fromEmail,
    toEmail,
    senderContact,
    message,
    isPgp         = false,
    fileAttachments = [],
    audioUrl,
    audioKey,
    audioIv,
    handle,
  } = opts;

  const frontendUrl = process.env.FRONTEND_URL || 'https://hollr.to';

  // ── Message body ───────────────────────────────────────────────────────────

  // HTML-escape user content before embedding in email templates
  const esc = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let messageHtml, messageText;

  if (isPgp) {
    // Show the raw PGP armour block. We never decrypt server-side.
    messageHtml = `
      <div style="background:#1a1a1a;border-radius:8px;padding:20px 24px;
                  border-left:4px solid #c96a2a">
        <p style="color:#c96a2a;font-size:11px;font-weight:700;margin:0 0 12px;
                   letter-spacing:.08em;text-transform:uppercase">
          🔐 PGP Encrypted Message
        </p>
        <pre style="font-family:monospace;font-size:11px;color:#d4ccc0;
                    white-space:pre-wrap;word-break:break-all;margin:0;
                    line-height:1.5">${esc(message)}</pre>
      </div>
      <p style="font-size:13px;color:#8a837a;margin-top:16px;line-height:1.6">
        This message was encrypted with your PGP public key.<br>
        Decrypt it using GPG: <code style="background:#f2ede6;padding:2px 6px;
        border-radius:4px;font-size:12px">gpg --decrypt message.asc</code>
      </p>`;
    messageText = `[PGP ENCRYPTED]\n\n${message}`;
  } else {
    // Plain message — warm card with line-break preservation
    messageHtml = `
      <div style="background:#f9f6f1;border-radius:8px;padding:24px;
                  border-left:4px solid #1a1814;font-size:15px;
                  color:#1a1814;line-height:1.7;white-space:pre-wrap">
        ${esc(message)}
      </div>`;
    messageText = message;
  }

  // ── File attachments (AES-256-GCM, client-side decrypt) ───────────────────

  let filesHtml = '';
  let filesText = '';

  if (fileAttachments.length > 0) {
    // Build decrypt-viewer URLs — key material goes in the hash, never the path.
    // Hash params are not sent to the server (RFC 3986 §3.5).
    const fileItems = fileAttachments.map((f) => {
      const viewerUrl = `${frontendUrl}/decrypt` +
        `#url=${encodeURIComponent(f.url)}` +
        `&key=${f.file_key}&iv=${f.file_iv}` +
        `&name=${encodeURIComponent(f.name || 'file')}`;
      return `
        <li style="margin-bottom:10px">
          <a href="${viewerUrl}" style="color:#c96a2a;text-decoration:none;font-weight:500">
            🔒 ${esc(f.name || 'Encrypted file')} — Decrypt &amp; Download →
          </a>
        </li>`;
    }).join('');

    filesHtml = `
      <p style="margin-top:28px;font-weight:600;color:#1a1814;font-size:14px">
        Encrypted attachments:
      </p>
      <ul style="padding-left:20px;margin-top:8px">${fileItems}</ul>`;

    filesText = '\n\nAttachments:\n' + fileAttachments.map((f) => {
      const viewerUrl = `${frontendUrl}/decrypt` +
        `#url=${encodeURIComponent(f.url)}&key=${f.file_key}&iv=${f.file_iv}`;
      return `  ${f.name || 'file'}: ${viewerUrl}`;
    }).join('\n');
  }

  // ── Voice recording ────────────────────────────────────────────────────────

  let audioHtml = '';
  let audioText = '';

  if (audioUrl) {
    if (audioKey && audioIv) {
      // Encrypted voice — link to decrypt viewer
      const viewerUrl = `${frontendUrl}/decrypt` +
        `#url=${encodeURIComponent(audioUrl)}` +
        `&key=${audioKey}&iv=${audioIv}` +
        `&name=voice-recording.webm&type=audio`;
      audioHtml = `
        <p style="margin-top:20px">
          <a href="${viewerUrl}"
             style="color:#c96a2a;text-decoration:none;font-weight:500;font-size:14px">
            🎙️ Encrypted voice recording — Decrypt &amp; Play →
          </a>
        </p>`;
      audioText = `\n\nVoice recording: ${viewerUrl}`;
    } else {
      // Unencrypted voice (legacy path)
      audioHtml = `
        <p style="margin-top:16px">
          <a href="${audioUrl}" style="color:#c96a2a;text-decoration:none">
            🎙️ Listen to voice recording →
          </a>
        </p>`;
      audioText = `\n\nVoice: ${audioUrl}`;
    }
  }

  // ── Full HTML email ────────────────────────────────────────────────────────

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;
                padding:40px 24px;color:#1a1814">

      <!-- Header -->
      <p style="font-size:12px;color:#8a837a;margin:0 0 4px;
                letter-spacing:.06em;text-transform:uppercase">
        hollr.to/${esc(handle || '')}
      </p>
      <h2 style="font-size:20px;color:#1a1814;margin:0 0 4px;
                 font-weight:700;letter-spacing:-.02em">
        ${isPgp ? '🔐 ' : ''}New message
      </h2>
      <p style="color:#8a837a;font-size:13px;margin:0 0 28px">
        From: <strong style="color:#1a1814">${esc(senderContact)}</strong>
      </p>

      <!-- Message -->
      ${messageHtml}

      <!-- Files + audio -->
      ${filesHtml}
      ${audioHtml}

      <!-- Footer -->
      <hr style="border:none;border-top:1px solid #e8e1d8;margin:36px 0">
      <p style="color:#bbb;font-size:12px;margin:0">
        Delivered by <a href="https://hollr.to" style="color:#bbb;text-decoration:none">
          hollr.to
        </a> — reply to sender if they left a valid email address.
      </p>
    </div>`;

  // ── Build Resend payload ───────────────────────────────────────────────────

  const payload = {
    from:    fromEmail,
    to:      [toEmail],
    subject: `${isPgp ? '🔐 ' : ''}New hollr${handle ? ` on hollr.to/${handle}` : ''}`,
    html,
    text:    `New message from ${senderContact}:\n\n${messageText}${filesText}${audioText}`,
  };

  // Only add reply_to when the contact field is a valid email address.
  // Sending reply_to: null causes Resend to return a 422 error.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderContact)) {
    payload.reply_to = [senderContact];
  }

  return resendPost(resendKey, payload);
}

module.exports = { sendMagicLink, forwardMessage };
