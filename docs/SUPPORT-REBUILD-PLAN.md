# Conceal Support — current-state map and replacement proposal

Date: 2026-09-06 (revised after brand/theme review)
Scope: replace the HESK help desk at https://conceal.network/support with an in-house Conceal support platform at **support.conceal.network**.

Decisions already made:
* Host at `support.conceal.network` (admins to create the subdomain; `conceal.network/support/*` gets a 301 to the new home once live).
* Attachments on **self-hosted MinIO**.
* Team channel is **Discord**; Signal as an optional second notification path.
* Not a like-for-like HESK clone — keep the concept (tickets, tracking IDs, staff queue) and improve on it.
* **Clean break — no data migration from HESK.** The old install is simply switched off at launch. Integrations are built and configured via environment variables now; credentials are supplied and tested later.

---

## Part 1 — What exists today (HESK at conceal.network/support)

Observed from the public site on 2026-09-06. Admin-side details are inferred from HESK's stock behaviour.

### 1.1 Hosting and runtime

| Item | Observed value |
| --- | --- |
| Software | HESK (free edition, "in partnership with SysAid" footer — HESK 3.x line) |
| Runtime | PHP 8.2.33, LiteSpeed web server (shared / cPanel-style hosting) |
| Database | MySQL/MariaDB with `hesk_*` tables |
| Theme | Custom theme folder `theme/conceal/` — cosmetic changes over the stock theme |
| Session | `HESKC…` PHP session cookie, `SameSite=Lax`, `HttpOnly`, `X-Frame-Options: SAMEORIGIN` |
| Admin | `/support/admin/` (HESK staff login; username + password) |
| Public assets | jQuery, `hesk_functions.js`, `theme/conceal/customer/css/app.min.css` |

### 1.2 Public surface

```
/support/                          Landing: "Hello, how can we help?"
├── index.php?a=add                Category picker: "What can we help you with?"
│   ├── &category=1  General
│   ├── &category=2  Wallets
│   ├── &category=3  Bridge
│   └── &category=4  Chain / Security
│       └── submit_ticket.php      POST → creates ticket, emails tracking ID
├── ticket.php                     View ticket by tracking ID + email
│   └── "Forgot tracking ID?"      Emails open or all tracking IDs for an address
├── knowledgebase.php              Exists but EMPTY ("No articles yet in this category")
└── admin/                         Staff panel
```

### 1.3 Submit-ticket form

| Field | Type | Constraint | Notes |
| --- | --- | --- | --- |
| Name | text | required, max 50 | |
| Email | email | required | HESK email-typo suggestion on blur |
| Priority | select | Low / Medium (default) / High | |
| Subject | text | required, max 70 | |
| Message | textarea | required | plain text |
| Attachments | file × 2 | HESK default 2 MB each | |
| SPAM question | text | "What is conceal ticker ?" (answer: CCX) | static question, not reCAPTCHA |
| category, hx/hy/phone, token | hidden | | honeypot + CSRF |

No custom fields — wallet type, version, OS, tx hash, chain all end up as free text.

### 1.4 View-ticket flow

Tracking ID (`XXX-XXX-XXXX`) + email. Customer can reply, attach, close, rate. All notifications are outbound email only.

### 1.5 Staff-side (stock HESK, assumed enabled)

Ticket list with filters/search/bulk actions; statuses New / Waiting reply / Replied / Resolved / In progress / On hold; assignment, private notes, canned replies, merge, time-worked, due dates; per-category staff visibility; email piping (unknown if configured); reports; audit trail; email/IP bans; Administrator / Staff roles.

### 1.6 Why replace it

1. **No product context on tickets** — every ticket starts with a round-trip asking for wallet/version/OS/hash.
2. **No deflection** — empty KB; real docs live in the Fumadocs wiki.
3. **Seed-phrase risk** — nothing stops a user pasting a 25-word mnemonic; it then sits in shared-hosting MySQL and staff mailboxes. Impersonation scams are the #1 community risk and the product gives no in-flow warning.
4. **Trivial anti-spam** — static question + honeypot.
5. **Off-brand** — stock HESK UI, "Powered by HESK / SysAid" footer, nothing in common with conceal.network or the new wallet.
6. **Email-only** — the team works in Discord; there's no bridge between Discord and the queue.
7. **Ops** — PHP/MySQL on shared hosting, separate from the project's own infra, stock admin login at a guessable URL.

