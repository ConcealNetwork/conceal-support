import { StatusPill } from '@/components/brand';
import type { Message, Ticket } from '@/lib/db/schema';

const STATUS_LABELS: Record<string, { tone: string; label: string }> = {
  new: { tone: 'status-new', label: 'New' },
  open: { tone: 'status-waiting', label: 'In progress' },
  waiting_customer: { tone: 'status-waiting', label: 'Waiting for you' },
  waiting_staff: { tone: 'status-new', label: 'Waiting for staff' },
  on_hold: { tone: 'status-hold', label: 'On hold' },
  resolved: { tone: 'status-resolved', label: 'Resolved' },
  closed: { tone: 'status-hold', label: 'Closed' },
};

export function TicketHeader({ ticket, messageCount }: { ticket: Ticket; messageCount: number }) {
  const s = STATUS_LABELS[ticket.status] ?? { tone: 'status-hold', label: ticket.status };
  return (
    <div className="glass-card mb-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">{ticket.isConfidential ? 'Confidential ticket' : 'Support ticket'}</p>
        <StatusPill tone={s.tone} label={s.label} />
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
        <span>
          ID <span className="keycap">{ticket.trackingId}</span>
        </span>
        <span>priority {ticket.priority}</span>
        <span>{messageCount} messages</span>
        <span>opened {ticket.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
      {Object.keys((ticket.fields as Record<string, unknown>) ?? {}).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(ticket.fields as Record<string, string | boolean>)
            .filter(([, v]) => v !== '' && v !== false)
            .map(([k, v]) => (
              <span key={k} className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {k}: {String(v).slice(0, 24)}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

type CustomerMessage = Pick<Message, 'id' | 'authorType' | 'authorName' | 'bodyHtml' | 'bodyMd' | 'createdAt' | 'via'>;

export function TicketConversation({
  messages,
  attachments,
}: {
  ticketId: string;
  trackingId: string;
  messages: CustomerMessage[];
  notes: unknown[];
  attachments: unknown[];
}) {
  void attachments;
  return (
    <div className="space-y-4">
      {messages.map((m) => (
        <article
          key={m.id}
          className={`glass-card p-5 ${m.authorType === 'staff' ? 'border-primary/40' : ''}`}
        >
          <header className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            {m.authorType === 'staff' && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/conceal-mark.svg" alt="" className="size-5" />
            )}
            <strong>{m.authorType === 'staff' ? `${m.authorName} · Conceal Support` : m.authorName}</strong>
            <time className="font-mono text-xs text-muted-foreground">{m.createdAt.toISOString().replace('T', ' ').slice(0, 16)} UTC</time>
            {m.via !== 'web' && <span className="font-mono text-xs text-muted-foreground">via {m.via}</span>}
          </header>
          <div className="prose-ticket text-[0.95rem]" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
        </article>
      ))}
    </div>
  );
}
