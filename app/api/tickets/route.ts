import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createTicket, rateLimit, logEvent, getTicketById, customerViewToken } from '@/lib/tickets/service';
import { env, integrations } from '@/lib/env';
import { notifySignalHighPriority } from '@/lib/integrations/signal';
import { announceTicket, postSecurityNotice } from '@/lib/integrations/discord/bot';
import { sendMail } from '@/lib/integrations/mailer';

const bodySchema = z.object({
  categorySlug: z.string(),
  name: z.string(),
  email: z.string(),
  subject: z.string(),
  message: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ ok: false, errors: { form: 'Invalid request.' } }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const limited =
    !(await rateLimit(`new:${ip ?? 'unknown'}`, 5, 3600)) ||
    !(await rateLimit(`newemail:${body.email.toLowerCase()}`, 5, 3600));
  if (limited) {
    return NextResponse.json(
      { ok: false, errors: { form: 'Too many tickets from this source. Try again later.' } },
      { status: 429 },
    );
  }

  if (integrations().turnstile) {
    const ok = await verifyTurnstile(body.turnstileToken, ip);
    if (!ok) return NextResponse.json({ ok: false, errors: { form: 'Captcha verification failed.' } }, { status: 400 });
  }

  const result = await createTicket({
    categorySlug: body.categorySlug,
    name: body.name,
    email: body.email,
    subject: body.subject,
    message: body.message,
    priority: body.priority,
    fields: body.fields,
    ip,
  });

  if (!result.ok) {
    const guard = result.blocked === 'sensitive' ? { level: 'block', message: result.errors.message ?? '' } : undefined;
    return NextResponse.json(
      { ok: false, errors: prefixFieldErrors(result.errors), guard },
      { status: result.blocked === 'sensitive' ? 422 : 400 },
    );
  }

  const ticket = await getTicketById(result.ticketId);
  const viewToken = customerViewToken(result.trackingId, body.email);

  // Notifications — all best-effort, never block the response on failure.
  const appUrl = env().APP_URL;
  await Promise.allSettled([
    sendMail({
      to: body.email,
      subject: `[${result.trackingId}] ${body.subject}`,
      heading: 'We received your ticket',
      bodyMd:
        `Thanks ${body.name.split(' ')[0]} — your ticket is in the queue. Replies will arrive on this ` +
        `email address; you can reply by replying to this message.`,
      trackingId: result.trackingId,
      link: { label: 'View your ticket', url: `${appUrl}/ticket/${result.trackingId}?t=${viewToken}` },
    }),
    ticket ? announceTicket(result.ticketId, body.message) : Promise.resolve(),
    ticket?.isConfidential ? postSecurityNotice(result.ticketId, `New confidential ticket ${result.trackingId}`) : Promise.resolve(),
    ticket
      ? notifySignalHighPriority({
          trackingId: result.trackingId,
          subject: body.subject,
          priority: ticket.priority,
          url: `${appUrl}/staff/ticket/${result.ticketId}`,
        })
      : Promise.resolve(),
    logEvent(result.ticketId, 'created', { source: 'web', ip }),
  ]);

  return NextResponse.json({ ok: true, trackingId: result.trackingId });
}

function prefixFieldErrors(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) {
    out[k === 'message' || k === 'name' || k === 'email' || k === 'subject' ? k : `field_${k}`] = v;
  }
  return out;
}

async function verifyTurnstile(token: string | undefined, ip: string | undefined): Promise<boolean> {
  if (!token) return false;
  const e = env();
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: e.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return false;
  const j = (await res.json()) as { success: boolean };
  return j.success;
}
