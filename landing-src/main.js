/* hollr.to — main.js */

/* ── I18N — TRANSLATIONS ─────────────────────────────────────── */
const LANGS = {
  en: {
    code: 'EN', flag: '🇬🇧',
    nav_how: 'How it works', nav_features: 'Features',
    nav_cta: 'Claim your handle',
    hero_pill: 'Free & open source',
    hero_h1_1: 'Holla', hero_h1_2: 'at me.', hero_h1_3: 'Encrypted, on arrival.',
    hero_sub: 'Back in the day, you\'d holler across the block. hollr brings that energy online — give someone your link, hollr.to/yourname, and they can write, drop a voice note, or attach files straight to your inbox. PGP-encrypted before it leaves their screen.',
    hero_cta: 'Get your hollr link', hero_github: 'View on GitHub',
    mock_label: 'MESSAGE TO YOURNAME', mock_title: 'Say something worth writing.',
    mock_desc: 'This is a timed message canvas. The clock runs while you type — every second is spent actually writing.',
    mock_btn: '▶ Start writing',
    stat1_val: '100%', stat1_label: 'Always free, no cap',
    stat2_val: '0',    stat2_label: 'Messages stored by us',
    stat3_val: '10',   stat3_label: 'Languages — worldwide',
    stat4_val: '∞',   stat4_label: 'Handles to claim',
    how_eyebrow: 'How it works', how_title: 'Up and running\nin 60 seconds.',
    how_sub: "No app to download, no credit card, no DM requests sitting unread. Just a link people can actually use to reach you.",
    step1_title: 'Drop your email', step1_body: 'A magic link hits your inbox. No password, no account setup. One click and you\'re in.',
    step2_title: 'Claim your handle', step2_body: 'hollr.to/yourname — first come, first served. Your canvas goes live the second you pick it.',
    step3_title: 'Zero setup. Or bring your own.', step3_body: 'By default, hollrs arrive at yo@hollr.to — instant, no config. Plug in your own Resend key anytime and messages go straight to you.',
    step4_title: 'Put it out there', step4_body: 'Bio, email sig, business card, anywhere. Now anyone can holler at you — and actually reach you.',
    senders_eyebrow: 'What your senders see', senders_title: 'A canvas built for', senders_title_em: 'thoughtful messages.',
    senders_sub: 'When someone visits your hollr link, they get a distraction-free writing experience — not a contact form.',
    sp1_title: 'The writing space', sp1_body: 'A warm, literary card with numbered steps. No clutter, no distractions — just an invitation to write something meaningful.',
    sp2_title: 'The timer', sp2_body: 'The clock only runs while your sender is actively typing. Every second displayed is a second spent composing their message to you.',
    sp3_title: 'Send & receive', sp3_body: 'The message is encrypted and delivered instantly to your inbox via your own Resend API key. Zero data stored on hollr servers.',
    canvas_eyebrow: 'The canvas', canvas_title: 'A distraction-free\nmessage experience.',
    canvas_body: 'Your senders get a clean, fullscreen writing space. A quiet timer runs while they type — every second is a second spent actually composing, not staring at a blank screen.',
    canvas_b1: 'Timed writing canvas — no idle pressure', canvas_b2: 'Voice note recording, in-browser',
    canvas_b3: 'Drag-and-drop file attachments', canvas_b4: 'Message lands in your inbox instantly',
    canvas_send: 'Send message',
    feat_eyebrow: 'Features', feat_title: 'Everything you need,\nnothing you don\'t.',
    f1_title: 'Your API key, your inbox', f1_body: 'Messages are delivered via your own Resend account. hollr is never an intermediary — we see nothing.',
    f2_title: 'Timed canvas', f2_body: "An always-running timer shows senders how long they've been composing. No idle drifting — it's a writing tool.",
    f3_title: 'Voice notes', f3_body: 'Record directly in the browser. Audio is attached and delivered as a download link in your email.',
    f4_title: 'AES-256 encrypted', f4_body: 'Your Resend key is encrypted at rest with AES-256-CBC + PBKDF2. PIN-protected settings. Nothing in plaintext.',
    f5_title: '10 languages', f5_body: "EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. The canvas speaks your senders' language automatically.",
    f6_title: 'Fully open source', f6_body: 'MIT licensed. Fork it, self-host on Fly.io, extend it however you want. The code is yours.',
    priv_eyebrow: 'Privacy by design', priv_title: 'Everything encrypted.', priv_title_em: 'Nothing stored.',
    priv_sub: "Every message, voice note, and file that passes through hollr is end-to-end encrypted. We designed this so that even if you trust us — you don't have to.",
    p1_title: 'End-to-end encrypted', p1_body: 'Messages, voice recordings, and attached files are encrypted in transit and at rest. Nobody — not even us — can read what someone sends you.',
    p2_title: 'Bring your own storage', p2_body: 'Don\'t want to rely on our infrastructure? Connect your own S3-compatible bucket — Cloudflare R2, AWS S3, Backblaze B2 — and files go directly there. Your data, your rules.',
    p3_title: 'Zero retention', p3_body: 'hollr holds no copy of your messages. Once delivered to your inbox, the data is gone from our servers. We can\'t hand over what we don\'t have.',
    p4_title: 'Self-hostable', p4_body: 'Run your own instance on Fly.io or any Node.js host in minutes. Full control over every byte — keys, storage, and routing all belong to you.',
    test_eyebrow: 'What people say', test_title: 'Loved by creators\nand builders.',
    t1_text: '"I replaced my contact form with hollr. The timed canvas means people actually think about what they write. Every message I get now is thoughtful."',
    t1_name: 'Maya Lin', t1_role: 'Product Designer, SF',
    t2_text: '"Using my own Resend key means zero vendor lock-in. Messages arrive in my inbox like regular email. No dashboard to check, no app to open."',
    t2_name: 'Thomas Keller', t2_role: 'Indie Developer, Berlin',
    t3_text: '"My students use it for office hours. They send voice notes when text isn\'t enough. The encryption means their messages stay private."',
    t3_name: 'Aisha Rao', t3_role: 'Professor, University of Toronto',
    quote: '"Built with love + AI.\n100% vibe coding."',
    os_eyebrow: 'Open source', os_title: 'Built in the open.',
    os_sub: 'hollr is MIT licensed. Every line of code is on GitHub. Fork it, audit it, self-host it, or contribute back.',
    cta_eyebrow: 'Your hollr link is waiting.', cta_title: 'Let them holler.',
    cta_sub: "Drop your email, pick your handle, go live. From now on, anyone who wants to reach you has exactly one place to do it — encrypted end-to-end.",
    cta_btn: 'Get your hollr link', cta_note: 'No password. No spam. Unsubscribe whenever.',
    footer_copy: '© 2026 hollr · MIT License',
    modal_title: 'Claim your hollr handle',
    modal_sub: 'Connect with X and your Twitter handle becomes your hollr link — instantly. <strong>hollr.to/@you</strong>. Encrypted, no middleman.',
    modal_x_btn: 'Continue with X',
    modal_note: 'We only read your public X username. No DMs, no posting, no followers data.',
    modal_success_title: 'Handle claimed.', modal_success_body: 'Your link is live. Share it everywhere — bio, email footer, anywhere.',
    lang_modal_title: 'Choose your language',
  },
  fr: {
    code: 'FR', flag: '🇫🇷',
    nav_how: 'Comment ça marche', nav_features: 'Fonctionnalités',
    nav_cta: 'Réserver mon handle',
    hero_pill: 'Gratuit & open source',
    hero_h1_1: 'Votre espace de message,', hero_h1_2: 'votre handle.',
    hero_sub: 'hollr offre à chacun un lien personnel — hollr.to/tonnom — où les gens peuvent écrire, enregistrer et envoyer directement dans votre boîte mail. Aucun email exposé. Aucune donnée stockée.',
    hero_cta: 'Réserver mon handle', hero_github: 'Voir sur GitHub',
    mock_label: 'MESSAGE À PAULFXYZ', mock_title: 'Dites quelque chose qui vaut la peine.',
    mock_desc: 'Un espace d\u2019écriture chronométré. L\u2019horloge tourne pendant que vous tapez — chaque seconde compte.',
    mock_btn: '▶ Commencer',
    stat1_val: '100%', stat1_label: 'Gratuit pour toujours',
    stat2_val: '0',    stat2_label: 'Messages stockés',
    stat3_val: '10',   stat3_label: 'Langues',
    stat4_val: '∞',   stat4_label: 'Handles disponibles',
    how_eyebrow: 'Comment ça marche', how_title: 'Opérationnel\nen 60 secondes.',
    how_sub: 'Aucune configuration complexe. Juste votre email et un handle que vous voudrez partager.',
    step1_title: 'Entrez votre email', step1_body: 'Un lien magique arrive dans votre boîte mail. Aucun mot de passe. Un clic et vous êtes connecté.',
    step2_title: 'Choisissez votre handle', step2_body: 'hollr.to/tonnom — premier arrivé, premier servi. Votre espace est instantanément actif.',
    step3_title: 'Zéro config. Ou votre propre clé.', step3_body: 'Par défaut, vos hollrs arrivent à yo@hollr.to — sans configuration. Ajoutez votre clé Resend quand vous voulez.',
    step4_title: 'Partagez votre lien', step4_body: 'Mettez-le dans votre bio, signature ou carte de visite. N\u2019importe qui peut vous écrire, partout.',
    senders_eyebrow: 'Ce que vos expéditeurs voient', senders_title: 'Un canvas conçu pour', senders_title_em: 'des messages réfléchis.',
    senders_sub: 'Quand quelqu\u2019un visite votre lien hollr, il obtient un espace d\u2019écriture — pas un formulaire de contact.',
    sp1_title: 'L\u2019espace d\u2019écriture', sp1_body: 'Une carte littéraire chaleureuse avec des étapes numérotées. Aucune distraction.',
    sp2_title: 'Le minuteur', sp2_body: 'L\u2019horloge ne tourne que lorsque votre expéditeur écrit activement.',
    sp3_title: 'Envoyer et recevoir', sp3_body: 'Le message est chiffré et livré instantanément dans votre boîte via votre clé Resend.',
    canvas_eyebrow: 'Le canvas', canvas_title: 'Une expérience de message\nsans distraction.',
    canvas_body: 'Vos expéditeurs bénéficient d\u2019un espace d\u2019écriture plein écran et épuré. Un minuteur discret tourne pendant qu\u2019ils écrivent.',
    canvas_b1: 'Canvas chronométré', canvas_b2: 'Enregistrement vocal, dans le navigateur',
    canvas_b3: 'Pièces jointes par glisser-déposer', canvas_b4: 'Message reçu instantanément',
    canvas_send: 'Envoyer',
    feat_eyebrow: 'Fonctionnalités', feat_title: 'Tout ce qu\u2019il faut,\nrien de superflu.',
    f1_title: 'Votre clé API, votre boîte', f1_body: 'Les messages sont envoyés via votre compte Resend. hollr n\u2019est jamais intermédiaire.',
    f2_title: 'Canvas chronométré', f2_body: 'Un minuteur permanent montre aux expéditeurs combien de temps ils ont écrit.',
    f3_title: 'Notes vocales', f3_body: 'Enregistrez directement dans le navigateur. L\u2019audio est joint et livré en lien de téléchargement.',
    f4_title: 'Chiffré AES-256', f4_body: 'Votre clé Resend est chiffrée au repos avec AES-256-CBC + PBKDF2. Paramètres protégés par PIN.',
    f5_title: '10 langues', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. Le canvas parle la langue de vos expéditeurs automatiquement.',
    f6_title: 'Entièrement open source', f6_body: 'Licence MIT. Forkez-le, hébergez-le, étendez-le comme vous voulez.',
    priv_eyebrow: 'Vie privée par conception', priv_title: 'Tout est chiffré.', priv_title_em: 'Rien n\u2019est stocké.',
    priv_sub: 'Chaque message, note vocale et fichier qui passe par hollr est chiffré de bout en bout. Dessiné pour que vous n\u2019ayez pas à nous faire confiance.',
    p1_title: 'Chiffrement de bout en bout', p1_body: 'Messages, enregistrements vocaux et fichiers sont chiffrés en transit et au repos. Personne — pas même nous — ne peut lire vos messages.',
    p2_title: 'Votre propre stockage', p2_body: 'Connectez votre propre bucket S3 — Cloudflare R2, AWS S3, Backblaze B2 — et les fichiers y vont directement.',
    p3_title: 'Zéro rétention', p3_body: 'hollr ne conserve aucune copie de vos messages. Une fois livré, la donnée disparaît de nos serveurs.',
    p4_title: 'Auto-hébergeable', p4_body: 'Lancez votre propre instance sur Fly.io ou tout hôte Node.js en quelques minutes.',
    test_eyebrow: 'Ce qu\u2019on en dit', test_title: 'Apprécié par les créateurs\net les constructeurs.',
    t1_text: '"J\u2019ai remplacé mon formulaire de contact par hollr. Le canvas minuté fait que les gens réfléchissent avant d\u2019écrire."',
    t1_name: 'Maya Lin', t1_role: 'Designer Produit, SF',
    t2_text: '"Utiliser ma propre clé Resend signifie zéro dépendance. Les messages arrivent comme des emails normaux."',
    t2_name: 'Thomas Keller', t2_role: 'Développeur Indépendant, Berlin',
    t3_text: '"Mes étudiants l\u2019utilisent pour les heures de bureau. Ils envoient des notes vocales quand le texte ne suffit pas."',
    t3_name: 'Aisha Rao', t3_role: 'Professeure, Université de Toronto',
    quote: '"Fait avec amour + IA.\n100% vibe coding."',
    os_eyebrow: 'Open source', os_title: 'Construit au grand jour.',
    os_sub: 'hollr est sous licence MIT. Chaque ligne de code est sur GitHub.',
    cta_eyebrow: 'Votre handle vous attend.', cta_title: 'Prêt à être contacté ?',
    cta_sub: 'Entrez votre email et nous enverrons un lien magique. Choisissez un handle. Vous êtes en ligne en moins d\u2019une minute.',
    cta_btn: 'Obtenir mon handle', cta_note: 'Aucun mot de passe. Pas de spam. Désinscription libre.',
    footer_copy: '© 2026 hollr · Licence MIT',
    modal_title: 'Réserver votre handle',
    modal_sub: 'Connectez-vous avec X et votre identifiant Twitter devient votre lien hollr — instantanément. <strong>hollr.to/@vous</strong>.',
    modal_x_btn: 'Continuer avec X',
    modal_note: 'Nous lisons uniquement votre nom d\'utilisateur X public. Aucun DM, aucune publication.',
    modal_success_title: 'Handle réservé.', modal_success_body: 'Votre lien est actif. Partagez-le partout — bio, signature, carte de visite.',
    lang_modal_title: 'Choisissez votre langue',
  },
  de: {
    code: 'DE', flag: '🇩🇪',
    nav_how: 'So funktioniert es', nav_features: 'Funktionen',
    nav_cta: 'Handle sichern',
    hero_pill: 'Kostenlos & Open Source',
    hero_h1_1: 'Deine Nachrichtenfläche,', hero_h1_2: 'dein Handle.',
    hero_sub: 'hollr gibt jedem einen persönlichen Link — hollr.to/deinname — wo andere schreiben, aufnehmen und direkt in dein Postfach senden können.',
    hero_cta: 'Handle sichern', hero_github: 'Auf GitHub ansehen',
    mock_label: 'NACHRICHT AN PAULFXYZ', mock_title: 'Sag etwas, das es wert ist.',
    mock_desc: 'Eine zeitgesteuerte Schreibfläche. Die Uhr läuft während du tippst.',
    mock_btn: '▶ Schreiben beginnen',
    stat1_val: '100%', stat1_label: 'Dauerhaft kostenlos',
    stat2_val: '0',    stat2_label: 'Gespeicherte Nachrichten',
    stat3_val: '10',   stat3_label: 'Sprachen',
    stat4_val: '∞',   stat4_label: 'Handles verfügbar',
    how_eyebrow: 'So funktioniert es', how_title: 'Einsatzbereit\nin 60 Sekunden.',
    how_sub: 'Kein kompliziertes Setup. Nur deine E-Mail und ein Handle, den du teilen willst.',
    step1_title: 'E-Mail eingeben', step1_body: 'Ein Magic Link landet in deinem Postfach. Kein Passwort. Ein Klick und du bist drin.',
    step2_title: 'Handle wählen', step2_body: 'hollr.to/deinname — wer zuerst kommt, mahlt zuerst.',
    step3_title: 'Null Setup. Oder eigener Key.', step3_body: 'Standardmäßig kommen Hollrs bei yo@hollr.to an — sofort, ohne Konfiguration. Deinen Resend-Key kannst du jederzeit hinzufügen.',
    step4_title: 'Link teilen', step4_body: 'In Bio, E-Mail-Signatur oder Visitenkarte. Jeder kann dich von überall erreichen.',
    senders_eyebrow: 'Was deine Absender sehen', senders_title: 'Ein Canvas für', senders_title_em: 'durchdachte Nachrichten.',
    senders_sub: 'Wenn jemand deinen hollr-Link besucht, bekommt er einen ablenkungsfreien Schreibbereich.',
    sp1_title: 'Der Schreibbereich', sp1_body: 'Eine warme Karte mit nummerierten Schritten. Keine Ablenkung.',
    sp2_title: 'Der Timer', sp2_body: 'Die Uhr läuft nur, während dein Absender aktiv tippt.',
    sp3_title: 'Senden & Empfangen', sp3_body: 'Die Nachricht wird verschlüsselt und sofort in deinem Postfach zugestellt.',
    canvas_eyebrow: 'Die Fläche', canvas_title: 'Eine ablenkungsfreie\nNachrichtenerfahrung.',
    canvas_body: 'Deine Absender erhalten einen sauberen, bildschirmfüllenden Schreibbereich. Ein leiser Timer läuft.',
    canvas_b1: 'Zeitgesteuertes Schreiben', canvas_b2: 'Sprachnotizen im Browser',
    canvas_b3: 'Datei-Anhänge per Drag & Drop', canvas_b4: 'Nachricht landet sofort im Postfach',
    canvas_send: 'Senden',
    feat_eyebrow: 'Funktionen', feat_title: 'Alles was du brauchst,\nnichts was du nicht brauchst.',
    f1_title: 'Dein API-Schlüssel, dein Postfach', f1_body: 'Nachrichten werden über dein Resend-Konto geliefert. hollr ist nie Mittelmann.',
    f2_title: 'Zeitgesteuert', f2_body: 'Ein immer laufender Timer zeigt Absendern, wie lange sie schreiben.',
    f3_title: 'Sprachnotizen', f3_body: 'Direkt im Browser aufnehmen. Audio wird als Download-Link geliefert.',
    f4_title: 'AES-256 verschlüsselt', f4_body: 'Dein Resend-Schlüssel ist mit AES-256-CBC + PBKDF2 verschlüsselt. PIN-geschützte Einstellungen.',
    f5_title: '10 Sprachen', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. Die Fläche spricht die Sprache deiner Absender.',
    f6_title: 'Vollständig Open Source', f6_body: 'MIT-Lizenz. Forke es, hoste es selbst, erweitere es wie du willst.',
    priv_eyebrow: 'Datenschutz by Design', priv_title: 'Alles verschlüsselt.', priv_title_em: 'Nichts gespeichert.',
    priv_sub: 'Jede Nachricht, Sprachnotiz und Datei durch hollr ist Ende-zu-Ende verschlüsselt.',
    p1_title: 'Ende-zu-Ende-Verschlüsselung', p1_body: 'Nachrichten, Sprachaufnahmen und Dateien sind verschlüsselt. Niemand — nicht einmal wir — kann lesen was gesendet wird.',
    p2_title: 'Eigener Speicher', p2_body: 'Verbinde deinen eigenen S3-Bucket — Cloudflare R2, AWS S3, Backblaze B2 — und Dateien gehen direkt dorthin.',
    p3_title: 'Null Retention', p3_body: 'hollr speichert keine Kopie deiner Nachrichten. Nach der Zustellung ist die Daten weg.',
    p4_title: 'Selbst-hostbar', p4_body: 'Betreibe deine eigene Instanz auf Fly.io oder jedem Node.js-Host in Minuten.',
    test_eyebrow: 'Was andere sagen', test_title: 'Beliebt bei Kreativen\nund Machern.',
    t1_text: '"Ich habe mein Kontaktformular durch hollr ersetzt. Der Timer sorgt dafür, dass Leute nachdenken."',
    t1_name: 'Maya Lin', t1_role: 'Produktdesignerin, SF',
    t2_text: '"Mein eigener Resend-Schlüssel bedeutet keine Abhängigkeit. Nachrichten kommen als normale E-Mails."',
    t2_name: 'Thomas Keller', t2_role: 'Indie-Entwickler, Berlin',
    t3_text: '"Meine Studenten nutzen es für Sprechstunden. Die Verschlüsselung hält ihre Nachrichten privat."',
    t3_name: 'Aisha Rao', t3_role: 'Professorin, Universität Toronto',
    quote: '"Gebaut mit Liebe + KI.\n100% Vibe Coding."',
    os_eyebrow: 'Open Source', os_title: 'Öffentlich entwickelt.',
    os_sub: 'hollr ist MIT-lizenziert. Jede Zeile Code ist auf GitHub.',
    cta_eyebrow: 'Dein Handle wartet.', cta_title: 'Bereit erreichbar zu sein?',
    cta_sub: 'Gib deine E-Mail ein und wir schicken dir einen Magic Link. Wähle einen Handle. Du bist in unter einer Minute live.',
    cta_btn: 'Handle holen', cta_note: 'Kein Passwort. Kein Spam. Jederzeit abmelden.',
    footer_copy: '© 2026 hollr · MIT-Lizenz',
    modal_title: 'Handle sichern',
    modal_sub: 'Mit X verbinden und dein Twitter-Handle wird sofort dein hollr-Link. <strong>hollr.to/@du</strong>.',
    modal_x_btn: 'Weiter mit X',
    modal_note: 'Wir lesen nur deinen öffentlichen X-Nutzernamen. Keine DMs, kein Posten.',
    modal_success_title: 'Handle gesichert.', modal_success_body: 'Dein Link ist live. Teile ihn überall — Bio, E-Mail-Signatur, Visitenkarte.',
    lang_modal_title: 'Sprache wählen',
  },
  it: {
    code: 'IT', flag: '🇮🇹',
    nav_how: 'Come funziona', nav_features: 'Funzionalità',
    nav_cta: 'Scegli il tuo handle',
    hero_pill: 'Gratuito & open source',
    hero_h1_1: 'Il tuo spazio messaggi,', hero_h1_2: 'il tuo handle.',
    hero_sub: 'hollr dà a chiunque un link personale — hollr.to/tuonome — dove le persone possono scrivere, registrare e inviare direttamente alla tua casella.',
    hero_cta: 'Scegli il tuo handle', hero_github: 'Vedi su GitHub',
    mock_label: 'MESSAGGIO A PAULFXYZ', mock_title: 'Di\u2019 qualcosa che vale la pena.',
    mock_desc: 'Uno spazio di scrittura a tempo. Il timer gira mentre scrivi.',
    mock_btn: '▶ Inizia a scrivere',
    stat1_val: '100%', stat1_label: 'Sempre gratuito',
    stat2_val: '0',    stat2_label: 'Messaggi salvati',
    stat3_val: '10',   stat3_label: 'Lingue',
    stat4_val: '∞',   stat4_label: 'Handle disponibili',
    how_eyebrow: 'Come funziona', how_title: 'Operativo\nin 60 secondi.',
    how_sub: 'Nessuna configurazione complessa. Solo la tua email e un handle che vorrai condividere.',
    step1_title: 'Inserisci la tua email', step1_body: 'Un link magico arriva nella tua casella. Nessuna password. Un clic e sei dentro.',
    step2_title: 'Scegli il tuo handle', step2_body: 'hollr.to/tuonome — primo arrivato, primo servito.',
    step3_title: 'Zero config. O chiave tua.', step3_body: 'Di default, i hollr arrivano a yo@hollr.to — istantaneamente, senza setup. Aggiungi la tua chiave Resend quando vuoi.',
    step4_title: 'Condividi il link', step4_body: 'Mettilo nella bio, firma email o biglietto da visita.',
    senders_eyebrow: 'Cosa vedono i tuoi mittenti', senders_title: 'Un canvas per', senders_title_em: 'messaggi pensati.',
    senders_sub: 'Quando qualcuno visita il tuo link hollr, ottiene uno spazio di scrittura — non un modulo di contatto.',
    sp1_title: 'Lo spazio di scrittura', sp1_body: 'Una carta letteraria con passaggi numerati. Nessuna distrazione.',
    sp2_title: 'Il timer', sp2_body: 'L\u2019orologio gira solo mentre il mittente scrive attivamente.',
    sp3_title: 'Invia e ricevi', sp3_body: 'Il messaggio è cifrato e consegnato nella tua casella tramite Resend.',
    canvas_eyebrow: 'Il canvas', canvas_title: 'Un\u2019esperienza messaggi\nsenza distrazioni.',
    canvas_body: 'I tuoi mittenti ottengono uno spazio di scrittura pulito e a schermo intero. Un timer silenzioso scorre.',
    canvas_b1: 'Canvas a tempo', canvas_b2: 'Registrazione vocale nel browser',
    canvas_b3: 'Allegati drag & drop', canvas_b4: 'Messaggio nella casella istantaneamente',
    canvas_send: 'Invia messaggio',
    feat_eyebrow: 'Funzionalità', feat_title: 'Tutto ciò che serve,\nnulla di superfluo.',
    f1_title: 'La tua chiave API, la tua casella', f1_body: 'I messaggi vengono consegnati tramite il tuo account Resend. hollr non è mai intermediario.',
    f2_title: 'Canvas a tempo', f2_body: 'Un timer sempre attivo mostra ai mittenti quanto hanno scritto.',
    f3_title: 'Note vocali', f3_body: 'Registra direttamente nel browser. L\u2019audio viene allegato come link.',
    f4_title: 'Crittografia AES-256', f4_body: 'La tua chiave Resend è cifrata con AES-256-CBC + PBKDF2.',
    f5_title: '10 lingue', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. Il canvas parla la lingua dei tuoi mittenti.',
    f6_title: 'Completamente open source', f6_body: 'Licenza MIT. Forkalo, ospitalo, estendilo come vuoi.',
    priv_eyebrow: 'Privacy by design', priv_title: 'Tutto cifrato.', priv_title_em: 'Nulla memorizzato.',
    priv_sub: 'Ogni messaggio, nota vocale e file che passa per hollr è cifrato end-to-end.',
    p1_title: 'Crittografia end-to-end', p1_body: 'Messaggi, registrazioni vocali e file sono cifrati. Nessuno — nemmeno noi — può leggerli.',
    p2_title: 'Porta il tuo storage', p2_body: 'Collega il tuo bucket S3 — Cloudflare R2, AWS S3, Backblaze B2 — e i file vanno direttamente lì.',
    p3_title: 'Zero retention', p3_body: 'hollr non conserva copie dei messaggi. Consegnato = cancellato dai nostri server.',
    p4_title: 'Auto-ospitabile', p4_body: 'Avvia la tua istanza su Fly.io o qualsiasi host Node.js in pochi minuti.',
    test_eyebrow: 'Cosa dicono', test_title: 'Amato da creatori\ne sviluppatori.',
    t1_text: '"Ho sostituito il mio modulo di contatto con hollr. Il canvas a tempo fa pensare prima di scrivere."',
    t1_name: 'Maya Lin', t1_role: 'Product Designer, SF',
    t2_text: '"La mia chiave Resend significa zero dipendenze. I messaggi arrivano come email normali."',
    t2_name: 'Thomas Keller', t2_role: 'Sviluppatore Indie, Berlin',
    t3_text: '"I miei studenti lo usano per le ore di ricevimento. La crittografia mantiene i messaggi privati."',
    t3_name: 'Aisha Rao', t3_role: 'Professoressa, Università di Toronto',
    quote: '"Creato con amore + IA.\n100% vibe coding."',
    os_eyebrow: 'Open source', os_title: 'Costruito alla luce del sole.',
    os_sub: 'hollr è sotto licenza MIT. Ogni riga di codice è su GitHub.',
    cta_eyebrow: 'Il tuo handle ti aspetta.', cta_title: 'Pronto ad essere contattato?',
    cta_sub: "Inserisci la tua email e ti invieremo un link magico. Scegli un handle. Sei live in meno di un minuto.",
    cta_btn: 'Ottieni il tuo handle', cta_note: 'Nessuna password. Nessuno spam.',
    footer_copy: '© 2026 hollr · Licenza MIT',
    modal_title: 'Scegli il tuo handle',
    modal_sub: 'Connettiti con X e il tuo handle Twitter diventa il tuo link hollr — immediatamente. <strong>hollr.to/@tu</strong>.',
    modal_x_btn: 'Continua con X',
    modal_note: 'Leggiamo solo il tuo nome utente pubblico di X. Nessun DM, nessuna pubblicazione.',
    modal_success_title: 'Handle confermato.', modal_success_body: 'Il tuo link è attivo. Condividilo ovunque — bio, firma email, biglietto da visita.',
    lang_modal_title: 'Scegli la tua lingua',
  },
  es: {
    code: 'ES', flag: '🇪🇸',
    nav_how: 'Cómo funciona', nav_features: 'Características',
    nav_cta: 'Elige tu handle',
    hero_pill: 'Gratis y de código abierto',
    hero_h1_1: 'Tu lienzo de mensajes,', hero_h1_2: 'tu handle.',
    hero_sub: 'hollr le da a cualquiera un enlace personal — hollr.to/tunombre — donde la gente puede escribir, grabar y enviar directamente a tu bandeja de entrada.',
    hero_cta: 'Elige tu handle', hero_github: 'Ver en GitHub',
    mock_label: 'MENSAJE A PAULFXYZ', mock_title: 'Di algo que valga la pena.',
    mock_desc: 'Un lienzo de escritura cronometrado. El reloj corre mientras escribes.',
    mock_btn: '▶ Empezar a escribir',
    stat1_val: '100%', stat1_label: 'Gratis para siempre',
    stat2_val: '0',    stat2_label: 'Mensajes almacenados',
    stat3_val: '10',   stat3_label: 'Idiomas',
    stat4_val: '∞',   stat4_label: 'Handles disponibles',
    how_eyebrow: 'Cómo funciona', how_title: 'En marcha\nen 60 segundos.',
    how_sub: 'Sin configuración compleja. Solo tu email y un handle que querrás compartir.',
    step1_title: 'Introduce tu email', step1_body: 'Un enlace mágico llega a tu bandeja. Sin contraseña. Un clic y ya estás dentro.',
    step2_title: 'Elige tu handle', step2_body: 'hollr.to/tunombre — el primero en llegar, el primero en ser servido.',
    step3_title: 'Cero config. O tu propia clave.', step3_body: 'Por defecto, los hollrs llegan a yo@hollr.to — sin configuración. Añade tu clave Resend cuando quieras.',
    step4_title: 'Comparte tu enlace', step4_body: 'Ponlo en tu bio, firma de email o tarjeta de visita.',
    senders_eyebrow: 'Lo que ven tus remitentes', senders_title: 'Un lienzo para', senders_title_em: 'mensajes reflexivos.',
    senders_sub: 'Cuando alguien visita tu enlace hollr, obtiene un espacio de escritura — no un formulario de contacto.',
    sp1_title: 'El espacio de escritura', sp1_body: 'Una tarjeta cálida con pasos numerados. Sin desorden ni distracciones.',
    sp2_title: 'El temporizador', sp2_body: 'El reloj solo corre mientras tu remitente escribe activamente.',
    sp3_title: 'Enviar y recibir', sp3_body: 'El mensaje se cifra y entrega instantáneamente en tu bandeja vía Resend.',
    canvas_eyebrow: 'El lienzo', canvas_title: 'Una experiencia de mensaje\nsin distracciones.',
    canvas_body: 'Tus remitentes obtienen un espacio de escritura limpio a pantalla completa. Un temporizador silencioso corre.',
    canvas_b1: 'Lienzo cronometrado', canvas_b2: 'Grabación de voz en el navegador',
    canvas_b3: 'Adjuntos drag & drop', canvas_b4: 'Mensaje en tu bandeja al instante',
    canvas_send: 'Enviar mensaje',
    feat_eyebrow: 'Características', feat_title: 'Todo lo que necesitas,\nnada más.',
    f1_title: 'Tu clave API, tu bandeja', f1_body: 'Los mensajes se entregan vía tu cuenta Resend. hollr nunca es intermediario.',
    f2_title: 'Lienzo cronometrado', f2_body: 'Un temporizador siempre activo muestra a los remitentes cuánto tiempo llevan escribiendo.',
    f3_title: 'Notas de voz', f3_body: 'Graba directamente en el navegador. El audio se adjunta como enlace de descarga.',
    f4_title: 'Cifrado AES-256', f4_body: 'Tu clave Resend está cifrada con AES-256-CBC + PBKDF2.',
    f5_title: '10 idiomas', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. El lienzo habla el idioma de tus remitentes.',
    f6_title: 'Totalmente open source', f6_body: 'Licencia MIT. Forkéalo, alójalo, extiéndelo como quieras.',
    priv_eyebrow: 'Privacidad por diseño', priv_title: 'Todo cifrado.', priv_title_em: 'Nada almacenado.',
    priv_sub: 'Cada mensaje, nota de voz y archivo que pasa por hollr está cifrado de extremo a extremo.',
    p1_title: 'Cifrado extremo a extremo', p1_body: 'Mensajes, grabaciones de voz y archivos están cifrados. Nadie — ni nosotros — puede leerlos.',
    p2_title: 'Trae tu propio almacenamiento', p2_body: 'Conecta tu propio bucket S3 — Cloudflare R2, AWS S3, Backblaze B2 — y los archivos van allí directamente.',
    p3_title: 'Cero retención', p3_body: 'hollr no guarda copia de tus mensajes. Una vez entregado, el dato desaparece.',
    p4_title: 'Auto-alojable', p4_body: 'Ejecuta tu propia instancia en Fly.io o cualquier host Node.js en minutos.',
    test_eyebrow: 'Lo que dicen', test_title: 'Amado por creadores\ny desarrolladores.',
    t1_text: '"Reemplacé mi formulario de contacto con hollr. El canvas cronometrado hace que la gente piense antes de escribir."',
    t1_name: 'Maya Lin', t1_role: 'Diseñadora de Producto, SF',
    t2_text: '"Usar mi propia clave Resend significa cero dependencia. Los mensajes llegan como emails normales."',
    t2_name: 'Thomas Keller', t2_role: 'Desarrollador Indie, Berlín',
    t3_text: '"Mis estudiantes lo usan para horas de oficina. El cifrado mantiene sus mensajes privados."',
    t3_name: 'Aisha Rao', t3_role: 'Profesora, Universidad de Toronto',
    quote: '"Hecho con amor + IA.\n100% vibe coding."',
    os_eyebrow: 'Código abierto', os_title: 'Construido abiertamente.',
    os_sub: 'hollr tiene licencia MIT. Cada línea de código está en GitHub.',
    cta_eyebrow: 'Tu handle te espera.', cta_title: '¿Listo para que te encuentren?',
    cta_sub: 'Introduce tu email y te enviaremos un enlace mágico. Elige un handle. En menos de un minuto estás en vivo.',
    cta_btn: 'Consigue tu handle', cta_note: 'Sin contraseña. Sin spam. Cancela cuando quieras.',
    footer_copy: '© 2026 hollr · Licencia MIT',
    modal_title: 'Elige tu handle',
    modal_sub: 'Conéctate con X y tu nombre de Twitter se convierte en tu link hollr — al instante. <strong>hollr.to/@tú</strong>.',
    modal_x_btn: 'Continuar con X',
    modal_note: 'Solo leemos tu nombre de usuario público de X. Sin DMs, sin publicaciones.',
    modal_success_title: 'Handle confirmado.', modal_success_body: 'Tu link está activo. Compártelo en todas partes — bio, firma de email, tarjeta.',
    lang_modal_title: 'Elige tu idioma',
  },
  nl: {
    code: 'NL', flag: '🇳🇱',
    nav_how: 'Hoe het werkt', nav_features: 'Functies',
    nav_cta: 'Claim je handle',
    hero_pill: 'Gratis & open source',
    hero_h1_1: 'Jouw berichtdoek,', hero_h1_2: 'jouw handle.',
    hero_sub: 'hollr geeft iedereen een persoonlijke link — hollr.to/jounaam — waar mensen kunnen schrijven, opnemen en direct naar je inbox sturen.',
    hero_cta: 'Claim je handle', hero_github: 'Bekijk op GitHub',
    mock_label: 'BERICHT AAN PAULFXYZ', mock_title: 'Zeg iets dat de moeite waard is.',
    mock_desc: 'Een getimede schrijfruimte. De klok loopt terwijl je typt.',
    mock_btn: '▶ Begin met schrijven',
    stat1_val: '100%', stat1_label: 'Altijd gratis',
    stat2_val: '0',    stat2_label: 'Berichten opgeslagen',
    stat3_val: '10',   stat3_label: 'Talen',
    stat4_val: '∞',   stat4_label: 'Handles beschikbaar',
    how_eyebrow: 'Hoe het werkt', how_title: 'Operationeel\nin 60 seconden.',
    how_sub: 'Geen ingewikkelde setup. Alleen je e-mail en een handle die je wilt delen.',
    step1_title: 'Vul je e-mail in', step1_body: 'Een magische link komt in je inbox. Geen wachtwoord. Één klik en je bent binnen.',
    step2_title: 'Kies je handle', step2_body: 'hollr.to/jounaam — wie het eerst komt, het eerst maalt.',
    step3_title: 'Nul setup. Of eigen sleutel.', step3_body: 'Standaard komen hollrs binnen bij yo@hollr.to — direct, zonder configuratie. Voeg je Resend-sleutel toe wanneer je wilt.',
    step4_title: 'Deel je link', step4_body: 'Zet hem in je bio, e-mailhandtekening of visitekaartje.',
    senders_eyebrow: 'Wat je verzenders zien', senders_title: 'Een doek voor', senders_title_em: 'doordachte berichten.',
    senders_sub: 'Wanneer iemand je hollr-link bezoekt, krijgt hij een schrijfervaring — geen contactformulier.',
    sp1_title: 'De schrijfruimte', sp1_body: 'Een warme kaart met genummerde stappen. Geen afleiding.',
    sp2_title: 'De timer', sp2_body: 'De klok loopt alleen terwijl je verzender actief typt.',
    sp3_title: 'Verstuur en ontvang', sp3_body: 'Het bericht wordt versleuteld en direct in je inbox bezorgd via Resend.',
    canvas_eyebrow: 'Het doek', canvas_title: 'Een afleidingsvrije\nberichtervaring.',
    canvas_body: 'Je verzenders krijgen een rustige, schermvullende schrijfruimte. Een stille timer loopt.',
    canvas_b1: 'Getimede schrijfruimte', canvas_b2: 'Spraakopname in de browser',
    canvas_b3: 'Bijlagen via slepen en neerzetten', canvas_b4: 'Bericht direct in je inbox',
    canvas_send: 'Stuur bericht',
    feat_eyebrow: 'Functies', feat_title: 'Alles wat je nodig hebt,\nniets meer.',
    f1_title: 'Jouw API-sleutel, jouw inbox', f1_body: 'Berichten worden geleverd via je eigen Resend-account. hollr is nooit tussenpersoon.',
    f2_title: 'Getimede ruimte', f2_body: 'Een altijd lopende timer toont verzenders hoe lang ze hebben geschreven.',
    f3_title: 'Spraaknotities', f3_body: 'Neem direct op in de browser. Audio wordt als downloadlink geleverd.',
    f4_title: 'AES-256 versleuteld', f4_body: 'Je Resend-sleutel is versleuteld met AES-256-CBC + PBKDF2.',
    f5_title: '10 talen', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. Het doek spreekt automatisch de taal van je verzenders.',
    f6_title: 'Volledig open source', f6_body: 'MIT-licentie. Fork het, host het zelf, breid het uit.',
    priv_eyebrow: 'Privacy by design', priv_title: 'Alles versleuteld.', priv_title_em: 'Niets opgeslagen.',
    priv_sub: 'Elk bericht, spraaknotitie en bestand dat door hollr gaat is end-to-end versleuteld.',
    p1_title: 'End-to-end versleuteld', p1_body: 'Berichten, spraakopnames en bestanden zijn versleuteld. Niemand — zelfs wij niet — kan lezen wat iemand stuurt.',
    p2_title: 'Breng je eigen opslag', p2_body: 'Verbind je eigen S3-bucket — Cloudflare R2, AWS S3, Backblaze B2 — en bestanden gaan er direct naartoe.',
    p3_title: 'Nul retentie', p3_body: 'hollr bewaart geen kopie van je berichten. Na levering zijn ze weg van onze servers.',
    p4_title: 'Zelf te hosten', p4_body: 'Draai je eigen instantie op Fly.io of een Node.js-host in minuten.',
    test_eyebrow: 'Wat mensen zeggen', test_title: 'Geliefd bij makers\nen bouwers.',
    t1_text: '"Ik heb mijn contactformulier vervangen door hollr. De timer zorgt dat mensen nadenken."',
    t1_name: 'Maya Lin', t1_role: 'Productontwerper, SF',
    t2_text: '"Mijn eigen Resend-sleutel betekent geen afhankelijkheid. Berichten komen als normale e-mails."',
    t2_name: 'Thomas Keller', t2_role: 'Indie Ontwikkelaar, Berlijn',
    t3_text: '"Mijn studenten gebruiken het voor spreekuren. De versleuteling houdt berichten privé."',
    t3_name: 'Aisha Rao', t3_role: 'Professor, Universiteit van Toronto',
    quote: '"Gebouwd met liefde + AI.\n100% vibe coding."',
    os_eyebrow: 'Open source', os_title: 'Open gebouwd.',
    os_sub: 'hollr heeft een MIT-licentie. Elke regel code staat op GitHub.',
    cta_eyebrow: 'Je handle wacht op je.', cta_title: 'Klaar om bereikt te worden?',
    cta_sub: 'Vul je e-mail in en we sturen een magische link. Kies een handle. Je bent in minder dan een minuut live.',
    cta_btn: 'Haal je handle', cta_note: 'Geen wachtwoord. Geen spam. Afmelden wanneer je wilt.',
    footer_copy: '© 2026 hollr · MIT-licentie',
    modal_title: 'Claim je handle',
    modal_sub: 'Verbind met X en je Twitter-handle wordt meteen je hollr-link. <strong>hollr.to/@jij</strong>.',
    modal_x_btn: 'Doorgaan met X',
    modal_note: 'We lezen alleen je openbare X-gebruikersnaam. Geen DMs, geen berichten plaatsen.',
    modal_success_title: 'Handle geclaimd.', modal_success_body: 'Je link is live. Deel het overal — bio, e-mailhandtekening, visitekaartje.',
    lang_modal_title: 'Kies je taal',
  },
  zh: {
    code: 'ZH', flag: '🇨🇳',
    nav_how: '工作原理', nav_features: '功能',
    nav_cta: '领取您的手柄',
    hero_pill: '免费且开源',
    hero_h1_1: '您的消息画布，', hero_h1_2: '您的手柄。',
    hero_sub: 'hollr 为每个人提供个人链接 — hollr.to/您的名字 — 世界各地的人可以直接写信、录音并发送到您的邮箱。',
    hero_cta: '领取手柄', hero_github: '在 GitHub 上查看',
    mock_label: '给 PAULFXYZ 的消息', mock_title: '说些值得说的话。',
    mock_desc: '这是一个计时消息画布。当您打字时，时钟就会运行。',
    mock_btn: '▶ 开始写作',
    stat1_val: '100%', stat1_label: '永远免费',
    stat2_val: '0',    stat2_label: '已存储消息',
    stat3_val: '10',   stat3_label: '语言',
    stat4_val: '∞',   stat4_label: '可用手柄',
    how_eyebrow: '工作原理', how_title: '60秒内就开始运行。',
    how_sub: '无需复杂设置。只需您的邮箱和一个手柄。',
    step1_title: '输入邮箱', step1_body: '魔法链接将发送到您的邮箱。无需密码。',
    step2_title: '选择手柄', step2_body: 'hollr.to/您的名字 — 先到先得。您的画布立即上线。',
    step3_title: '零配置，或使用您自己的密钥', step3_body: '默认情况下，hollrs 发送至 yo@hollr.to — 即时，无需配置。随时添加您自己的 Resend 密钥。',
    step4_title: '分享链接', step4_body: '放在您的个人介绍、签名或名片中。任何人都可以随时联系您。',
    senders_eyebrow: '您的发件人看到什么', senders_title: '一个为', senders_title_em: '深思熟虑的消息而设计的画布。',
    senders_sub: '当有人访问您的 hollr 链接时，他们获得写作体验 — 而不是联系表单。',
    sp1_title: '写作空间', sp1_body: '一张温暖的文学卡片，带有编号步骤。没有杂乱。',
    sp2_title: '计时器', sp2_body: '时钟只在您的发件人积极打字时运行。',
    sp3_title: '发送和接收', sp3_body: '消息被加密并通过您的 Resend API 密钥即时发送到您的邮箱。',
    canvas_eyebrow: '画布', canvas_title: '一个无干扰的\n消息体验。',
    canvas_body: '您的发件人将获得一个干净的全屏写作空间。计时器静静运行。',
    canvas_b1: '计时写作画布', canvas_b2: '浏览器内录音',
    canvas_b3: '拖放文件附件', canvas_b4: '消息立即达到您的邮箱',
    canvas_send: '发送消息',
    feat_eyebrow: '功能', feat_title: '您需要的一切，\n没有多余的。',
    f1_title: '您的 API 密钥，您的邮箱', f1_body: '消息通过您自己的 Resend 账户传递。hollr 从不拦截。',
    f2_title: '计时画布', f2_body: '始终运行的计时器。',
    f3_title: '语音笔记', f3_body: '直接在浏览器内录音。音频作为链接附上。',
    f4_title: 'AES-256 加密', f4_body: '您的 Resend 密钥使用 AES-256-CBC + PBKDF2 加密存储。',
    f5_title: '10 种语言', f5_body: 'EN、FR、DE、IT、ES、NL、ZH、HI、JA、RU。画布自动适应发件人的语言。',
    f6_title: '完全开源', f6_body: 'MIT 许可。随意 Fork、自托管或扩展。',
    priv_eyebrow: '隐私优先的设计', priv_title: '一切都加密。', priv_title_em: '没有任何存储。',
    priv_sub: '通过 hollr 的每一条消息、语音和文件都是端到端加密的。',
    p1_title: '端到端加密', p1_body: '消息、语音和文件均已加密。没有人能读取。',
    p2_title: '自带存储', p2_body: '连接您自己的 S3 桶 — Cloudflare R2、AWS S3、Backblaze B2。',
    p3_title: '零保留', p3_body: 'hollr 不保留消息副本。交付后即删除。',
    p4_title: '可自托管', p4_body: '在 Fly.io 或任何 Node.js 主机上运行您自己的实例。',
    test_eyebrow: '人们怎么说', test_title: '深受创作者\n和开发者喜爱。',
    t1_text: '"我用 hollr 替换了联系表单。计时画布让人们在写作前思考。"',
    t1_name: 'Maya Lin', t1_role: '产品设计师, SF',
    t2_text: '"使用我自己的 Resend 密钥意味着零依赖。消息像普通邮件一样到达。"',
    t2_name: 'Thomas Keller', t2_role: '独立开发者, 柏林',
    t3_text: '"我的学生用它来办公时间。加密确保他们的消息保持私密。"',
    t3_name: 'Aisha Rao', t3_role: '教授, 多伦多大学',
    quote: '"用爱 + AI 打造。\n100% vibe coding。"',
    os_eyebrow: '开源', os_title: '公开构建。',
    os_sub: 'hollr 采用 MIT 许可。每一行代码都在 GitHub 上。',
    cta_eyebrow: '您的手柄在等待您。', cta_title: '准备好被联系了吗？',
    cta_sub: '输入您的邮箱，我们将发送魔法链接。选择手柄。不到一分钟即可上线。',
    cta_btn: '获取手柄', cta_note: '无密码。无垃圾邮件。随时取消订阅。',
    footer_copy: '© 2026 hollr · MIT 许可',
    modal_title: '领取您的手柄',
    modal_sub: '用 X 登录，您的 Twitter 用户名立即成为您的 hollr 链接。<strong>hollr.to/@您</strong>。',
    modal_x_btn: '用 X 继续',
    modal_note: '我们只读取您的公开 X 用户名，不读取私信或发布内容。',
    modal_success_title: '手柄已领取。', modal_success_body: '您的链接已激活，随时分享。',
    lang_modal_title: '选择您的语言',
  },
  hi: {
    code: 'HI', flag: '🇮🇳',
    nav_how: 'यह कैसे काम करता है', nav_features: 'विशेषताएँ',
    nav_cta: 'अपना हैंडल लें',
    hero_pill: 'मुफ़्त और ओपन सोर्स',
    hero_h1_1: 'आपका संदेश कैन्वास,', hero_h1_2: 'आपका हैंडल।',
    hero_sub: 'hollr हर किसी को एक निजी लिंक देता है — hollr.to/आपकानाम — जहाँ लोग सीधे आपके इनबॉक्स में लिख सकते हैं।',
    hero_cta: 'अपना हैंडल लें', hero_github: 'GitHub पर देखें',
    mock_label: 'PAULFXYZ को संदेश', mock_title: 'कुछ कहें जो कहने लायक हो।',
    mock_desc: 'यह एक टाइमड संदेश कैन्वास है। घड़ी चलती रहती है।',
    mock_btn: '▶ लिखना शुरू करें',
    stat1_val: '100%', stat1_label: 'हमेशा मुफ़्त',
    stat2_val: '0',    stat2_label: 'संदेश संग्रहीत',
    stat3_val: '10',   stat3_label: 'भाषाएँ',
    stat4_val: '∞',   stat4_label: 'उपलब्ध हैंडल',
    how_eyebrow: 'यह कैसे काम करता है', how_title: '60 सेकंड में\nतैयार।',
    how_sub: 'कोई जटिल सेटअप नहीं। सिर्फ आपका ईमेल और एक हैंडल।',
    step1_title: 'अपना ईमेल दर्ज करें', step1_body: 'ऐडरेस पर मैजिक लिंक आएगा। कोई पासवर्ड नहीं।',
    step2_title: 'हैंडल चुनें', step2_body: 'hollr.to/आपकानाम — पहले आए, पहले पाएं।',
    step3_title: 'शून्य सेटअप। या अपनी कुंजी।', step3_body: 'डिफ़ॉल्ट रूप से hollrs yo@hollr.to पर आते हैं — तुरंत, बिना कॉन्फ़िग के।',
    step4_title: 'अपना लिंक शेयर करें', step4_body: 'बायो, सिग्नेचर या विजिटिंग कार्ड में डालें।',
    senders_eyebrow: 'आपके भेजनेवाले क्या देखते हैं', senders_title: 'एक कैन्वास', senders_title_em: 'सोच-समझकर संदेशों के लिए।',
    senders_sub: 'जब कोई आपका hollr लिंक खोलता है, उन्हें लेखन अनुभव मिलता है।',
    sp1_title: 'लेखन स्थान', sp1_body: 'क्रमांकित चरणों वाला गर्म कार्ड। कोई अव्यवस्था नहीं।',
    sp2_title: 'टाइमर', sp2_body: 'घड़ी तभी चलती है जब भेजनेवाला सक्रिय रूप से टाइप करता है।',
    sp3_title: 'भेजें और प्राप्त करें', sp3_body: 'संदेश एन्क्रिप्ट होकर आपके इनबॉक्स में Resend के माध्यम से तुरंत पहुँचता है।',
    canvas_eyebrow: 'कैन्वास', canvas_title: 'एक व्यवधान-मुक्त\nसंदेश अनुभव।',
    canvas_body: 'आपके प्रेषकों को एक साफ़ फुलस्क्रीन लेखन क्षेत्र मिलता है।',
    canvas_b1: 'टाइमड कैन्वास', canvas_b2: 'ब्राउज़र में वॉयस रिकॉर्डिंग',
    canvas_b3: 'ड्रैग-ड्रॉप अटैचमेंट', canvas_b4: 'संदेश तुरंत इनबॉक्स में',
    canvas_send: 'संदेश भेजें',
    feat_eyebrow: 'विशेषताएँ', feat_title: 'जो चाहिए वो सब,\nबाकी कुछ नहीं।',
    f1_title: 'आपकी API कुंजी, आपका इनबॉक्स', f1_body: 'संदेश आपके Resend खाते से डिलीवर होते हैं। hollr बीच में नहीं आता।',
    f2_title: 'टाइमड कैन्वास', f2_body: 'एक हमेशा चलने वाला टाइमर।',
    f3_title: 'वॉयस नोट्स', f3_body: 'सीधे ब्राउज़र में रिकॉर्ड करें। ऑडियो लिंक के रूप में डिलीवर होता है।',
    f4_title: 'AES-256 एन्क्रिप्टेड', f4_body: 'आपकी Resend कुंजी AES-256-CBC + PBKDF2 से सुरक्षित है।',
    f5_title: '10 भाषाएँ', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU। कैन्वास आपके भेजनेवाले की भाषा में होता है।',
    f6_title: 'पूरी तरह ओपन सोर्स', f6_body: 'MIT लाइसेंस। जितना चाहें फॉर्क और सेल्फ-होस्ट करें।',
    priv_eyebrow: 'डिज़ाइन द्वारा गोपनीयता', priv_title: 'सब कुछ एन्क्रिप्टेड।', priv_title_em: 'कुछ संग्रहीत नहीं।',
    priv_sub: 'hollr से गुजरने वाला हर संदेश, वॉयस नोट और फ़ाइल एंड-टु-एंड एन्क्रिप्टेड है।',
    p1_title: 'एंड-टु-एंड एन्क्रिप्शन', p1_body: 'संदेश, वॉयस रिकॉर्डिंग और फ़ाइलें एन्क्रिप्टेड हैं। कोई नहीं पढ़ सकता।',
    p2_title: 'अपना स्टोरेज लाएं', p2_body: 'Cloudflare R2, AWS S3, Backblaze B2 आपका S3 बकेट जोड़ें।',
    p3_title: 'शून्य धारण', p3_body: 'hollr संदेशों की कोई कॉपी नहीं रखता।',
    p4_title: 'सेल्फ-होस्ट योग्य', p4_body: 'Fly.io पर मिनटों में अपना इंस्टेंस चलाएं।',
    test_eyebrow: 'लोग क्या कहते हैं', test_title: 'रचनाकारों और\nनिर्माताओं द्वारा पसंद।',
    t1_text: '"मैंने अपना संपर्क फ़ॉर्म hollr से बदल दिया। टाइमड कैन्वास लोगों को सोचने पर मजबूर करता है।"',
    t1_name: 'Maya Lin', t1_role: 'प्रोडक्ट डिज़ाइनर, SF',
    t2_text: '"मेरी अपनी Resend कुंजी का मतलब है शून्य निर्भरता। संदेश सामान्य ईमेल की तरह आते हैं।"',
    t2_name: 'Thomas Keller', t2_role: 'इंडी डेवलपर, बर्लिन',
    t3_text: '"मेरे छात्र इसे ऑफिस आवर्स के लिए उपयोग करते हैं। एन्क्रिप्शन संदेशों को निजी रखता है।"',
    t3_name: 'Aisha Rao', t3_role: 'प्रोफ़ेसर, टोरंटो विश्वविद्यालय',
    quote: '"प्यार + AI से बनाया।\n100% vibe coding।"',
    os_eyebrow: 'ओपन सोर्स', os_title: 'खुले में निर्मित।',
    os_sub: 'hollr MIT लाइसेंस प्राप्त है। कोड की हर पंक्ति GitHub पर है।',
    cta_eyebrow: 'आपका हैंडल इंतज़ार कर रहा है।', cta_title: 'संपर्क के लिए तैयार?',
    cta_sub: 'अपना ईमेल दर्ज करें और हम मैजिक लिंक भेजेंगे। हैंडल चुनें। एक मिनट में लाइव।',
    cta_btn: 'हैंडल पाएं', cta_note: 'कोई पासवर्ड नहीं। कोई स्पैम नहीं।',
    footer_copy: '© 2026 hollr · MIT लाइसेंस',
    modal_title: 'अपना हैंडल लें',
    modal_sub: 'X से जुड़ें और आपका Twitter हैंडल तुरंत आपका hollr लिंक बन जाएगा। <strong>hollr.to/@आप</strong>।',
    modal_x_btn: 'X से जारी रखें',
    modal_note: 'हम केवल आपका सार्वजनिक X उपयोगकर्ता नाम पढ़ते हैं। कोई DM नहीं।',
    modal_success_title: 'हैंडल प्राप्त हो गया।', modal_success_body: 'आपका लिंक सक्रिय है। इसे हर जगह साझा करें।',
    lang_modal_title: 'अपनी भाषा चुनें',
  },
  ja: {
    code: 'JA', flag: '🇯🇵',
    nav_how: '仕組み', nav_features: '機能',
    nav_cta: 'ハンドルを取得',
    hero_pill: '無料 & オープンソース',
    hero_h1_1: 'あなたのメッセージキャンバス、', hero_h1_2: 'あなたのハンドル。',
    hero_sub: 'hollrは誰にでも個人リンクを提供します — hollr.to/あなたの名前 — ここで人々は書き、録音し、直接あなたのインボックスに送れます。',
    hero_cta: 'ハンドルを取得', hero_github: 'GitHubで見る',
    mock_label: 'PAULFXYZへのメッセージ', mock_title: '書く価値のあることを。',
    mock_desc: '時間測定式メッセージキャンバス。タイピング中はクロックが進みます。',
    mock_btn: '▶ 書き始める',
    stat1_val: '100%', stat1_label: '永遠無料',
    stat2_val: '0',    stat2_label: '保存メッセージ',
    stat3_val: '10',   stat3_label: '言語',
    stat4_val: '∞',   stat4_label: '利用可能ハンドル',
    how_eyebrow: '仕組み', how_title: '60秒で\n始められます。',
    how_sub: '複雑な設定は不要です。メールアドレスと共有したいハンドルだけ。',
    step1_title: 'メールを入力', step1_body: 'マジックリンクが届きます。パスワード不要。',
    step2_title: 'ハンドルを選択', step2_body: 'hollr.to/あなたの名前 — 先着先勝。',
    step3_title: 'ゼロセットアップ。または独自キー。', step3_body: 'デフォルトでhollrはyo@hollr.toに届きます。独自のResendキーはいつでも追加できます。',
    step4_title: 'リンクを共有', step4_body: 'プロフィール、メール署名、名刺に追加。どこからでも連絡可能。',
    senders_eyebrow: '送信者に見えるもの', senders_title: 'キャンバスは', senders_title_em: '思慮深いメッセージのために。',
    senders_sub: '誰かがあなたのhollrリンクを訪れると、コンタクトフォームではなく執筆体験を得ます。',
    sp1_title: '執筆スペース', sp1_body: '番号付きステップのある温かいカード。余計なものなし。',
    sp2_title: 'タイマー', sp2_body: '時計は送信者がアクティブにタイプしている時だけ動きます。',
    sp3_title: '送信と受信', sp3_body: 'メッセージは暗号化され、Resend経由であなたのインボックスに即座に届きます。',
    canvas_eyebrow: 'キャンバス', canvas_title: '邪魔のない\nメッセージ体験。',
    canvas_body: '送信者はクリーンなフルスクリーン記述エリアを得ます。静かなタイマーが動きます。',
    canvas_b1: '時間測定式キャンバス', canvas_b2: 'ブラウザ内音声録音',
    canvas_b3: 'ドラッグ&ドロップ添付', canvas_b4: 'メッセージは即座に届く',
    canvas_send: '送信',
    feat_eyebrow: '機能', feat_title: '必要なものすべて、\n不要なものはなし。',
    f1_title: 'あなたのAPIキー、あなたのインボックス', f1_body: 'Resendアカウント経由で配信。hollrは中間業者ではありません。',
    f2_title: '時間測定式キャンバス', f2_body: '常に動くタイマーが送信者の記述時間を示します。',
    f3_title: '音声メモ', f3_body: 'ブラウザ内で直接録音。音声はダウンロードリンクとして配信。',
    f4_title: 'AES-256暗号化', f4_body: 'AES-256-CBC + PBKDF2で暗号化。PIN保護。',
    f5_title: '10言語', f5_body: 'EN、FR、DE、IT、ES、NL、ZH、HI、JA、RU。自動で送信者の言語に対応。',
    f6_title: '完全オープンソース', f6_body: 'MITライセンス。フォーク、セルフホスト、拡張、自由自在。',
    priv_eyebrow: 'プライバシーバイデザイン', priv_title: 'すべて暗号化。', priv_title_em: '何も保存しない。',
    priv_sub: 'hollrを通じるすべてのメッセージ、音声メモ、ファイルはエンドツーエンド暗号化されています。',
    p1_title: 'エンドツーエンド暗号化', p1_body: '誰も—私たちでさえ—内容を読めません。',
    p2_title: 'ストレージを持ち込む', p2_body: 'Cloudflare R2、AWS S3、Backblaze B2など自分のS3バケットを接続。',
    p3_title: 'ゼロ保持', p3_body: 'hollrはメッセージのコピーを保存しません。配信後は削除されます。',
    p4_title: 'セルフホスト可能', p4_body: 'Fly.io上に数分で自分のインスタンスを起動。',
    test_eyebrow: '人々の声', test_title: 'クリエイターや\nビルダーに愛されています。',
    t1_text: '"コンタクトフォームをhollrに置き換えました。タイマー付きキャンバスで考えてから書く。"',
    t1_name: 'Maya Lin', t1_role: 'プロダクトデザイナー, SF',
    t2_text: '"自分のResendキーを使うことでベンダーロックインなし。メッセージは普通のメールとして届く。"',
    t2_name: 'Thomas Keller', t2_role: 'インディー開発者, ベルリン',
    t3_text: '"学生がオフィスアワーに使っています。暗号化でメッセージはプライベートに保たれます。"',
    t3_name: 'Aisha Rao', t3_role: '教授, トロント大学',
    quote: '"愛 + AIで作った。\n100% vibe coding。"',
    os_eyebrow: 'オープンソース', os_title: 'オープンに構築。',
    os_sub: 'hollrはMITライセンス。すべてのコードがGitHubにあります。',
    cta_eyebrow: 'あなたのハンドルが待っています。', cta_title: '連絡を受ける準備はできていますか?',
    cta_sub: 'メールを入力してください。マジックリンクを送ります。ハンドルを選んで、1分以内に公開。',
    cta_btn: 'ハンドルを取得', cta_note: 'パスワード不要。スパムなし。',
    footer_copy: '© 2026 hollr · MITライセンス',
    modal_title: 'ハンドルを取得',
    modal_sub: 'Xで接続すると、Twitterハンドルがすぐにhollrリンクになります。<strong>hollr.to/@あなた</strong>。',
    modal_x_btn: 'Xで続ける',
    modal_note: '公開Xユーザー名のみ読み取ります。DMや投稿は行いません。',
    modal_success_title: 'ハンドル取得完了。', modal_success_body: 'リンクが有効になりました。どこでもシェアしてください。',
    lang_modal_title: '言語を選択',
  },
  ru: {
    code: 'RU', flag: '🇷🇺',
    nav_how: 'Как это работает', nav_features: 'Функции',
    nav_cta: 'Забрать хэндл',
    hero_pill: 'Бесплатно & open source',
    hero_h1_1: 'Ваш холст для сообщений,', hero_h1_2: 'ваш хэндл.',
    hero_sub: 'hollr даёт каждому личную ссылку — hollr.to/вашеимя — где люди могут писать, записывать и отправлять прямо в ваш ящик.',
    hero_cta: 'Забрать хэндл', hero_github: 'Посмотреть на GitHub',
    mock_label: 'СООБЩЕНИЕ PAULFXYZ', mock_title: 'Скажите что-то стоящее.',
    mock_desc: 'Холст с таймером. Часы идут пока вы пишете.',
    mock_btn: '▶ Начать писать',
    stat1_val: '100%', stat1_label: 'Бесплатно навсегда',
    stat2_val: '0',    stat2_label: 'Сохранённых сообщений',
    stat3_val: '10',   stat3_label: 'Языков',
    stat4_val: '∞',   stat4_label: 'Доступных хэндлов',
    how_eyebrow: 'Как это работает', how_title: 'Готово к работе\nза 60 секунд.',
    how_sub: 'Никакой сложной настройки. Только е-мейл и хэндл.',
    step1_title: 'Введите е-мейл', step1_body: 'Магическая ссылка придёт на почту. Без пароля.',
    step2_title: 'Выберите хэндл', step2_body: 'hollr.to/вашеимя — кто первый, тот и забрал.',
    step3_title: 'Ноль настроек. Или свой ключ.', step3_body: 'По умолчанию hollrs приходят на yo@hollr.to — мгновенно. Добавьте свой Resend-ключ в любое время.',
    step4_title: 'Поделитесь ссылкой', step4_body: 'Добавьте в bio, подпись емейла или визитку.',
    senders_eyebrow: 'Что видят отправители', senders_title: 'Холст для', senders_title_em: 'вдумчивых сообщений.',
    senders_sub: 'Когда кто-то открывает вашу ссылку hollr, он получает пространство для письма — не форму контакта.',
    sp1_title: 'Пространство для письма', sp1_body: 'Тёплая карточка с нумерованными шагами. Без отвлечений.',
    sp2_title: 'Таймер', sp2_body: 'Часы идут только пока отправитель активно печатает.',
    sp3_title: 'Отправить и получить', sp3_body: 'Сообщение шифруется и мгновенно доставляется в ваш ящик через Resend.',
    canvas_eyebrow: 'Холст', canvas_title: 'Мессенджер без\nотвлечений.',
    canvas_body: 'Отправители получают чистое пространство для письма. Таймер тихо идёт.',
    canvas_b1: 'Холст с таймером', canvas_b2: 'Голосовые записки в браузере',
    canvas_b3: 'Вложения через drag & drop', canvas_b4: 'Сообщение сразу в ящике',
    canvas_send: 'Отправить',
    feat_eyebrow: 'Функции', feat_title: 'Всё необходимое,\nничего лишнего.',
    f1_title: 'Ваш API-ключ, ваш ящик', f1_body: 'Сообщения доставляются через ваш Resend. hollr не посредник.',
    f2_title: 'Таймерный холст', f2_body: 'Таймер показывает отправителю время написания.',
    f3_title: 'Голосовые записки', f3_body: 'Запись прямо в браузере. Аудио прикрепляется как ссылка.',
    f4_title: 'AES-256 шифрование', f4_body: 'Ключ Resend зашифрован AES-256-CBC + PBKDF2. PIN-защита.',
    f5_title: '10 языков', f5_body: 'EN, FR, DE, IT, ES, NL, ZH, HI, JA, RU. Холст автоматически адаптируется.',
    f6_title: 'Полностью open source', f6_body: 'MIT лицензия. Форкайте, хостите сами, расширяйте.',
    priv_eyebrow: 'Приватность по дизайну', priv_title: 'Всё зашифровано.', priv_title_em: 'Ничего не хранится.',
    priv_sub: 'Каждое сообщение, голосовая заметка и файл через hollr шифруется от конца до конца.',
    p1_title: 'Шифрование от конца до конца', p1_body: 'Никто — даже мы — не можем прочитать ваши сообщения.',
    p2_title: 'Своё хранилище', p2_body: 'Cloudflare R2, AWS S3, Backblaze B2 — подключите свой S3-бакет.',
    p3_title: 'Нулевое хранение', p3_body: 'hollr не хранит копий. После доставки данные удаляются.',
    p4_title: 'Самохостинг', p4_body: 'Запустите свой экземпляр на Fly.io за несколько минут.',
    test_eyebrow: 'Что говорят', test_title: 'Любим создателями\nи разработчиками.',
    t1_text: '"Заменил свою контактную форму на hollr. Таймер заставляет людей думать перед написанием."',
    t1_name: 'Maya Lin', t1_role: 'Продуктовый дизайнер, SF',
    t2_text: '"Свой ключ Resend означает ноль зависимости. Сообщения приходят как обычные письма."',
    t2_name: 'Thomas Keller', t2_role: 'Инди-разработчик, Берлин',
    t3_text: '"Студенты используют для приёмных часов. Шифрование хранит сообщения в тайне."',
    t3_name: 'Aisha Rao', t3_role: 'Профессор, Университет Торонто',
    quote: '"Сделано с любовью + ИИ.\n100% vibe coding."',
    os_eyebrow: 'Открытый код', os_title: 'Построен открыто.',
    os_sub: 'hollr лицензирован под MIT. Каждая строка кода на GitHub.',
    cta_eyebrow: 'Ваш хэндл ждёт.', cta_title: 'Готовы к общению?',
    cta_sub: 'Введите е-мейл и мы пошлём магическую ссылку. Выберите хэндл. Живи за минуту.',
    cta_btn: 'Получить хэндл', cta_note: 'Без пароля. Без спама.',
    footer_copy: '© 2026 hollr · Лицензия MIT',
    modal_title: 'Забрать хэндл',
    modal_sub: 'Войдите через X и ваш Twitter-хэндл мгновенно становится вашей ссылкой hollr. <strong>hollr.to/@вы</strong>.',
    modal_x_btn: 'Продолжить с X',
    modal_note: 'Мы читаем только ваш публичный никнейм X. Никаких личных сообщений.',
    modal_success_title: 'Хэндл получен.', modal_success_body: 'Ваша ссылка активна. Делитесь ею везде — био, подпись, визитка.',
    lang_modal_title: 'Выберите язык',
  },
};

