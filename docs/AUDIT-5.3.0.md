# hollr 5.3.0 — Security & honesty audit

**Date:** 2026-10-29 · **Audited version:** 5.2.9 · **Result:** shipped as 5.3.0

The goal was twofold: find real bugs, and check that every public claim about hollr is actually true of the code. Where a claim was not true, the code or the wording was changed. Nothing was "fixed" by deleting a feature.

## Method

1. **Manual review** of `server.js`, `db.js`, `crypto.js`, `mailer.js`, the canvas (`handle/index.html`), the landing page, the decrypt viewer and `.htaccess`.
2. **Mechanical checks:** syntax of every inline script, secret scan of the tree, `npm audit`, dead-file inventory.
3. **Independent model review.** The same ~92 KB bundle (all backend files, the decrypt page, the send flow, `.htaccess`) plus the list of public claims was sent through OpenRouter to two frontier models, each asked for exploitable issues with code evidence and a TRUE / PARTLY / FALSE verdict per claim:
   * `openai/gpt-6.1-sol`
   * `google/gemini-4-argon`

   Their output was treated as leads, not truth: every finding below was re-checked against the code before acting. The GPT run was cut off before it finished its claim table (it ended mid-table at C2), so its verdicts on C3–C10 are missing; the Gemini run completed.
4. **Executable proof.** A 37-assertion integration test now ships with the repo (`cd backend && npm test`), and a headless-browser run confirmed the canvas end to end: plaintext for a handle without a key, real ciphertext the owner can decrypt for a handle with a key, and nothing sent when the encryption library is blocked.

## Findings

Severity is the author's judgement after verification. "Found by": **S** = own review, **G** = GPT, **M** = Gemini.

| # | Finding | Sev. | Found by | Status in 5.3.0 |
|---|---|---|---|---|
| 1 | The canvas fell back to **sending plaintext** if PGP encryption failed (library blocked, offline, bad key), and the server accepted it for a handle that had a PGP key | High | S G M | **Fixed.** Browser aborts with a translated error; server rejects non-PGP bodies for PGP handles (`code: pgp_required`) |
| 2 | **Path traversal in upload:** the file extension came from the client filename unchecked and was joined into the write path | High | S M | **Fixed.** Extension reduced to `[a-z0-9.]`, max 10 chars; directory built from the stored handle, not the URL parameter |
| 3 | **Email injection / phishing:** `file_key`, `file_iv`, `audio_url` and attachment URLs from an anonymous sender were placed inside `href` attributes of an email sent from `yo@hollr.to` | High | S G M | **Fixed.** Server validates every attachment (own-origin URL for that handle, 64-hex key, 24-hex IV, max 10); mailer additionally URL-encodes parameters and escapes quotes |
| 4 | **Default PIN 1234 = account takeover:** handle + `1234` minted a settings token; `1234` could also be set "as a real PIN" through two paths | High | S G M | **Fixed.** Default-PIN accounts cannot obtain a settings token (they must use email); explicit `1234` is treated as default everywhere |
| 5 | **PIN brute force:** 4-digit PIN, limiter was per IP only, and the other PIN-checking routes had no guard | High | S G M | **Fixed.** Per-handle lockout (10 failures → 15 min) shared by every PIN check; constant-time verify so unknown handles are indistinguishable |
| 6 | **Settings-token authority too wide:** a PIN-only token could call `/api/handle/claim` and rewrite handle, PIN, email, keys in one request | High | G | **Fixed.** Claim requires a real login session |
| 7 | **Settings tokens survived** logout, PIN change and PIN reset | Med | S G M | **Fixed.** Revoked on all three (the token making the change stays valid) |
| 8 | **File keys persisted** in SQLite next to the encrypted files, so a DB + disk leak decrypted everything; non-PGP message bodies were stored in cleartext | Med | S G | **Fixed.** Keys are no longer stored (they only travel in the email); non-PGP bodies are encrypted at rest |
| 9 | **Unpinned third-party CDN** (`esm.sh/openpgp@5`) delivered the code that performs the encryption | Med | S M | **Fixed.** Self-hosted at `/vendor/openpgp-5.11.3.min.js`, exact version |
| 10 | `/api/upload` shared the 5/min budget with `/api/send`, so a message with 5 attachments could not be sent | Low | G | **Fixed.** Separate budget (20/min) |
| 11 | `forgot-pin` leaked which emails exist through response time and delivery errors | Low | G | **Fixed.** Immediate identical response; delivery runs in background |
| 12 | Handle checks used `LIKE '__pending_%'`, where `_` is a wildcard, so handles like `mypendingtask` were treated as placeholders | Low | S | **Fixed.** Exact prefix comparison; public routes no longer expose placeholder rows |
| 13 | `/api/handle/check` unthrottled (enumeration of the handle space) | Low | S | **Fixed.** 60/min per IP |
| 14 | Duplicate email on claim surfaced as a raw database 500; raw error text returned to clients | Low | M S | **Fixed.** Clean 409; generic 500 in production |
| 15 | `Reply-To` was dropped whenever a sender typed "Name (email)" | Low | S | **Fixed.** Address extracted from the string |
| 16 | Reserved handles were only checked at claim, so sign-up failed late | Low | S | **Fixed.** Rejected at the magic-link step; `pgp`, `vendor`, `security`, `privacy`, `terms` added |
| 17 | Dependencies: 1 critical, 2 high advisories (`proxy-addr`, `body-parser`, `multer`, `qs`) | High | S | **Fixed** by non-breaking `npm audit fix`. `uuid` advisory remains and is not reachable (see SECURITY.md) |
| 18 | Notification email not separately verified; account pre-hijack possible through the (currently disabled) X login | High if X is enabled | G M | **Open — documented.** X sign-in is disabled in the UI; fix before enabling |
| 19 | No per-handle storage quota or expiry for orphaned uploads | Med | G | **Open — documented** |
| 20 | Bearer tokens stored unhashed | Med | G | **Open — documented** |
| 21 | X OAuth hands the session to the frontend in a URL parameter | Med if X is enabled | G | **Open — documented** |
| 22 | Sender contact is unverified and used as Reply-To | Low | M | **Open — inherent** to anonymous messaging; documented |

