import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  APP_SECRET: z.string().min(32).default('dev-only-secret-change-me-dev-only-secret-change-me'),
  DATABASE_URL: z.string().default('postgres://conceal:conceal@localhost:5432/conceal_support'),

  // Attachments — self-hosted MinIO
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: bool,
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default('support-attachments'),

  // Outbound email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Conceal Support <support@conceal.network>'),
  MAIL_REPLY_DOMAIN: z.string().default('conceal.network'),
  MAIL_REPLY_LOCALPART: z.string().default('support'),

  // Inbound email (IMAP poller)
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: z.string().optional().transform((v) => v !== 'false'),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  IMAP_MAILBOX: z.string().default('INBOX'),
  IMAP_POLL_SECONDS: z.coerce.number().default(60),

  // Discord
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_QUEUE_CHANNEL_ID: z.string().optional(),
  DISCORD_SECURITY_CHANNEL_ID: z.string().optional(),
  DISCORD_STAFF_ROLE_ID: z.string().optional(),
  DISCORD_ADMIN_ROLE_ID: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),

  // Signal (signal-cli-rest-api)
  SIGNAL_API_URL: z.string().optional(),
  SIGNAL_NUMBER: z.string().optional(),
  SIGNAL_GROUP_ID: z.string().optional(),

  // Anti-abuse
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // Data sources
  EXPLORER_URL: z.string().url().default('https://explorer.conceal.network'),
  EXPLORER_API_URL: z.string().url().default('https://explorer.conceal.network/daemon'),
  BRIDGE_URL: z.string().url().default('https://bridge.conceal.network'),
  DOCS_URL: z.string().url().default('https://concealnetwork.github.io/conceal-wiki'),
  GITHUB_ORG: z.string().default('ConcealNetwork'),

  // Bootstrap: first admin (used by db:seed only)
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Which optional integrations are configured. Used by the status page and settings UI. */
export function integrations() {
  const e = env();
  return {
    minio: Boolean(e.MINIO_ENDPOINT && e.MINIO_ACCESS_KEY && e.MINIO_SECRET_KEY),
    smtp: Boolean(e.SMTP_HOST),
    imap: Boolean(e.IMAP_HOST && e.IMAP_USER && e.IMAP_PASS),
    discordBot: Boolean(e.DISCORD_BOT_TOKEN && e.DISCORD_GUILD_ID),
    discordOAuth: Boolean(e.DISCORD_CLIENT_ID && e.DISCORD_CLIENT_SECRET),
    signal: Boolean(e.SIGNAL_API_URL && e.SIGNAL_NUMBER && e.SIGNAL_GROUP_ID),
    turnstile: Boolean(e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY),
  };
}