---

## Part 2 — Brand and design system (from /branding and wallet.conceal.network)

### 2.1 Official assets — https://conceal.network/branding

| Asset | Path |
| --- | --- |
| Logo (vector) | `/images/branding/logo.svg` — grey brushed-metal gradient mark (`#54565a → #a7a8a9`, `#e9eae8` highlight) |
| Logo dark bg 1600 / 256 | `/images/branding/community-bbg-center-s-1600x1600.png`, `…-256x256.png` |
| Logo white bg 1600 / 256 | `/images/branding/community-1600x1600.png`, `…-256x256.png` |
| Simplified mark (used by wallet + wiki) | `wallet.conceal.network/brand/conceal-mark.svg` (same file as `conceal-wiki/public/brand/conceal-mark.svg`) |
| Fonts listed on the branding page | Poppins, Lora, Montserrat |
| Colours listed on the branding page | Grey `#808080`, Neon Cyan `#00F0FF`, Black `#000000` |

Copies of these are saved in `docs/reference/` alongside screenshots of the wallet theme (`wallet-theme-hero.png`, `wallet-theme-full.png`).

### 2.2 The new theme — wallet.conceal.network

The web wallet is the design direction to follow. It is a clear departure from the neon-on-black main site: **warm, quiet, premium**. Key traits observed:

* **Palette is amber on warm neutrals.** Primary/accent is pure orange `hsl(39 100% 50%)` = `#FFA500`; on the light theme, accent text darkens to `#BE6A04` / `#E67E00` for contrast. Backgrounds are warm greys, not pure black or white (dark `hsl(30 9% 9%)` ≈ `#1A1715`, light `hsl(36 38% 97%)` ≈ `#FAF8F4`). Neon cyan is **not** used.
* **Typography is Geist + Geist Mono.** Headlines are large, light-weight Geist with one word in amber and one in bold ("Quietly *private.* Patiently **yours.**"). Eyebrow labels are small, letter-spaced, uppercase, amber, monospace ("CONCEAL WEB WALLET"). Numbers, amounts, hashes and metadata are Geist Mono.
* **Glass cards** (`.wallet-card`): 70 % card colour with `backdrop-blur`, 1 px 70 % border, `rounded-xl` (`--radius: .75rem`), inset 1 px white highlight + deep soft shadow (`0 18px 60px rgba(0,0,0,.32)`); on light theme the shadow is a subtle warm `#221d18` at 4–6 %.
* **Signature hero motif**: the brushed-metal 3-D coin/mark with a thin **amber glow ring**, placed off-centre and bleeding past the edge, on a soft radial vignette. Radial amber gradients at the corners (`radial-gradient(58% 44% at 90% -8%, #ffa60012, transparent)`).
* **Buttons**: pill-shaped, solid amber with black text, hover raises with an amber glow shadow (`0 16px 40px #ffa5004d`). Secondary actions are plain text with an arrow ("Create a new one →").
* **Status vocabulary**: small pill badges with a dot ("● Synced" in green), semantic colours `incoming #10B981`, `outgoing #EF4444`, `deposit #60A5FA`, `amber #F5A623`.
* **"Keycap"** treatment (`.wallet-keycap`): amber text on a bevelled dark tile — used for keyboard hints / shortcuts.
* Header: mark + "Conceal" wordmark on the left; Discord, GitHub and one pill CTA on the right. Footer strip: four amber-dot feature bullets.
* Light and dark themes via `data-theme`; dark is the default (`color-scheme: dark`).

### 2.3 Support design tokens (derived)

