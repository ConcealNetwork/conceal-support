import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const ticketStatus = pgEnum('ticket_status', [
  'new',
  'open',
  'waiting_customer',
  'waiting_staff',
  'on_hold',
  'resolved',
  'closed',
]);
export const ticketPriority = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical']);
export const ticketSource = pgEnum('ticket_source', ['web', 'email', 'discord']);
export const messageAuthor = pgEnum('message_author', ['customer', 'staff', 'system']);
export const messageVia = pgEnum('message_via', ['web', 'email', 'discord']);
export const staffRole = pgEnum('staff_role', ['admin', 'agent', 'viewer']);
export const banKind = pgEnum('ban_kind', ['email', 'domain', 'ip']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublic: boolean('is_public').notNull().default(true),
  defaultPriority: ticketPriority('default_priority').notNull().default('medium'),
  /** Field definitions rendered on the public form; see lib/forms/schema.ts */
  formSchema: jsonb('form_schema').notNull().default(sql`'[]'::jsonb`),
  /** [{ title, href }] pinned docs shown next to the form */
  docLinks: jsonb('doc_links').notNull().default(sql`'[]'::jsonb`),
  discordChannelId: text('discord_channel_id'),
  autoAssignStaffId: uuid('auto_assign_staff_id'),
  ...timestamps,
});

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    discordUserId: text('discord_user_id'),
    role: staffRole('role').notNull().default('agent'),
    signatureMd: text('signature_md').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    notifyEmail: boolean('notify_email').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('staff_email_idx').on(sql`lower(${t.email})`),
    uniqueIndex('staff_discord_idx').on(t.discordUserId),
  ],
);

export const staffCredentials = pgTable('staff_credentials', {
  id: text('id').primaryKey(), // webauthn credential id (base64url)
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staff.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(), // base64url
  counter: integer('counter').notNull().default(0),
  transports: jsonb('transports').notNull().default(sql`'[]'::jsonb`),
  label: text('label').notNull().default('Passkey'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staffTotp = pgTable('staff_totp', {
  staffId: uuid('staff_id')
    .primaryKey()
    .references(() => staff.id, { onDelete: 'cascade' }),
  secretEnc: text('secret_enc').notNull(), // AES-GCM, key derived from APP_SECRET
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(), // sha256(token)
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staff.id, { onDelete: 'cascade' }),
  /** false until the second factor has been passed */
  mfaPassed: boolean('mfa_passed').notNull().default(false),
  ip: text('ip'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackingId: text('tracking_id').notNull().unique(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    status: ticketStatus('status').notNull().default('new'),
    priority: ticketPriority('priority').notNull().default('medium'),
    subject: text('subject').notNull(),
    requesterName: text('requester_name').notNull(),
    requesterEmail: text('requester_email').notNull(),
    assigneeId: uuid('assignee_id').references(() => staff.id, { onDelete: 'set null' }),
    /** Structured answers keyed by form field id */
    fields: jsonb('fields').notNull().default(sql`'{}'::jsonb`),
    source: ticketSource('source').notNull().default('web'),
    /** Responsible-disclosure tickets: visible to admins only, routed to the private channel */
    isConfidential: boolean('is_confidential').notNull().default(false),
    discordThreadId: text('discord_thread_id'),
    discordMessageId: text('discord_message_id'),
    requesterIp: text('requester_ip'),
    lastCustomerReplyAt: timestamp('last_customer_reply_at', { withTimezone: true }),
    lastStaffReplyAt: timestamp('last_staff_reply_at', { withTimezone: true }),
    firstStaffReplyAt: timestamp('first_staff_reply_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('tickets_status_idx').on(t.status, t.updatedAt),
    index('tickets_email_idx').on(sql`lower(${t.requesterEmail})`),
    index('tickets_assignee_idx').on(t.assigneeId),
    index('tickets_category_idx').on(t.categoryId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    authorType: messageAuthor('author_type').notNull(),
    authorStaffId: uuid('author_staff_id').references(() => staff.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    bodyMd: text('body_md').notNull(),
    bodyHtml: text('body_html').notNull(),
    via: messageVia('via').notNull().default('web'),
    emailMessageId: text('email_message_id'),
    rating: smallint('rating'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('messages_ticket_idx').on(t.ticketId, t.createdAt)],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    bodyMd: text('body_md').notNull(),
    bodyHtml: text('body_html').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notes_ticket_idx').on(t.ticketId, t.createdAt)],
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    noteId: uuid('note_id').references(() => notes.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    sha256: text('sha256').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('attachments_ticket_idx').on(t.ticketId)],
);

export const cannedReplies = pgTable('canned_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  updatedById: uuid('updated_by_id').references(() => staff.id, { onDelete: 'set null' }),
  ...timestamps,
});

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('amber'),
});

export const ticketTags = pgTable(
  'ticket_tags',
  {
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('ticket_tags_pk').on(t.ticketId, t.tagId)],
);

export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    actorType: messageAuthor('actor_type').notNull(),
    actorStaffId: uuid('actor_staff_id').references(() => staff.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ticket_events_ticket_idx').on(t.ticketId, t.createdAt)],
);

export const customerTokens = pgTable(
  'customer_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    purpose: text('purpose').notNull().default('view'), // view | rate | close
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('customer_tokens_ticket_idx').on(t.ticketId)],
);

export const bans = pgTable('bans', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: banKind('kind').notNull(),
  value: text('value').notNull(),
  reason: text('reason').notNull().default(''),
  createdById: uuid('created_by_id').references(() => staff.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inboundEmails = pgTable('inbound_emails', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: text('message_id').unique(),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  subject: text('subject').notNull().default(''),
  rawSize: integer('raw_size').notNull().default(0),
  outcome: text('outcome').notNull(), // matched | created | rejected | error
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  detail: text('detail'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
});

export type Ticket = typeof tickets.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type CannedReply = typeof cannedReplies.$inferSelect;
export type TicketStatus = (typeof ticketStatus.enumValues)[number];
export type TicketPriority = (typeof ticketPriority.enumValues)[number];
