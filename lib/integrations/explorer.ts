import { env } from '@/lib/env';

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  try {
    const data = await fn();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return (hit?.data as T) ?? null;
  }
}

export type NetworkStatus = {
  height: number | null;
  lastBlockAgeSeconds: number | null;
  hashrate: string | null;
  transactionsCount: number | null;
};

/**
 * Best-effort snapshot from the public explorer daemon API. Returns nulls when
 * unreachable — the status widget must degrade, never break the page.
 */
export async function networkStatus(): Promise<NetworkStatus | null> {
  const e = env();
  return cached('network', async () => {
    const res = await fetch(`${e.EXPLORER_API_URL}/getinfo`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`explorer ${res.status}`);
    const j = (await res.json()) as Record<string, unknown>;
    const height = Number(j['block_count'] ?? j['height'] ?? 0) || null;
    const lastTs = Number(j['last_block_timestamp'] ?? j['timestamp'] ?? 0);
    return {
      height,
      lastBlockAgeSeconds: lastTs ? Math.max(0, Math.round((Date.now() / 1000 - lastTs))) : null,
      hashrate: (j['hashrate'] as string) ?? null,
      transactionsCount: Number(j['transactions_count'] ?? 0) || null,
    };
  });
}

export async function transaction(hash: string): Promise<Record<string, unknown> | null> {
  const e = env();
  return cached(`tx:${hash}`, async () => {
    const res = await fetch(`${e.EXPLORER_API_URL}/transaction?hash=${encodeURIComponent(hash)}`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  });
}

export function explorerTxUrl(hash: string): string {
  return `${env().EXPLORER_URL}/?hash=${encodeURIComponent(hash)}#blockchain_transaction`;
}
