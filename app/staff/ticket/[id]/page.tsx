import { notFound, redirect } from 'next/navigation';
import { db, schema } from '@/lib/db';
import { getTicketById, ticketConversation } from '@/lib/tickets/service';
import { currentStaff } from '@/lib/auth/discord';
import { StaffTicketView } from '@/components/staff-ticket-view';
import type { FormField } from '@/lib/forms/schema';

export const dynamic = 'force-dynamic';

export default async function StaffTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await currentStaff();
  if (!session) redirect('/staff');
  if (!session.mfaPassed) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-24 text-center">
        <p className="eyebrow">Second factor required</p>
        <h1 className="mt-4 text-2xl font-semibold">Confirm your identity</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Passkey / TOTP enrolment flow goes here. Until configured, an administrator can mark your
          session verified from the staff settings page.
        </p>
      </div>
    );
  }

  const { id } = await params;
  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  const conv = await ticketConversation(ticket.id);
  const canned = await db.select().from(schema.cannedReplies);

  return (
    <StaffTicketView
      ticket={ticket}
      messages={conv.messages}
      notes={conv.notes}
      events={conv.events}
      attachments={conv.attachments}
      fieldsSchema={[] as FormField[]}
      canned={canned}
      staffId={session.staff.id}
      staffName={session.staff.displayName}
    />
  );
}