Also removed from the repository: the legacy PHP scripts, an old root `index.html`, `cache/`, `landing-src/`, a duplicate stale `landing/handle/` and a stale root `.htaccess`. None were deployed or referenced.

## Public claims vs. the code

"Before" is what the site or README said (or implied) at 5.2.9. All verdicts were re-verified by hand, not copied from the models.

| Claim (5.2.9) | Verdict | Resolution |
|---|---|---|
| "Every hollr is PGP-encrypted before it leaves the sender's browser — nothing sits in plaintext, ever" | **False.** Only when the owner has set a PGP key, and it used to fall back to plaintext | Reworded to "add your PGP public key and…"; fallback removed; server enforces it |
| "Messages, voice and files are encrypted in transit and at rest. Nobody, not even us, can read them" | **Partly.** True for PGP messages; files/voice were encrypted by the *server* on arrival | Reworded per content type; see the table in `SECURITY.md` |
| "Everything is encrypted before upload" (files, voice) | **False.** Encrypted by the server after upload | Reworded: "our server encrypts it on arrival; the key travels only in your email and is never stored" (and made true: keys no longer persisted) |
| "0 messages stored by us" (hero statistic) | **False.** Messages are stored (encrypted) | Statistic replaced by "PGP — end-to-end, with your key" |
| "We generate your PGP keypair on setup" | **False.** No such code existed | New in-browser generator at `/pgp`; copy now says so |
| "Zero retention" and "bring your own S3 storage" wording in unused landing strings | **False** (messages are retained, encrypted; self-hosted storage is roadmap, Q3 2026) | Dead strings deleted so they cannot resurface |
| "Your private key never goes near our servers" | **True** | Unchanged; the new `/pgp` page makes no network requests |
| "hollr's server never sees the plaintext of PGP-encrypted messages" | **Partly** (true unless the fallback fired) | **True** after 5.3.0 |
| "Magic links expire in 15 minutes and work once" | **True** | Unchanged |
| "Wrong PIN and unknown handle return identical errors; verify is rate limited" | **Partly** (same body, different timing) | **True** after 5.3.0 (same body, same work, per-handle lockout) |
| "Email-enumeration protection on sign-in" | **Partly** (`forgot-pin` leaked through timing/errors) | **True** for sign-in and forgot-pin; claim/settings return 409 for an address already in use, which requires being logged in |
| "Handle squatting is prevented" | **Partly** (the `LIKE` bug above) | Fixed |
| Non-English landing copy: "Aucune donnée stockée", "hollr n'est jamais intermédiaire" … | **False** in several languages (stale text) | All six affected strings rewritten in all 10 languages |

## What the reviewers did and did not add

All three passes agreed on the headline issues (1, 3, 4, 5, 7). Of the findings above, the independent reviews added #6 (settings token reaching `/handle/claim`), #10 (shared rate limit), #11 (forgot-pin timing), the explicit-`1234` bypass in #4, and the whole of #18–#21, which are architectural and are documented rather than patched in a patch-level release. Gemini's headline "critical" rating for the default PIN was reasonable; GPT's claim table could not be compared past C2. Neither model saw the deployed system, only the source, so anything depending on configuration (Fly secrets, SiteGround headers) was verified separately.

## Not done, on purpose

* No change to the data model, endpoints, or UI flows beyond the above — "without breaking anything".
* No Content-Security-Policy on the static frontend yet. The pages use inline scripts and a font stylesheet; a correct policy needs a hash-based rollout and testing on the host, not a blind header.
* No claim that hollr is "audited" in the professional sense. This is a thorough self-review plus two independent automated reviews. Anything that matters should still get a human penetration test.