/* ── I18N — APPLY TRANSLATIONS ───────────────────────────────── */
let currentLang = 'en';

function applyLang(code) {
  const t = LANGS[code];
  if (!t) return;
  currentLang = code;

  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => document.querySelectorAll(sel);

  // Nav links
  const navLinks = qa('.nav__links a');
  if (navLinks[0]) navLinks[0].textContent = t.nav_how;
  if (navLinks[1]) navLinks[1].textContent = t.nav_features;
  const navCtaBtn = q('.nav__actions [data-modal-open]');
  if (navCtaBtn) navCtaBtn.textContent = t.nav_cta;

  // Hero
  const pill = q('.hero__pill');
  if (pill) { const dot = pill.querySelector('.pill__dot'); pill.textContent = ' ' + t.hero_pill; if (dot) pill.prepend(dot); }
  const h1 = q('.hero__headline');
  if (h1) {
    if (t.hero_h1_3) {
      h1.innerHTML = `<span class="hero__h1-line hero__h1-line--1">${t.hero_h1_1}</span><span class="hero__h1-line hero__h1-line--2">${t.hero_h1_2}</span><em class="hero__h1-em">${t.hero_h1_3}</em>`;
    } else {
      h1.innerHTML = `<span class="hero__h1-line hero__h1-line--1">${t.hero_h1_1}</span><em class="hero__h1-em">${t.hero_h1_2}</em>`;
    }
  }
  const sub = q('.hero__sub');
  if (sub) sub.innerHTML = t.hero_sub.replace('hollr.to/yourname', '<code class="inline-code">hollr.to/yourname</code>');
  const heroCta = q('.hero__actions [data-modal-open]');
  if (heroCta) heroCta.innerHTML = `${t.hero_cta} <span class="btn-arrow" aria-hidden="true">\u2192</span>`;
  const githubBtn = q('.hero__actions .btn--ghost');
  if (githubBtn) { const svg = githubBtn.querySelector('svg'); githubBtn.textContent = ' ' + t.hero_github; if (svg) githubBtn.prepend(svg); }

  // Stats
  const sv = qa('.stat__val'), sl = qa('.stat__label');
  const svals = [t.stat1_val, t.stat2_val, t.stat3_val, t.stat4_val];
  const slabs = [t.stat1_label, t.stat2_label, t.stat3_label, t.stat4_label];
  sv.forEach((el, i) => { if (svals[i]) el.textContent = svals[i]; });
  sl.forEach((el, i) => { if (slabs[i]) el.textContent = slabs[i]; });

  // How it works
  const howEye = q('#how .eyebrow'); if (howEye) howEye.textContent = t.how_eyebrow;
  const howTitle = q('#how .section__title'); if (howTitle) howTitle.innerHTML = t.how_title.replace('\n', '<br>');
  const howSub = q('#how .section__sub'); if (howSub) howSub.textContent = t.how_sub;
  const steps = qa('.step-flow');
  const stepData = [
    { title: t.step1_title, body: t.step1_body },
    { title: t.step2_title, body: t.step2_body },
    { title: t.step3_title, body: t.step3_body },
    { title: t.step4_title, body: t.step4_body },
  ];
  steps.forEach((s, i) => {
    const tEl = s.querySelector('.step-flow__title'), bEl = s.querySelector('.step-flow__body');
    if (tEl && stepData[i]) tEl.textContent = stepData[i].title;
    if (bEl && stepData[i]) bEl.innerHTML = stepData[i].body.replace('hollr.to/yourname', '<code class="inline-code">hollr.to/yourname</code>');
  });

  // Senders section
  const sendEye = q('#senders .eyebrow'); if (sendEye) sendEye.textContent = t.senders_eyebrow;
  const sendTitle = q('#senders .section__title');
  if (sendTitle && t.senders_title) sendTitle.innerHTML = `${t.senders_title}<br><em>${t.senders_title_em}</em>`;
  const sendSub = q('#senders .section__sub'); if (sendSub) sendSub.textContent = t.senders_sub;
  const sPanels = qa('.sender-panel');
  const sPanelData = [
    { title: t.sp1_title, body: t.sp1_body },
    { title: t.sp2_title, body: t.sp2_body },
    { title: t.sp3_title, body: t.sp3_body },
  ];
  sPanels.forEach((p, i) => {
    const tEl = p.querySelector('.sender-panel__title'), bEl = p.querySelector('.sender-panel__body');
    if (tEl && sPanelData[i]) tEl.textContent = sPanelData[i].title;
    if (bEl && sPanelData[i]) bEl.textContent = sPanelData[i].body;
  });

  // Features
  const featEye = q('#features .eyebrow'); if (featEye) featEye.textContent = t.feat_eyebrow;
  const featTitle = q('#features .section__title'); if (featTitle) featTitle.innerHTML = t.feat_title.replace('\n', '<br>');
  const fCards = qa('.feature-card');
  const fData = [
    { title: t.f1_title, body: t.f1_body }, { title: t.f2_title, body: t.f2_body },
    { title: t.f3_title, body: t.f3_body }, { title: t.f4_title, body: t.f4_body },
    { title: t.f5_title, body: t.f5_body }, { title: t.f6_title, body: t.f6_body },
  ];
  fCards.forEach((c, i) => {
    const tEl = c.querySelector('.feature-card__title'), bEl = c.querySelector('.feature-card__body');
    if (tEl && fData[i]) tEl.textContent = fData[i].title;
    if (bEl && fData[i]) bEl.textContent = fData[i].body;
  });

  // Privacy
  const privEye = q('#privacy .eyebrow'); if (privEye) privEye.textContent = t.priv_eyebrow;
  const privTitle = q('#privacy .section__title'); if (privTitle) privTitle.innerHTML = `${t.priv_title}<br><em>${t.priv_title_em}</em>`;
  const privSub = q('#privacy .section__sub'); if (privSub) privSub.textContent = t.priv_sub;
  const pCards = qa('.privacy-card');
  const pData = [
    { title: t.p1_title, body: t.p1_body }, { title: t.p2_title, body: t.p2_body },
    { title: t.p3_title, body: t.p3_body }, { title: t.p4_title, body: t.p4_body },
  ];
  pCards.forEach((c, i) => {
    const tEl = c.querySelector('.privacy-card__title'), bEl = c.querySelector('.privacy-card__body');
    if (tEl && pData[i]) tEl.textContent = pData[i].title;
    if (bEl && pData[i]) bEl.textContent = pData[i].body;
  });

  // Testimonials
  const testEye = q('#testimonials .eyebrow'); if (testEye) testEye.textContent = t.test_eyebrow;
  const testTitle = q('#testimonials .section__title'); if (testTitle) testTitle.innerHTML = t.test_title.replace('\n', '<br>');
  const tCards = qa('.testimonial-card');
  const tData = [
    { text: t.t1_text, name: t.t1_name, role: t.t1_role },
    { text: t.t2_text, name: t.t2_name, role: t.t2_role },
    { text: t.t3_text, name: t.t3_name, role: t.t3_role },
  ];
  tCards.forEach((c, i) => {
    const txt = c.querySelector('.testimonial-card__text');
    const nm = c.querySelector('.testimonial-card__name');
    const rl = c.querySelector('.testimonial-card__role');
    if (txt && tData[i]) txt.textContent = tData[i].text;
    if (nm && tData[i]) nm.textContent = tData[i].name;
    if (rl && tData[i]) rl.textContent = tData[i].role;
  });

  // Quote
  const quoteEl = q('.pull-quote p'); if (quoteEl) quoteEl.innerHTML = t.quote.replace('\n', '<br>');

  // Open source
  const osEye = q('#opensource .eyebrow'); if (osEye) osEye.textContent = t.os_eyebrow;
  const osTitle = q('#opensource .section__title'); if (osTitle) osTitle.textContent = t.os_title;
  const osSub = q('#opensource .section__sub'); if (osSub) osSub.textContent = t.os_sub;

  // CTA
  const ctaEye = q('.cta-section .eyebrow'); if (ctaEye) ctaEye.textContent = t.cta_eyebrow;
  const ctaTitle = q('.cta-title'); if (ctaTitle) ctaTitle.textContent = t.cta_title;
  const ctaSub = q('.cta-sub'); if (ctaSub) ctaSub.textContent = t.cta_sub;
  const ctaBtn = q('.cta-section [data-modal-open]'); if (ctaBtn) ctaBtn.innerHTML = `${t.cta_btn} <span class="btn-arrow" aria-hidden="true">\u2192</span>`;
  const ctaNote = q('.claim-form__note'); if (ctaNote) ctaNote.textContent = t.cta_note;

  // Footer
  const footCopy = q('.footer__copy'); if (footCopy) footCopy.textContent = t.footer_copy;

  // Modal — X auth flow
  const mTitle = q('#modal-title'); if (mTitle) mTitle.textContent = t.modal_title;
  const mSub = q('.modal__sub'); if (mSub) mSub.innerHTML = t.modal_sub;
  const mNote = q('.modal__note'); if (mNote) mNote.textContent = t.modal_note;
  const mXBtn = q('#btn-x-auth'); if (mXBtn && !mXBtn.disabled) { const svg = mXBtn.querySelector('svg'); mXBtn.textContent = ' ' + t.modal_x_btn; if (svg) mXBtn.prepend(svg); }

  // Lang button
  const flagEl = document.getElementById('lang-flag'); if (flagEl) flagEl.textContent = t.flag;
  const codeEl = document.getElementById('lang-code'); if (codeEl) codeEl.textContent = t.code;

  // Lang modal title
  const lmt = q('.lang-modal__title'); if (lmt) lmt.textContent = t.lang_modal_title;

  // Mark active lang option
  qa('.lang-option').forEach(opt => {
    opt.classList.toggle('is-active', opt.dataset.lang === code);
  });

  // Update html lang attr
  document.documentElement.lang = code;
}

