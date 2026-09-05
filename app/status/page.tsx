import type { Metadata } from 'next';
import { networkStatus } from '@/lib/integrations/explorer';
import { env } from '@/lib/env';
import { db, schema } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { StatusPill } from '@/components/brand';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Status' };

export default async function StatusPage() {
  const [net, open] = await Promise.all([
    networkStatus(),
    db
      .select({ status: schema.tickets.status, count: sql<number>`count(*)::int` })
      .from(schema.tickets)
      .groupBy(schema.tickets.status),
  ]);
  const openCount = open.filter((r) => !['resolved', 'closed'].includes(r.status)).reduce((a, r) => a + r.count, 0);
  const chainOk = net?.lastBlockAgeSeconds == null || net.lastBlockAgeSeconds < 3600;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="eyebrow">Status</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Network and support status</h1>

      <div className="mt-8 space-y-4">
        <div className="glass-card flex items-center justify-between p-5">
          <div>
            <p className="font-medium">Conceal blockchain</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              height {net?.height?.toLocaleString() ?? 'unknown'} · last block{' '}
              {net?.lastBlockAgeSeconds != null ? `${net.lastBlockAgeSeconds}s ago` : 'unknown'}
            </p>
          </div>
          <StatusPill tone={chainOk ? 'status-resolved' : 'status-waiting'} label={chainOk ? 'Operational' : 'Check explorer'} />
        </div>

        <div className="glass-card flex items-center justify-between p-5">
          <div>
            <p className="font-medium">wCCX Bridge</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              <a href={env().BRIDGE_URL} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">
                bridge.conceal.network ↗
              </a>
            </p>
          </div>
          <StatusPill tone="status-resolved" label="See bridge site" />
        </div>

        <div className="glass-card flex items-center justify-between p-5">
          <div>
            <p className="font-medium">Support queue</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{openCount} open tickets</p>
          </div>
          <StatusPill tone="status-resolved" label="Online" />
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        Live chain data is fetched from the public explorer every 60 seconds. If the blockchain shows
        a stale block, check the{' '}
        <a href={env().EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
          explorer
        </a>{' '}
        before opening a ticket.
      </p>
    </div>
  );
}
