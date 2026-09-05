# Conceal Support

In-house support platform for Conceal Network, replacing the HESK desk at
`conceal.network/support`. Built with Next.js 16, React 19, Tailwind 4,
PostgreSQL (Drizzle), MinIO and a Discord bot — themed after
[wallet.conceal.network](https://wallet.conceal.network).

See `docs/SUPPORT-REBUILD-PLAN.md` for the full current-state analysis and
product design, and `docs/reference/` for brand assets and theme screenshots.

## Features

- **Public site** — search-first home with live chain status, four category
  ticket forms with structured fields (wallet/version/OS, bridge hashes, node
  info), tracking-ID lookup, `/status` and `/security` pages.
- **Seed-phrase guard** — 25-word CryptoNote mnemonics are blocked client- and
  server-side (wordlist extracted from `conceal-core`); bare 64-hex keys warn.
- **No accounts** — customers get a tracking ID (`CCX-XXXX-XXXX`) plus signed
  magic links; reply by email via an IMAP poller.
- **Staff console** — Discord OAuth (role-gated) with second factor, queue
  with saved views, ticket view with field chips and event log, canned replies,
  internal notes, assignment, priorities, statuses.
- **Discord bot** — per-ticket threads in `#support-queue`, embeds, slash
  commands (`/ticket view|assign|status|priority|reply|note`), confidential
  security reports routed to a private channel, thread→ticket conversion is a
  follow-up.
- **Signal** (optional) — notifications to a staff group via signal-cli REST.
- **Self-hosted attachments** — MinIO with presigned URLs and MIME/size limits.

## Quick start (local)

```bash
npm ci
cp .env.example .env            # defaults work for local dev
docker run -d --name conceal-support-pg \
  -e POSTGRES_USER=conceal -e POSTGRES_PASSWORD=conceal \
  -e POSTGRES_DB=conceal_support -p 127.0.0.1:5433:5432 postgres:16-alpine
export DATABASE_URL=postgres://conceal:conceal@127.0.0.1:5433/conceal_support
npm run db:migrate && npm run db:seed
npm run dev                     # http://localhost:3000
```

All integrations (SMTP, IMAP, MinIO, Discord, Signal, Turnstile) are optional
and detected from the environment — the app runs with them disabled.

## Production

```bash
cp .env.example .env            # fill in every credential
docker compose up -d --build    # app + worker + postgres + minio + caddy
docker compose --profile signal up -d   # optional signal-cli sidecar
```

Caddy terminates TLS for `support.conceal.network` (set `SUPPORT_DOMAIN` to
override). The `worker` service runs the Discord gateway bot and the IMAP
poller alongside the app.

### Environment reference

Every variable is documented inline in `.env.example`. Groups: core
(`APP_URL`, `APP_SECRET`, `DATABASE_URL`), MinIO, SMTP/IMAP, Discord (bot +
OAuth + guild/channel/role IDs), Signal, Turnstile, data sources (explorer,
bridge, docs, GitHub org) and the bootstrap admin email.

### Discord setup

1. Create an application at <https://discord.com/developers/applications>,
   add a bot, copy the token and the OAuth2 client id/secret.
2. Invite it with the `bot` + `applications.commands` scopes; enable
   **Server Members Intent**.
3. Create `#support-queue` (and a private `#security-private`), plus
   `support-staff` / `support-admin` roles; put their IDs in the env.
4. OAuth2 redirect: `<APP_URL>/api/auth/discord/callback`.
5. `npm run discord:register` (or restart the worker) registers the
   `/ticket` slash commands.

### Email setup

Point `SMTP_*` at the `support@conceal.network` mailbox for outbound mail and
`IMAP_*` at the same mailbox for inbound replies. Inbound mail is routed by
plus-addressing: customers reply to `support+CCX-XXXX-XXXX@conceal.network`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js app |
| `npm run verify` | lint + typecheck + tests + build |
| `npm test` | unit tests (guards, markdown, forms, brand) |
| `npm run db:migrate` / `db:seed` | apply SQL migrations / seed categories + canned replies |
| `npm run worker` | Discord bot + IMAP poller + bucket bootstrap |
| `npm run discord:register` | register guild slash commands |

## Repository layout

```
app/                public + staff pages, API routes (tickets, lookup,
                    attachments, staff actions, auth, healthz)
components/         brand, ticket form, ticket views, lookup form
lib/
  db/               Drizzle schema + client
  forms/            declarative per-category form schema + validation
  guards/           seed-phrase guard, markdown sanitizer, tracking IDs
  auth/             Discord OAuth, sessions, staff roster
  tickets/          ticket service (create, reply, statuses, rate limits)
  integrations/     explorer, mailer, MinIO, IMAP, Discord bot, Signal
content/            category definitions (forms + pinned docs)
scripts/            migrate, seed, worker, alias loader
drizzle/            generated SQL migrations
docs/               plan + brand reference
```

## License / ownership

Conceal Network internal project.