```css
:root {                       /* dark (default) */
  --background: 30 9% 9%;     --foreground: 0 0% 100%;
  --card: 36 9% 13%;          --popover: 36 10% 12%;
  --secondary: 34 8% 17%;     --muted: 34 8% 17%;   --muted-foreground: 36 7% 64%;
  --border: 34 9% 21%;        --input: 34 9% 21%;
  --primary: 39 100% 50%;     --primary-foreground: 0 0% 0%;   /* amber on black */
  --ring: 39 100% 50%;        --destructive: 0 84% 60%;
  --chrome: 30 10% 7%;        --radius: .75rem;
  /* support-specific semantic colours */
  --status-new: 199 89% 48%;  --status-waiting: 39 100% 50%;  --status-resolved: 160 84% 39%;
  --status-hold: 36 7% 64%;   --severity-critical: 0 84% 60%;
}
[data-theme=light] {
  --background: 36 38% 97%;   --foreground: 30 12% 12%;
  --card: 0 0% 100%;          --secondary: 36 24% 92%;  --muted-foreground: 32 9% 38%;
  --border: 34 18% 85%;       --primary-text: #be6a04;  /* darkened amber for text on light */
}
```

Fonts: **Geist** (UI, headings), **Geist Mono** (tracking IDs, hashes, addresses, timestamps, eyebrow labels). Both are self-hosted `.woff` in the wallet; do the same (no Google Fonts requests — fits the privacy ethos). Poppins/Lora/Montserrat remain the "print" brand fonts and are not needed in the app.

### 2.4 How this translates to a support product

* **Home hero** copies the wallet's structure: eyebrow "CONCEAL SUPPORT", headline "Stuck? *Quietly.* Solved, **patiently.**" (or similar — copy TBD), one-paragraph subhead, amber pill "Open a ticket" + text link "Check an existing ticket →", the metal mark with amber ring bleeding off the right edge, and a glass card on top of it showing a *live network status* widget (chain height, last block age, bridge status, "Support online / avg first reply 6 h") — the support equivalent of the wallet's balance card.
* **Category cards** = glass cards with a mono eyebrow (`WALLETS`, `BRIDGE`, `CHAIN / SECURITY`, `GENERAL`), one-line description, and 3 pinned doc links.
* **Ticket view** = a single glass card timeline; customer messages left-aligned, staff messages with the amber mark avatar; structured fields rendered as mono chips in a header strip; status as a dot pill ("● Waiting for you", "● Resolved").
* **Tracking IDs** are mono, keycap-styled, one-click copy: `CCX-7K3M-Q9RT`.
* **Security notice** uses the amber accent (it is the brand colour *and* the warning colour here): a thin amber-bordered card, never a red alert box, with the copy "Conceal staff will never ask for your seed phrase, private keys, or wallet password."
* Footer strip: amber-dot bullets "No account needed · Reply by email · Staff never ask for keys · Open source".
* Staff console uses the same tokens but denser: `--chrome` sidebar, mono everywhere data is shown, keycap hints for shortcuts (`J`/`K` navigate, `R` reply, `A` assign).

---

## Part 3 — Target architecture

