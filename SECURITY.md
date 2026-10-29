# Security

hollr is a small, open-source project run by one person. This document says plainly what it protects, what it does not, and how to report a problem. If a sentence on [hollr.to](https://hollr.to) ever disagrees with this file, this file (and the code) wins — please tell us.

Current version: **5.3.0** · Last full audit: **2026-10-29** ([report](docs/AUDIT-5.3.0.md))

---

## Reporting a vulnerability

Email **hello@paulfleury.com** or open a private advisory at [github.com/paulfxyz/hollr/security/advisories/new](https://github.com/paulfxyz/hollr/security/advisories/new). Please do not file public issues for exploitable bugs. Expect an acknowledgement within a few days; this is a hobby-scale project with no bug bounty.

---

## Who can read what

This is the honest data-flow, per kind of content.

| Content | Sender's browser | hollr server | Email provider (Resend) | Your inbox |
|---|---|---|---|---|
| **Message, PGP key set on the handle** | plaintext → encrypted with your public key (OpenPGP.js) | ciphertext only | ciphertext only | ciphertext; you decrypt with your private key |
| **Message, no PGP key** | plaintext | plaintext in memory while handling; stored **encrypted at rest** with a server secret (AES-256-CBC) | plaintext (it is the email body) | plaintext |
| **Voice note / files** | plaintext, uploaded over TLS | plaintext in memory on arrival, then encrypted with AES-256-GCM using a fresh random key; **the key is not stored**, it only travels in your notification email | the email contains a link whose `#fragment` carries the key | you open the link; decryption happens in your browser |
| **Sender name / contact** | plaintext | plaintext (stored with the message, used as Reply-To) | plaintext | plaintext |
| **Handle, timestamps** | – | plaintext | – | – |
| **Your Resend API key (optional)** | – | AES-256-CBC with a PBKDF2-derived key | – | – |
| **Your PIN** | – | bcrypt (cost 12) | – | – |

What this means in practice:

* With a **PGP key set**, the hollr operator cannot read the message text, not even by changing the database. That is the strongest mode and the one to use for anything sensitive. You can generate a key pair, with nothing uploaded, at [hollr.to/pgp](https://hollr.to/pgp).
* **Files and voice are not end-to-end encrypted.** The server sees them briefly while encrypting them. Anyone holding your notification email can open them.
* **Without a PGP key**, messages are protected from a database leak, not from the operator.
* **Metadata is never encrypted**: who wrote (the name/contact they typed), when, and to which handle.
* hollr does not read, scan, summarise or analyse message content, and has no feature that would need to.

## Guarantees the code enforces (and tests check)

* If a handle has a PGP key, the server **refuses plaintext** for it, and the browser **will not send** if encryption fails. There is no silent downgrade.
* The server only accepts attachment links that point to files it stored for that same handle, with well-formed 256-bit keys and 96-bit IVs. Nothing a stranger types can inject a link or markup into an email that is delivered from `yo@hollr.to`.
* Magic links expire after 15 minutes and work once.
* Wrong PIN and unknown handle return the same response, in the same time. After 10 wrong PINs a handle is locked for 15 minutes regardless of source IP.
* An account still on the temporary default PIN (1234) cannot be opened with handle + PIN alone.
* Settings tokens (2 h) are revoked on PIN change, PIN reset and logout.
* The encryption library is self-hosted and version-pinned; no third-party script runs on the canvas.

Run the checks yourself: `cd backend && npm test`.

## Known limitations

Documented rather than hidden. Roughly in order of importance:

1. **Notification email is not separately verified.** The *login* email is verified by magic link, but the notification address set during onboarding is accepted as typed. A user could point notifications at someone else's address. Planned: verify it by link before it receives anything.
2. **Files and voice are server-side encrypted, not end-to-end.** True operator-blind attachments need client-side encryption before upload. Planned.
3. **No storage quotas or expiry.** Uploads are capped at 50 MB each and rate-limited per IP, but there is no per-handle byte budget and no automatic deletion of orphaned uploads.
4. **Bearer tokens (sessions, settings tokens, magic-link tokens) are stored as-is** in SQLite, not hashed. Someone with the database file could use any unexpired one.
5. **X sign-in is disabled in the UI** ("Coming soon"). The backend routes remain; before enabling, the session hand-off must move from a URL parameter to a one-time code, and the X account must be linked only to a verified email.
6. **Rate limits and PIN lockout are in memory**, per server instance, and reset on restart. Fine for one Fly machine; use a shared store before scaling out.
7. **A 4-digit PIN is a small keyspace.** The lockout makes online guessing impractical; it does not protect against someone who has the database. The PIN guards settings only; it is not an encryption key.
8. **A logged-in session may change settings without re-entering the PIN.** A session already proves control of the login email; the PIN exists mainly so settings can be reached from a device that is not logged in.
9. **Sender identity is unverified.** The contact a sender types is shown and used as Reply-To exactly as written. Treat it as a claim, not a fact.
10. **Dependency advisory (low impact):** `uuid` 9.x is flagged for a bounds-check issue in v3/v5/v6 when a buffer argument is supplied. hollr only calls `v4()` without one.

## Scope

In scope: this repository, the live service at hollr.to / hollr-api.fly.dev. Out of scope: denial of service by volume, social engineering, findings that require a compromised device, and third-party services (Resend, Fly.io, SiteGround).
