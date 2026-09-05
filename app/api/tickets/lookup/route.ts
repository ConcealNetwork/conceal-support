import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db, schema } from '@/lib/db';
import { getTicketByTrackingId, rateLimit, verifyCustomerChallenge } from '@/lib/tickets/service';
import { normalizeTrackingId } from '@/lib/guards/tickets';
import { sendTrackingIdReminder } from '@/lib/integrations/mailer';

const postSchema = z.object({ trackingId: z.string(), email: z.string() });

/** Tracking ID + email challenge → sets a view cookie and redirects. */
export async function POST(req: NextRequest) {
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  const { email } = parsed.data;
  const trackingId = normalizeTrackingId(parsed.data.trackingId);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!(await rateLimit(`lookup:${ip ?? 'unknown'}`, 20, 3600))) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const ticket = await getTicketByTrackingId(trackingId);
  if (!ticket || !verifyCustomerChallenge(trackingId, email, ticket)) {
    return NextResponse.json({ ok: false, error: 'Those details did not match a ticket.' }, { status: 403 });
  }

  const jar = await cookies();
  jar.set(`cs_view_${ticket.id}`, '1', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 3600,
  });
  return NextResponse.json({ ok: true, redirect: `/ticket/${ticket.trackingId}` });
}

/** Email-my-tracking-IDs reminder. Always responds ok to avoid address probing. */
const putSchema = z.object({ email: z.string() });
export async function PUT(req: NextRequest) {
  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();

  if (!(await rateLimit(`remind:${email}`, 3, 3600))) return NextResponse.json({ ok: true });

  const rows = await db
    .select({ trackingId: schema.tickets.trackingId, subject: schema.tickets.subject, status: schema.tickets.status })
    .from(schema.tickets)
    .where(and(eq(sql`lower(${schema.tickets.requesterEmail})`, email), sql`${schema.tickets.status} <> 'closed'`))
    .limit(20);

  if (rows.length > 0) {
    await sendTrackingIdReminder(email, rows);
  }
  return NextResponse.json({ ok: true });
}
