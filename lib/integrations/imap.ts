import { simpleParser } from 'mailparser';
import { ImapFlow } from 'imapflow';
import { env, integrations } from '@/lib/env';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { createTicket, getTicketByTrackingId, addMessage, rateLimit } from '@/lib/tickets/service';
import { checkSensitive } from '@/lib/guards/sensitive';
import { isValidTrackingId } from '@/lib/guards/tickets';

/** Extract the tracking ID from a plus-addressed Reply-To (support+CCX-XXXX-XXXX@…). */
export function trackingIdFromAddress(toAddress: string): string | null {
  const m = toAddress.toLowerCase().match(/^[^+]+\+([^@]+)@/);
  if (!m) return null;
  const candidate = m[1]!.toUpperCase();
  return isValidTrackingId(candidate) ? candidate : null;
}

export type InboundOutcome =
  | { outcome: 'matched'; ticketId: string }
  | { outcome: 'created'; ticketId: string }
  | { outcome: 'rejected'; reason: string }
  | { outcome: 'skipped'; reason: string };

/** Handle one parsed inbound email. Sender verification: plus-address or From match. */
export async function handleInboundEmail(mail: {
  messageId?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
}): Promise<InboundOutcome> {
  const from = (mail.from ?? '').trim().toLowerCase();
  const to = (mail.to ?? '').trim();
  const subject = (mail.subject ?? '(no subject)').trim();
  const text = (mail.text ?? '').trim();

  if (!from || !text) return { outcome: 'rejected', reason: 'missing sender or body' };

  // strip quoted reply history
  const body = text.split(/\nOn .+ wrote:\n/)[0]!.trim() || text;

  const trackingId = trackingIdFromAddress(to);
  if (trackingId) {
    const ticket = await getTicketByTrackingId(trackingId);
    if (!ticket) return { outcome: 'rejected', reason: `unknown tracking id ${trackingId}` };
    if (ticket.requesterEmail.toLowerCase() !== from) {
      return { outcome: 'rejected', reason: 'sender does not own ticket' };
    }
    const guard = checkSensitive(body);
    if (guard.level === 'block') return { outcome: 'rejected', reason: 'sensitive content blocked' };
    await addMessage({
      ticketId: ticket.id,
      authorType: 'customer',
      authorName: ticket.requesterName,
      bodyMd: body,
      via: 'email',
      emailMessageId: mail.messageId,
    });
    await logInbound(mail, 'matched', ticket.id);
    return { outcome: 'matched', ticketId: ticket.id };
  }

  // New ticket via email lands in General.
  const allowed = await rateLimit(`email:${from}`, 5, 3600);
  if (!allowed) return { outcome: 'rejected', reason: 'rate limited' };
  const guard = checkSensitive(body);
  if (guard.level === 'block') return { outcome: 'rejected', reason: 'sensitive content blocked' };

  const created = await createTicket({
    categorySlug: 'general',
    name: mail.from!.split('@')[0]!,
    email: from,
    subject: subject.replace(/^re:\s*/i, '').slice(0, 120) || 'Email request',
    message: body,
    source: 'email',
  });
  if (!created.ok) return { outcome: 'rejected', reason: Object.values(created.errors)[0] ?? 'validation failed' };
  await logInbound(mail, 'created', created.ticketId);
  return { outcome: 'created', ticketId: created.ticketId };
}

async function logInbound(mail: { messageId?: string; from?: string; to?: string; subject?: string }, outcome: string, ticketId: string | null) {
  await db
    .insert(schema.inboundEmails)
    .values({
      messageId: mail.messageId,
      fromAddress: mail.from ?? '',
      toAddress: mail.to ?? '',
      subject: mail.subject ?? '',
      outcome,
      ticketId,
    })
    .onConflictDoNothing();
}

/** One IMAP poll: process unseen mail, mark seen. Throws on connection failure. */
export async function pollMailbox(): Promise<number> {
  if (!integrations().imap) return 0;
  const e = env();
  const imap = new ImapFlow({
    host: e.IMAP_HOST!,
    port: e.IMAP_PORT,
    secure: e.IMAP_SECURE,
    auth: { user: e.IMAP_USER!, pass: e.IMAP_PASS! },
    logger: false,
  });
  let processed = 0;
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(e.IMAP_MAILBOX);
    try {
      for await (const msg of imap.fetch({ seen: false }, { envelope: true, source: true })) {
        try {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          await handleInboundEmail({
            messageId: parsed.messageId,
            from: parsed.from?.value?.[0]?.address,
            to: Array.isArray(parsed.to) ? undefined : (parsed.to as { text?: string })?.text,
            subject: parsed.subject,
            text: parsed.text ?? undefined,
          });
          processed += 1;
          await imap.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        } catch (err) {
          console.error('[imap] message failed', err);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await imap.logout().catch(() => undefined);
  }
  return processed;
}

/** Daily digest to staff email (worker job). */
export async function staffDigest(): Promise<void> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tickets)
    .where(eq(schema.tickets.status, 'new'));
  console.log(`[digest] new tickets: ${rows[0]?.count ?? 0}`);
}