/* ── I18N — LANGUAGE MODAL ───────────────────────────────────── */
(function () {
  const btn      = document.getElementById('lang-btn');
  const backdrop = document.getElementById('lang-backdrop');
  const modal    = document.getElementById('lang-modal');
  const closeBtn = document.getElementById('lang-close');

  if (!btn || !backdrop) return;

  function openLang() {
    backdrop.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('is-open')));
    document.body.style.overflow = 'hidden';
  }
  function closeLang() {
    backdrop.classList.remove('is-open');
    backdrop.addEventListener('transitionend', function h() {
      backdrop.hidden = true; backdrop.removeEventListener('transitionend', h);
    });
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', openLang);
  closeBtn && closeBtn.addEventListener('click', closeLang);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeLang(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !backdrop.hidden) closeLang();
  });

  // Language options
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      applyLang(opt.dataset.lang);
      closeLang();
    });
  });

  // Auto-detect browser language on load
  const browserLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (LANGS[browserLang] && browserLang !== 'en') applyLang(browserLang);
  else applyLang('en');
})();

/* ── THEME TOGGLE ─────────────────────────────────────────────── */
(function () {
  const root = document.documentElement;
  const btn  = document.querySelector('[data-theme-toggle]');
  const moon = btn && btn.querySelector('.icon-moon');
  const sun  = btn && btn.querySelector('.icon-sun');

  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);
  sync(theme);

  btn && btn.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
    sync(theme);
  });

  function sync(t) {
    if (!moon || !sun) return;
    moon.style.display = t === 'dark' ? 'none' : 'block';
    sun.style.display  = t === 'dark' ? 'block' : 'none';
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
})();

