import { env, integrations } from '@/lib/env';

/** Fire-and-forget notification to the staff Signal group via signal-cli REST. */
export async function notifySignal(text: string): Promise<boolean> {
  if (!integrations().signal) return false;
  const e = env();
  try {
    const res = await fetch(`${e.SIGNAL_API_URL}/v2/sendgroups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ number: e.SIGNAL_NUMBER, recipients: [e.SIGNAL_GROUP_ID], message: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.error('[signal] notify failed', err);
    return false;
  }
}

export async function notifySignalHighPriority(input: { trackingId: string; subject: string; priority: string; url: string }): Promise<void> {
  if (input.priority !== 'high' && input.priority !== 'critical') return;
  await notifySignal(`🔺 ${input.priority.toUpperCase()} ticket ${input.trackingId}: ${input.subject}\n${input.url}`);
}
