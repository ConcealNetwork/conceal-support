'use client';

import { useState } from 'react';

export function LookupForm({ initialId }: { initialId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/tickets/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trackingId: fd.get('trackingId'), email: fd.get('email') }),
    });
    const j = (await res.json()) as { ok: boolean; error?: string; redirect?: string };
    setBusy(false);
    if (j.ok && j.redirect) {
      window.location.href = j.redirect;
    } else {
      setError(j.error ?? 'Those details did not match a ticket.');
    }
  }

  async function remind(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const form = (e.currentTarget.closest('form') as HTMLFormElement) ?? null;
    const fd = new FormData(form);
    setBusy(true);
    const res = await fetch('/api/tickets/lookup', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: fd.get('email') }),
    });
    const j = (await res.json()) as { ok: boolean };
    setBusy(false);
    if (j.ok) setSent(true);
    else setError('Could not send the reminder — check the email address.');
  }

  return (
    <form onSubmit={onSubmit} className="glass-card space-y-5 p-6">
      <div>
        <label className="field-label" htmlFor="trackingId">
          Tracking ID
        </label>
        <input id="trackingId" name="trackingId" required placeholder="CCX-XXXX-XXXX" defaultValue={initialId} className="field-input font-mono uppercase" />
      </div>
      <div>
        <label className="field-label" htmlFor="email">
          Email address
        </label>
        <input id="email" name="email" type="email" required className="field-input" />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {sent && <p className="text-sm text-[hsl(var(--status-resolved))]">Reminder sent — check your inbox.</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
        {busy ? 'Checking…' : 'View ticket'}
      </button>
      <p className="text-center text-sm text-muted-foreground">
        Lost the tracking ID?{' '}
        <button type="button" onClick={remind} className="text-primary underline underline-offset-4" disabled={busy}>
          Email me my ticket IDs
        </button>
      </p>
    </form>
  );
}