/* ── STICKY NAV SHADOW ────────────────────────────────────────── */
(function () {
  const nav = document.getElementById('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('nav--scrolled', window.scrollY > 20);
  }, { passive: true });
})();

/* ── X/TWITTER AUTH MODAL ─────────────────────────────────────── */
(function () {
  const backdrop  = document.getElementById('modal-backdrop');
  const closeBtn  = document.getElementById('modal-close');
  const connectEl = document.getElementById('modal-connect');
  const successEl = document.getElementById('modal-success');
  const xAuthBtn  = document.getElementById('btn-x-auth');
  const successHandle = document.getElementById('modal-success-handle');

  if (!backdrop) return;

  /* ── Open / close ── */
  function openModal() {
    // Always reset to connect state
    if (connectEl) connectEl.style.display = '';
    if (successEl) successEl.hidden = true;
    // Reset email form
    const ef = document.getElementById('modal-email-form');
    const et = document.getElementById('modal-email-trigger');
    if (ef) { ef.hidden = true; ef.reset && ef.reset(); }
    if (et) et.classList.remove('is-open');

    backdrop.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('is-open')));
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('is-open');
    backdrop.addEventListener('transitionend', function handler() {
      backdrop.hidden = true;
      backdrop.removeEventListener('transitionend', handler);
    });
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-modal-open]').forEach(el => {
    el.addEventListener('click', openModal);
  });
  closeBtn  && closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !backdrop.hidden) closeModal();
  });

  /* ── Email toggle ── */
  const emailTrigger = document.getElementById('modal-email-trigger');
  const emailForm    = document.getElementById('modal-email-form');
  const emailChevron = document.getElementById('email-trigger-chevron');

  emailTrigger && emailTrigger.addEventListener('click', () => {
    const isOpen = !emailForm.hidden;
    emailForm.hidden = isOpen;
    emailTrigger.classList.toggle('is-open', !isOpen);
    if (!isOpen) {
      emailForm.querySelector('input[name="handle"]')?.focus();
    }
  });

  emailForm && emailForm.addEventListener('submit', async e => {
    e.preventDefault();
    const handle    = (emailForm.querySelector('[name="handle"]')?.value || '').trim();
    const email     = (emailForm.querySelector('[name="email"]')?.value  || '').trim();
    const submitBtn = emailForm.querySelector('button[type="submit"]');
    if (!handle || !email) return;

    // Validate handle format
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(handle)) {
      const errEl = emailForm.querySelector('.email-form__error') || (() => {
        const d = document.createElement('p');
        d.className = 'email-form__error';
        d.style.cssText = 'color:#c0392b;font-size:0.8rem;margin-top:4px';
        emailForm.appendChild(d); return d;
      })();
      errEl.textContent = 'Handle must be 2–30 characters (letters, numbers, _ or -).';
      return;
    }

    // Store handle in sessionStorage so auth/verify can pre-fill it
    try { sessionStorage.setItem('hollr_pending_handle', handle); } catch {}

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

    try {
      const res  = await fetch('https://api.hollr.to/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Show success — magic link sent; direct them to check email
        if (connectEl) connectEl.style.display = 'none';
        if (successEl) {
          successEl.hidden = false;
          const successTitle = document.getElementById('modal-success-title');
          const successBody  = document.getElementById('modal-success-body');
          if (successTitle) successTitle.textContent = 'Check your inbox!';
          if (successBody)  successBody.textContent  = `We sent a magic link to ${email}. Click it to claim hollr.to/${handle}.`;
          if (successHandle) successHandle.textContent = 'hollr.to/' + handle;
        }
      } else {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Claim handle →'; }
        const errEl = emailForm.querySelector('.email-form__error') || (() => {
          const d = document.createElement('p');
          d.className = 'email-form__error';
          d.style.cssText = 'color:#c0392b;font-size:0.8rem;margin-top:4px';
          emailForm.appendChild(d); return d;
        })();
        errEl.textContent = data.error || 'Something went wrong. Please try again.';
      }
    } catch {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Claim handle →'; }
    }
  });

  /* ── Reset email form on modal close ── */
  const origClose = closeModal;

  /* ── X OAuth button ──
   * In production: redirect to Twitter OAuth 2.0 PKCE endpoint.
   * Here: simulate the callback with a demo handle so the flow is
   * fully visible on the landing page.
   * Replace this block with a real server-side OAuth callback.
   */
  xAuthBtn && xAuthBtn.addEventListener('click', () => {
    // Visual loading state — then redirect to X OAuth PKCE
    xAuthBtn.disabled = true;
    xAuthBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"
           style="animation:spin 0.7s linear infinite">
        <path d="M12 2a10 10 0 0 1 10 10"/>
      </svg>
      Connecting to X…
    `;
    setTimeout(() => {
      window.location.href = 'https://api.hollr.to/api/auth/x';
    }, 400);
  });

  function showSuccess(xHandle) {
    if (connectEl) connectEl.style.display = 'none';
    if (successEl) {
      successEl.hidden = false;
      if (successHandle) successHandle.textContent = 'hollr.to/' + xHandle;
    }
    // Reset auth button for next open
    if (xAuthBtn) {
      xAuthBtn.disabled = false;
      xAuthBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        Continue with X
      `;
    }
  }

  // ── Check for OAuth callback params in URL ──
  // When the real OAuth flow redirects back, it adds ?x_handle=username
  // e.g., /callback?x_handle=paulfxyz
  const urlParams = new URLSearchParams(window.location.search);
  const callbackHandle = urlParams.get('x_handle');
  if (callbackHandle) {
    // Auto-open modal in success state
    setTimeout(() => {
      openModal();
      showSuccess(callbackHandle);
    }, 300);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

/* ── SPIN ANIMATION (for X auth loading state) ─────────────────── */
(function () {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();

/* ── INTERSECTION REVEAL ──────────────────────────────────────── */
(function () {
  const els = document.querySelectorAll('.js-reveal');
  if (!els.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const sibs = Array.from(
        entry.target.parentElement.querySelectorAll('.js-reveal:not(.visible)')
      );
      const idx = sibs.indexOf(entry.target);
      setTimeout(() => {
        entry.target.classList.add('visible');
      }, Math.max(0, idx * 80));
      io.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  els.forEach(el => io.observe(el));
})();

/* ── SMOOTH SCROLL ────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

/* ── COUNT-UP ANIMATION FOR STATS ────────────────────────────── */
(function () {
  const strip = document.getElementById('stats-strip');
  if (!strip) return;

  let animated = false;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || animated) return;
      animated = true;
      io.unobserve(entry.target);

      strip.querySelectorAll('[data-count-to]').forEach(el => {
        const target = parseInt(el.dataset.countTo, 10);
        const suffix = el.dataset.suffix || '';
        if (target === 0) {
          el.textContent = '0' + suffix;
          return;
        }
        const duration = 1200;
        const start = performance.now();

        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
          const current = Math.round(eased * target);
          el.textContent = current + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });

      // Infinity symbol just pops in
      strip.querySelectorAll('[data-count-special="inf"]').forEach(el => {
        el.style.transform = 'scale(0)';
        el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s';
        requestAnimationFrame(() => { el.style.transform = 'scale(1)'; });
      });
    });
  }, { threshold: 0.3 });

  io.observe(strip);
})();


