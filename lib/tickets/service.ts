import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { newTrackingId, normalizeTrackingId, sha256, signToken, verifyToken } from '@/lib/guards/tickets';
import { renderMarkdown } from '@/lib/guards/markdown';
import { validateFields, type FormField } from '@/lib/forms/schema';
import { checkSensitive } from '@/lib/guards/sensitive';

export type CreateTicketInput = {
  categorySlug: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  fields?: Record<string, unknown>;
  source?: 'web' | 'email' | 'discord';
  ip?: string;
};

export type CreateTicketResult =
  | { ok: true; trackingId: string; ticketId: string }
  | { ok: false; errors: Record<string, string>; blocked?: 'sensitive' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function activeBanned(value: string): Promise<boolean> {
  const rows = await db.select({ id: schema.bans.id }).from(schema.bans).where(eq(schema.bans.value, value)).limit(1);
  return rows.length > 0;
}

export async function getCategory(slug: string) {
  const rows = await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listCategories() {
  return db.select().from(schema.categories).where(eq(schema.categories.isPublic, true)).orderBy(schema.categories.sortOrder);
}

export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  const errors: Record<string, string> = {};
  const name = (input.name ?? '').trim();
  const email = (input.email ?? '').trim().toLowerCase();
  const subject = (input.subject ?? '').trim();
  const message = (input.message ?? '').trim();

  if (name.length < 2 || name.length > 80) errors.name = 'Enter your name (2–80 characters).';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (subject.length < 4 || subject.length > 120) errors.subject = 'Subject must be 4–120 characters.';
  if (message.length < 10) errors.message = 'Describe the problem in at least 10 characters.';
  if (message.length > 20000) errors.message = 'Message is too long.';

  // Bans (only enforce when the value was provided — keeps unit-less calls working)
  if (email && (await activeBanned(email))) errors.email = 'This email address cannot submit tickets.';
  if (input.ip && (await activeBanned(input.ip))) errors.ip = 'Requests from this address cannot submit tickets.';

  const category = await getCategory(input.categorySlug);
  if (!category || !category.isPublic) {
    return { ok: false, errors: { category: 'Unknown category.' } };
  }

  const guard = checkSensitive(message);
  if (guard.level === 'block') {
    return { ok: false, errors: { message: guard.message ?? 'This message cannot be accepted.' }, blocked: 'sensitive' };
  }

  const fields = validateFields(category.formSchema as FormField[], input.fields ?? {});
  Object.assign(errors, fields.errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const isConfidential = fields.values['confidential'] === true;
  const trackingId = newTrackingId();

  const inserted = await db
    .insert(schema.tickets)
    .values({
      trackingId,
      categoryId: category.id,
      priority: isConfidential ? 'high' : (input.priority ?? category.defaultPriority),
      subject,
      requesterName: name,
      requesterEmail: email,
      fields: fields.values,
      source: input.source ?? 'web',
      isConfidential,
      requesterIp: input.ip,
      status: 'new',
    })
    .returning({ id: schema.tickets.id });

  const ticketId = inserted[0]!.id;
  await addMessage({
    ticketId,
    authorType: 'customer',
    authorName: name,
    bodyMd: message,
    via: input.source === 'email' ? 'email' : 'web',
    emailMessageId: input.source === 'email' ? fields.values['__email_message_id'] as string | undefined : undefined,
  });

  return { ok: true, trackingId, ticketId };
}

export async function addMessage(opts: {
  ticketId: string;
  authorType: 'customer' | 'staff' | 'system';
  authorName: string;
  bodyMd: string;
  via?: 'web' | 'email' | 'discord';
  authorStaffId?: string;
  emailMessageId?: string;
  rating?: number;
}) {
  const bodyHtml = renderMarkdown(opts.bodyMd);
  const rows = await db
    .insert(schema.messages)
    .values({
      ticketId: opts.ticketId,
      authorType: opts.authorType,
      authorStaffId: opts.authorStaffId,
      authorName: opts.authorName,
      bodyMd: opts.bodyMd,
      bodyHtml,
      via: opts.via ?? 'web',
      emailMessageId: opts.emailMessageId,
      rating: opts.rating,
    })
    .returning({ id: schema.messages.id });

  const now = sql`now()`;
  const patch =
    opts.authorType === 'customer'
      ? { lastCustomerReplyAt: now, updatedAt: now, status: sql`case when ${schema.tickets.status} in ('new','waiting_customer','on_hold') then 'waiting_staff'::ticket_status else ${schema.tickets.status} end` }
      : opts.authorType === 'staff'
        ? { lastStaffReplyAt: now, updatedAt: now, firstStaffReplyAt: sql`coalesce(${schema.tickets.firstStaffReplyAt}, now())`, status: sql`'waiting_customer'::ticket_status` }
        : { updatedAt: now };
  await db.update(schema.tickets).set(patch).where(eq(schema.tickets.id, opts.ticketId));
  return rows[0]!.id;
}

export async function addNote(ticketId: string, staffId: string, authorName: string, bodyMd: string) {
  await db.insert(schema.notes).values({
    ticketId,
    staffId,
    authorName,
    bodyMd,
    bodyHtml: renderMarkdown(bodyMd),
  });
}

export async function getTicketByTrackingId(trackingId: string) {
  const rows = await db
    .select()
    .from(schema.tickets)
    .where(eq(schema.tickets.trackingId, normalizeTrackingId(trackingId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTicketById(id: string) {
  const rows = await db.select().from(schema.tickets).where(eq(schema.tickets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function ticketConversation(ticketId: string) {
  const [msgs, notes_, atts, events] = await Promise.all([
    db.select().from(schema.messages).where(eq(schema.messages.ticketId, ticketId)).orderBy(schema.messages.createdAt),
    db.select().from(schema.notes).where(eq(schema.notes.ticketId, ticketId)).orderBy(schema.notes.createdAt),
    db.select().from(schema.attachments).where(eq(schema.attachments.ticketId, ticketId)),
    db.select().from(schema.ticketEvents).where(eq(schema.ticketEvents.ticketId, ticketId)).orderBy(schema.ticketEvents.createdAt),
  ]);
  return { messages: msgs, notes: notes_, attachments: atts, events };
}

export async function setTicketStatus(ticketId: string, status: schema.TicketStatus) {
  const patch: Record<string, unknown> = { status, updatedAt: sql`now()` };
  if (status === 'resolved') patch.resolvedAt = sql`now()`;
  if (status === 'closed') patch.closedAt = sql`now()`;
  await db.update(schema.tickets).set(patch).where(eq(schema.tickets.id, ticketId));
}

export async function setTicketPriority(ticketId: string, priority: schema.TicketPriority) {
  await db.update(schema.tickets).set({ priority, updatedAt: sql`now()` }).where(eq(schema.tickets.id, ticketId));
}

export async function assignTicket(ticketId: string, staffId: string | null) {
  await db.update(schema.tickets).set({ assigneeId: staffId, updatedAt: sql`now()` }).where(eq(schema.tickets.id, ticketId));
}

export async function logEvent(ticketId: string, type: string, payload: Record<string, unknown>, actorType: 'customer' | 'staff' | 'system' = 'system', actorStaffId?: string) {
  await db.insert(schema.ticketEvents).values({ ticketId, type, payload, actorType, actorStaffId });
}

/** Stateless magic-link token granting access to one ticket for one email. */
export function customerViewToken(trackingId: string, email: string): string {
  return signToken(`v:${trackingId}:${email}`, env().APP_SECRET);
}

export function verifyCustomerToken(token: string): { trackingId: string; email: string } | null {
  const payload = verifyToken(token, env().APP_SECRET);
  if (!payload?.startsWith('v:')) return null;
  const [, trackingId, email] = payload.split(':');
  if (!trackingId || !email) return null;
  return { trackingId, email };
}

/** Verify the classic tracking-ID + email challenge. */
export function verifyCustomerChallenge(trackingId: string, email: string, ticket: { trackingId: string; requesterEmail: string }): boolean {
  return (
    normalizeTrackingId(trackingId) === ticket.trackingId && email.trim().toLowerCase() === ticket.requesterEmail.toLowerCase()
  );
}

export function hashToken(token: string): string {
  return sha256(token);
}

/** Fixed-window rate limit stored in Postgres (works across app+worker). */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db
    .insert(schema.rateLimits)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case
          when ${schema.rateLimits.windowStart} < now() - (${windowSeconds} * interval '1 second')
          then 1 else ${schema.rateLimits.count} + 1 end`,
        windowStart: sql`case
          when ${schema.rateLimits.windowStart} < now() - (${windowSeconds} * interval '1 second')
          then now() else ${schema.rateLimits.windowStart} end`,
      },
    })
    .returning({ count: schema.rateLimits.count });
  return (rows[0]?.count ?? 0) <= limit;
}

export async function recentTicketsForEmail(email: string, limit = 5) {
  return db
    .select({
      id: schema.tickets.id,
      trackingId: schema.tickets.trackingId,
      subject: schema.tickets.subject,
      status: schema.tickets.status,
      updatedAt: schema.tickets.updatedAt,
    })
    .from(schema.tickets)
    .where(and(eq(sql`lower(${schema.tickets.requesterEmail})`, email.toLowerCase())))
    .orderBy(desc(schema.tickets.updatedAt))
    .limit(limit);
}