### 3.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4** | Same stack as the wallet and the wiki; tokens and components port directly. |
| UI kit | shadcn/ui primitives restyled with the tokens in §2.3 (the wallet's CSS variables are the shadcn convention already) | |
| DB | **PostgreSQL 16 + Drizzle ORM** | Plain-SQL migrations, easy to review. |
| Files | **MinIO** (self-hosted, same Compose stack) | Presigned upload/download URLs; bucket versioning off; lifecycle rule purges attachments of closed tickets after 180 d. |
| Email out | SMTP via existing `support@conceal.network`, React Email templates | Keeps SPF/DKIM. |
| Email in | IMAP poller (every 60 s) on the same mailbox → `/api/inbound` | No Cloudflare dependency; can switch to Email Routing later. |
| Staff auth | **Discord OAuth2** (must be a member of the Conceal server with a `support-staff` role) **+ passkey or TOTP second factor** | Team already lives in Discord; role membership doubles as the staff roster. TOTP works with the project's own Conceal Authenticator app. |
| Customer auth | No account: tracking ID + email, or signed magic link from the confirmation email | |
| Anti-abuse | Cloudflare Turnstile (or hCaptcha if avoiding CF) + per-IP/per-email rate limits + honeypot + disposable-email list | |
| Search | Postgres `tsvector` on tickets; wiki search via its published index for deflection | |
| Notifications | **Discord bot** (primary), **Signal** via `signal-cli` REST (optional), email | |
| Hosting | Docker Compose (app, postgres, minio, caddy, signal-cli) on a project VPS; Caddy terminates TLS for `support.conceal.network` | |
| Observability | Structured JSON logs, `/healthz`, optional Sentry | |

### 3.2 System diagram

```
  User (web) ──────────────▶┌─────────────────────────────┐
  User (email reply) ─IMAP─▶│  Next.js app                │──▶ Postgres
  Staff (Discord OAuth+2FA)▶│  support.conceal.network    │──▶ MinIO (attachments)
  Discord (bot commands) ──▶│                             │──▶ SMTP out
                            │                             │──▶ Discord bot (threads, embeds, slash cmds)
                            │                             │──▶ signal-cli REST (optional)
                            │                             │──▶ explorer.conceal.network (tx / height)
                            │                             │──▶ GitHub Releases (version lists)
                            │                             │──▶ wiki search index (deflection)
                            └─────────────────────────────┘
```

### 3.3 Data model

```
tickets
  id uuid pk, tracking_id text unique ("CCX-7K3M-Q9RT")
  category_id fk, status enum(new, open, waiting_customer, waiting_staff, on_hold, resolved, closed)
  priority enum(low, medium, high, critical), subject text(≤120)
  requester_name text, requester_email citext
  assignee_id fk staff null, fields jsonb (structured, schema per category)
  source enum(web, email, discord), discord_thread_id text null
  created_at, updated_at, last_customer_reply_at, last_staff_reply_at, resolved_at

messages        id, ticket_id, author_type enum(customer, staff, system), author_id null,
                body_md, body_html (sanitised), via enum(web, email, discord), created_at, rating smallint null
notes           id, ticket_id, staff_id, body_md, created_at           -- staff-only
attachments     id, ticket_id, message_id null, note_id null, object_key, filename, mime, size, sha256
categories      id, slug, name, description, order, is_public, default_priority,
                form_schema jsonb, wiki_links jsonb, discord_channel_id, auto_assign_staff_id null
staff           id, discord_user_id unique, email citext, display_name, avatar_url,
                role enum(admin, agent, viewer), signature_md, is_active
staff_credentials (webauthn) · staff_totp (encrypted secret) · sessions
canned_replies  id, title, body_md, category_id null
tags / ticket_tags
ticket_events   audit trail: id, ticket_id, actor, type, payload jsonb, at
customer_tokens token_hash, ticket_id, email, expires_at, used_at
bans            email / ip / domain, reason, by, at
inbound_emails  raw MIME + parse result for replay
network_status  cached explorer/bridge snapshot for the home widget
```

---

## Part 4 — Product design (improve, don't replicate)

### 4.1 Public site map — support.conceal.network

```
/                        Hero + live status card, search-first, 4 category cards, "Check a ticket"
/new                     Category picker
/new/[category]          Structured form, live doc suggestions in the side panel
/ticket/[trackingId]     Customer ticket view (email challenge or magic-link token)
/lookup                  Tracking ID + email; "Forgot your tracking ID?"
/status                  Network + support status page (chain height, bridge, queue depth, avg first reply)
/security                "How to recognise real Conceal support" — linkable from Discord/Telegram pins
/docs → 302              https://concealnetwork.github.io/conceal-wiki/  (single source of truth; no second KB)
```

At launch the old host redirects `conceal.network/support/*` → `https://support.conceal.network/` (single rule; no per-ticket mapping since nothing is migrated).

### 4.2 Categories and structured forms

Keep the four buckets staff already triage by, but give each a schema. Fields live in `tickets.fields` and render as mono chips.

**Wallets** — wallet (Desktop / Web / Android / Core CLI / Paper / other); version (dropdown from GitHub Releases + "other"); OS/device; problem type (sync, balance, send/receive, deposits, messaging, startup/crash, restore); optional tx hash (64-hex, validated, explorer-linked) and wallet height. Pinned docs: Troubleshooting, Wallets, Backup & Security.

**Bridge (wCCX)** — direction (CCX→wCCX / wCCX→CCX); chain (Ethereum / BSC / Polygon); CCX tx hash + EVM tx hash (both validated + linked); amount; date. Pinned: wCCX Bridge.

**Chain / Security** — topic (node, mining, security report, consensus, deposits); node version; OS; public node?; log excerpt with a scrub reminder. **Security report** path: a responsible-disclosure toggle forces priority=high, restricts to admins, and notifies a private Discord channel instead of the general feed. Pinned: Run a Node, Mining, Releases & Verification.

**General** — topic (exchanges, marketplace, website, docs feedback, partnership, other); free text.

Common: name, email, subject, Markdown message with preview, up to 3 attachments (10 MB; images/logs/txt/pdf/zip), Turnstile.

### 4.3 Sensitive-data guard (the headline improvement over HESK)

Client **and** server checks before a message is accepted:

* **Mnemonic** — 25 consecutive words from the CryptoNote English wordlist → hard block; text never leaves the browser, and the server re-checks and rejects with 422 without logging the body.
* **Bare 64-hex** not in a "tx/hash" context → soft warning ("looks like a spend/view key; only transaction hashes should be shared").
* "password"/"PIN" phrases → soft warning.
* Amber notice above every message box and in every email footer.

### 4.4 Deflection

While typing a subject (≥3 words) the side panel queries the wiki search index and shows up to 5 articles; "This solved it" ends the flow and records a `deflection` event. Each category pins 3 docs. The home page search box searches docs first and only then offers "Open a ticket".

### 4.5 Live status card and status page

Pulled every 60 s from `explorer.conceal.network` and the bridge: chain height, last block age, bridge health, plus support metrics (open tickets, median first reply this week). Shown as the hero glass card and at `/status`. This turns "is it just me?" into a self-serve answer and keeps the hero from being decorative.

### 4.6 Staff console — `/staff`

* Login with Discord (role-gated) + passkey/TOTP.
* Queue with saved views (Mine, Unassigned, Waiting on staff, Bridge, Security), SLA colouring (first reply > 24 h → amber, > 72 h → red), keyboard shortcuts with keycap hints.
* Ticket view: timeline left; right rail with field chips, live explorer lookups (confirmations / height), requester's other tickets, tags, notes, event log, "Open Discord thread" button.
* Composer: Markdown, canned replies with `{{name}}`/`{{tracking_id}}`, "reply and set status", attachments, signature, "post as note" toggle.
* Actions: assign, merge, split, tag, priority, ban requester, convert Discord thread → ticket.
* Settings: categories + form schemas (JSON editor with validation), canned replies, staff roles, email templates, Discord/Signal config, bans, retention.
* Reports: volume by category/week, first-reply and resolution medians, deflection rate, top surfaced docs, staff load.

### 4.7 Discord integration (primary team channel)

A single Discord bot (discord.js, runs in the app process or as a sidecar):

**Outbound**
* New ticket → embed in `#support-queue` (category, priority, subject, requester initials, tracking ID, link) **and** a forum-style thread is created per ticket so discussion stays attached. `tickets.discord_thread_id` stores it.
* Customer reply → message in that thread + embed update. Staff reply / status change → thread message (so the thread is a mirror of the timeline).
* Security-report tickets → `#security-private` only.
* Daily digest at a configurable hour: unassigned count, oldest waiting, SLA breaches.

**Inbound / commands**
* `/ticket view <id>` — embed with status, assignee, last message.
* `/ticket assign <id> [@staff]`, `/ticket status <id> <status>`, `/ticket priority <id> <p>`.
* `/ticket reply <id> <text>` — posts a **customer-visible** reply from the thread (guarded: requires the `support-staff` role; the bot confirms before sending).
* `/ticket note <id> <text>` — internal note.
* **Thread → ticket**: in a community help channel, staff run `/ticket create` on a user's post (or react with 🎫) to open a ticket pre-filled with the message; the bot DMs the user their tracking ID and magic link. This is the missing bridge between where users actually ask (Discord) and the queue.
* Role sync: staff roster and roles derive from Discord roles (`support-admin`, `support-staff`); a nightly job deactivates staff who lost the role.

### 4.8 Signal integration (optional, secondary)

Signal has no bot API, so this is notification-only via `signal-cli` in REST mode (`bbernhard/signal-cli-rest-api` container, dedicated number):
* Sends to a staff **Signal group**: new high/critical tickets, security reports, SLA breaches, daily digest.
* No inbound commands (Signal can't do slash commands; replies would be unverifiable).
* Configurable per-event on the settings page; disabled by default until a number is provisioned.

### 4.9 Email behaviour

* Customer receives: created (tracking ID + magic link), staff replied, resolved (rating link), tracking-ID reminder. Templates use the amber/warm-neutral theme with a plain-text alternative and the security footer.
* Reply-by-email: `Reply-To: support+<trackingId>@conceal.network`; the IMAP poller matches the plus-address, verifies the sender against the ticket, strips quoted history, appends as a customer message. Unknown senders → new General ticket (rate-limited).
* Staff email is opt-in per person (most will rely on Discord).

### 4.10 Security and privacy defaults

* No customer accounts or passwords; tokens hashed at rest, magic links expire in 7 days, single-use for close/rate.
* Staff: Discord OAuth + mandatory second factor, 8-hour sessions, admin actions logged.
* CSP, `SameSite=Strict` cookies, uploads served via presigned MinIO URLs with `Content-Disposition: attachment`, MIME sniffed server-side, optional ClamAV sidecar.
* Retention: purge attachments 180 d after close; anonymise requester email 12 months after close (configurable).
* No third-party analytics; server-side counters only. Self-hosted fonts; no CDN requests from the page except Turnstile.
* Discord bot token, SMTP, Signal and MinIO credentials via env / Docker secrets; the bot has only the channel permissions it needs.

---

## Part 5 — Repo layout

```
conceal-support/
  app/
    (public)/            page.tsx, new/, ticket/[id]/, lookup/, status/, security/
    (staff)/staff/       queue, ticket/[id], settings/, reports/
    api/                 tickets, inbound-email, discord/interactions, webhooks, healthz
  components/            ui/ (shadcn restyled), brand/ (mark, wordmark, hero-ring), ticket/, forms/, status/
  lib/
    db/                  drizzle schema + migrations
    auth/                discord-oauth, webauthn, totp, sessions
    guards/              mnemonic.ts (CryptoNote wordlist), hex.ts, sanitize.ts
    integrations/        discord/ (bot, embeds, commands), signal.ts, explorer.ts, github-releases.ts, wiki-search.ts
    email/               templates (react-email), imap-poller.ts, smtp.ts
    storage/             minio.ts (presign, lifecycle)
  content/               category schemas (JSON), security page (MDX), email copy
  scripts/               refresh-releases.ts, seed.ts
  tests/                 unit (guards, parsers, embeds), e2e (Playwright: submit → view → staff reply → Discord mock)
  docker-compose.yml     app · postgres · minio · caddy · signal-cli (profile: signal) · clamav (profile: av)
  docs/                  this plan, reference/ (brand assets + theme screenshots)
```

---

## Part 6 — Delivery plan

| Phase | Deliverable | Effort |
| --- | --- | --- |
| 0 | Repo scaffold, tokens + fonts + shadcn restyle, hero/brand components, Docker Compose (app, postgres, minio, caddy), CI | 2 days |
| 1 | Public MVP: home + status card, 4 structured forms, sensitive-data guard, Turnstile, create/view/reply, magic links, outbound email, tracking-ID reminder | 1 week |
| 2 | Staff console: Discord OAuth + 2FA, queue, ticket view, reply/notes/assign, canned replies, settings | 1–1.5 weeks |
| 3 | Discord bot (embeds, per-ticket threads, slash commands, thread→ticket), explorer + GitHub feeds, wiki deflection, IMAP reply-by-email | 1 week |
| 4 | Integration test pass with real credentials (Discord, mailbox, MinIO, Signal), redirect on old host, cut-over runbook | 2 days |
| 5 | Signal notifications, reports, retention jobs, a11y pass, load test, launch | 3 days |

---

## Things still needed from the team

1. **Subdomain**: admins create `support.conceal.network` (A/AAAA → VPS) and, at cut-over, the redirect rules on the LiteSpeed host.
2. **Discord**: a bot application (token + client ID/secret for OAuth), the `support-admin` / `support-staff` roles, and the `#support-queue` and `#security-private` channel IDs.
3. **Mailbox**: IMAP + SMTP credentials for `support@conceal.network` and confirmation that plus-addressing (`support+id@`) is delivered.
4. **Signal** (optional): a dedicated phone number to register with `signal-cli`, and the staff group.
5. **Copy**: sign-off on the hero headline and the security-notice wording.
