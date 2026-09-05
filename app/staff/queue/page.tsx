import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { currentStaff } from '@/lib/auth/discord';
import { StatusPill } from '@/components/brand';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Queue' };

const OPEN_STATUSES = ['new', 'open', 'waiting_customer', 'waiting_staff', 'on_hold'] as const;

const VIEWS = {
  mine: (staffId: string) => and(inArray(schema.tickets.status, [...OPEN_STATUSES]), eq(schema.tickets.assigneeId, staffId)),
  unassigned: () => and(inArray(schema.tickets.status, [...OPEN_STATUSES]), isNull(schema.tickets.assigneeId)),
  waiting: () => inArray(schema.tickets.status, ['waiting_staff', 'new']),
  all: () => inArray(schema.tickets.status, [...OPEN_STATUSES]),
} as const;

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await currentStaff();
  if (!session) redirect('/staff');
  const { view } = await searchParams;
  const v = (view && view in VIEWS ? view : 'unassigned') as keyof typeof VIEWS;

  const where = v === 'mine' ? VIEWS.mine(session.staff.id) : VIEWS[v]();
  const rows = await db
    .select({
      id: schema.tickets.id,
      trackingId: schema.tickets.trackingId,
      subject: schema.tickets.subject,
      status: schema.tickets.status,
      priority: schema.tickets.priority,
      updatedAt: schema.tickets.updatedAt,
      isConfidential: schema.tickets.isConfidential,
      assigneeId: schema.tickets.assigneeId,
    })
    .from(schema.tickets)
    .where(where)
    .orderBy(desc(schema.tickets.updatedAt))
    .limit(100);

  const counts = await db
    .select({ status: schema.tickets.status, count: sql<number>`count(*)::int` })
    .from(schema.tickets)
    .groupBy(schema.tickets.status);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Queue</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Support tickets</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="btn-secondary text-sm">
            Sign out
          </button>
        </form>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        {(['unassigned', 'mine', 'waiting', 'all'] as const).map((key) => (
          <Link
            key={key}
            href={`/staff/queue?view=${key}`}
            className={`rounded-full border px-4 py-1.5 ${
              v === key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {key === 'mine' ? 'Mine' : key === 'unassigned' ? 'Unassigned' : key === 'waiting' ? 'Waiting on staff' : 'All open'}
          </Link>
        ))}
        {counts.map((c) => (
          <span key={c.status} className="rounded-full border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">
            {c.status.replaceAll('_', ' ')}: {c.count}
          </span>
        ))}
      </nav>

      <div className="mt-6 overflow-hidden rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-chrome text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border/60 hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <Link href={`/staff/ticket/${t.id}`} className="flex items-center gap-2">
                    {t.isConfidential && <span title="Confidential">🔒</span>}
                    <span className="font-mono text-xs text-muted-foreground">{t.trackingId}</span>
                    <span className="font-medium">{t.subject}</span>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="font-mono text-xs"
                    style={{ color: t.priority === 'critical' ? 'hsl(var(--severity-critical))' : t.priority === 'high' ? 'hsl(var(--status-waiting))' : undefined }}
                  >
                    {t.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill
                    tone={t.status === 'resolved' ? 'status-resolved' : t.status === 'new' || t.status === 'waiting_staff' ? 'status-new' : 'status-waiting'}
                    label={t.status.replaceAll('_', ' ')}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}Z</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Nothing here. Queue is clear.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