/* ── HERO ILLUSTRATION — Typewriter + live timer ─────────────── */
(function () {
  const typedEl   = document.getElementById('mock-typed-text');
  const timerEl   = document.getElementById('mock-timer-display');
  const msEl      = document.getElementById('mock-timer-ms');
  const wordEl    = document.querySelector('.canvas-mock__wordcount');
  if (!typedEl || !timerEl) return;

  /* The message someone is typing to Elon — realistic, thoughtful */
  const MESSAGE =
    "Yo Elon — hollering at you through hollr because the irony is too good. " +
    "A PGP-encrypted message canvas named after the thing you do when you " +
    "need to reach someone across the block. No DMs, no blue checkmarks, " +
    "no algorithm deciding if you see this. Just a link, a canvas, and " +
    "your words — encrypted before they left my browser. " +
    "That's the internet we were supposed to build.";

  /* Timer starts at 1m47s and counts up */
  let secs = 107;
  let ms   = 28;

  /* Typewriter state */
  let charIndex = 0;
  let direction = 1;   // 1 = typing forward, -1 = erasing
  let pauseTicks = 0;  // countdown pause at end/start
  const FORWARD_DELAY  = 38;  // ms between chars when typing
  const BACKWARD_DELAY = 18;  // ms between chars when erasing
  const PAUSE_AT_END   = 80;  // ticks to hold at full message

  function countWords(str) {
    const trimmed = str.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  /* Typewriter tick */
  function typeTick() {
    if (pauseTicks > 0) {
      pauseTicks--;
      setTimeout(typeTick, FORWARD_DELAY);
      return;
    }

    if (direction === 1) {
      // Typing forward
      charIndex++;
      const shown = MESSAGE.slice(0, charIndex);
      typedEl.textContent = shown;
      if (wordEl) wordEl.textContent = countWords(shown) + ' words';

      if (charIndex >= MESSAGE.length) {
        // Reached end — pause then start erasing
        pauseTicks = PAUSE_AT_END;
        direction = -1;
        setTimeout(typeTick, FORWARD_DELAY);
      } else {
        // Vary speed slightly for realism
        const delay = FORWARD_DELAY + (Math.random() > 0.85 ? 80 : 0);
        setTimeout(typeTick, delay);
      }
    } else {
      // Erasing backward
      charIndex = Math.max(0, charIndex - 3); // erase 3 chars at a time
      const shown = MESSAGE.slice(0, charIndex);
      typedEl.textContent = shown;
      if (wordEl) wordEl.textContent = countWords(shown) + ' words';

      if (charIndex <= 0) {
        // Erased everything — short pause then type again
        pauseTicks = 20;
        direction = 1;
        setTimeout(typeTick, FORWARD_DELAY);
      } else {
        setTimeout(typeTick, BACKWARD_DELAY);
      }
    }
  }

  /* Start typewriter after a brief delay */
  setTimeout(typeTick, 900);

  /* Timer ticks every 100ms — updates seconds and milliseconds */
  setInterval(() => {
    ms += 7 + Math.floor(Math.random() * 5);
    if (ms >= 100) { ms -= 100; secs++; }
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    if (timerEl) timerEl.textContent = `${m}:${s}`;
    if (msEl)    msEl.textContent    = '.' + String(ms).padStart(2, '0');
  }, 100);
})();
