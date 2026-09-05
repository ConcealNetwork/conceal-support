import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { getTicketByTrackingId, getTicketById, ticketConversation, verifyCustomerChallenge } from '@/lib/tickets/service';
import { TicketConversation, TicketHeader } from '@/components/ticket-view';
import { isValidTrackingId } from '@/lib/guards/tickets';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Ticket ${id.toUpperCase()}` };
}

/**
 * Customer ticket view. Access = a signed magic-link token in the query string
 * (?t=...), or a verified session cookie set by the lookup challenge.
 */
export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; email?: string }>;
}) {
  const { id } = await params;
  const { t: token, email } = await searchParams;
  if (!isValidTrackingId(id)) notFound();

  const ticket = await getTicketByTrackingId(id);
  if (!ticket) notFound();

  let authorized = false;
  if (token) {
    const { verifyCustomerToken } = await import('@/lib/tickets/service');
    const payload = verifyCustomerToken(token);
    authorized = Boolean(payload && payload.trackingId === ticket.trackingId);
  } else if (email) {
    authorized = verifyCustomerChallenge(id, decodeURIComponent(email), ticket);
  } else {
    const jar = await cookies();
    authorized = jar.get(`cs_view_${ticket.id}`)?.value === '1';
  }

  if (!authorized) {
    return (
      <div className="mx-auto w-full max-w-xl px-6 py-24 text-center">
        <p className="eyebrow">Ticket {ticket.trackingId}</p>
        <h1 className="mt-4 text-3xl font-semibold">This ticket is protected</h1>
        <p className="mt-4 text-muted-foreground">
          Confirm your email address to view it. The confirmation email we sent contains a private
          link, or use the{' '}
          <a href={`/lookup?id=${ticket.trackingId}`} className="text-primary underline underline-offset-4">
            ticket lookup
          </a>
          .
        </p>
      </div>
    );
  }

  const full = await getTicketById(ticket.id);
  const conv = await ticketConversation(ticket.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-14">
      <TicketHeader ticket={full!} messageCount={conv.messages.length} />
      <TicketConversation
        ticketId={ticket.id}
        trackingId={ticket.trackingId}
        messages={conv.messages}
        notes={[]}
        attachments={conv.attachments}
      />
    </div>
  );
}
