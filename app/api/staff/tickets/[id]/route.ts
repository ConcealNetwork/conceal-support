import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { currentStaff } from '@/lib/auth/discord';
import { addMessage, addNote, assignTicket, getTicketById, logEvent, setTicketPriority, setTicketStatus } from '@/lib/tickets/service';
import { checkSensitive } from '@/lib/guards/sensitive';
import { postToThread, postCustomerMessage } from '@/lib/integrations/discord/bot';
import { sendMail } from '@/lib/integrations/mailer';
import { customerViewToken } from '@/lib/tickets/service';
import { env } from '@/lib/env';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reply'), bodyMd: z.string().min(1), status: z.enum(['open', 'waiting_customer', 'waiting_staff', 'on_hold', 'resolved', 'closed']).optional() }),
  z.object({ action: z.literal('note'), bodyMd: z.string().min(1) }),
  z.object({ action: z.literal('status'), status: z.enum(['open', 'waiting_customer', 'waiting_staff', 'on_hold', 'resolved', 'closed']) }),
  z.object({ action: z.literal('priority'), priority: z.enum(['low', 'medium', 'high', 'critical']) }),
  z.object({ action: z.literal('assign'), staffId: z.string().uuid().nullable() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentStaff();
  if (!session) return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  if (!session.mfaPassed) return NextResponse.json({ ok: false, error: 'Second factor required.' }, { status: 403 });
  if (session.staff.role === 'viewer') return NextResponse.json({ ok: false, error: 'Viewers cannot act.' }, { status: 403 });

  const { id } = await params;
  const ticket = await getTicketById(id);
  if (!ticket) return NextResponse.json({ ok: false, error: 'Ticket not found.' }, { status: 404 });

  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Invalid action.' }, { status: 400 });
  const a = parsed.data;

  switch (a.action) {
    case 'reply': {
      const guard = checkSensitive(a.bodyMd);
      if (guard.level === 'block') return NextResponse.json({ ok: false, error: guard.message ?? 'Blocked.' }, { status: 422 });
      const messageId = await addMessage({
        ticketId: ticket.id,
        authorType: 'staff',
        authorName: session.staff.displayName,
        authorStaffId: session.staff.id,
        bodyMd: a.bodyMd,
        via: 'web',
      });
      await logEvent(ticket.id, 'staff_replied', { via: 'web' }, 'staff', session.staff.id);
      await Promise.allSettled([
        postCustomerMessage(ticket.id, messageId, session.staff.displayName, a.bodyMd),
        sendMail({
          to: ticket.requesterEmail,
          subject: `Re: [${ticket.trackingId}] ${ticket.subject}`,
          heading: `${session.staff.displayName} replied to your ticket`,
          bodyMd: a.bodyMd,
          trackingId: ticket.trackingId,
          link: {
            label: 'View the conversation',
            url: `${env().APP_URL}/ticket/${ticket.trackingId}?t=${customerViewToken(ticket.trackingId, ticket.requesterEmail)}`,
          },
        }),
      ]);
      break;
    }
    case 'note': {
      await addNote(ticket.id, session.staff.id, session.staff.displayName, a.bodyMd);
      await logEvent(ticket.id, 'note_added', {}, 'staff', session.staff.id);
      break;
    }
    case 'status': {
      await setTicketStatus(ticket.id, a.status);
      await logEvent(ticket.id, 'status_changed', { status: a.status }, 'staff', session.staff.id);
      await postToThread(ticket.id, `🔧 Status set to **${a.status}**`);
      break;
    }
    case 'priority': {
      await setTicketPriority(ticket.id, a.priority);
      await logEvent(ticket.id, 'priority_changed', { priority: a.priority }, 'staff', session.staff.id);
      await postToThread(ticket.id, `🔺 Priority set to **${a.priority}**`);
      break;
    }
    case 'assign': {
      await assignTicket(ticket.id, a.staffId);
      await logEvent(ticket.id, 'assigned', { staffId: a.staffId }, 'staff', session.staff.id);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
