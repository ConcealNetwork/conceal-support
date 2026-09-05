'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusPill, Keycap } from '@/components/brand';
import type { Attachment, Message, Note, Ticket, TicketEvent } from '@/lib/db/schema';

type Canned = { id: string; title: string; bodyMd: string };

const STATUSES = ['open', 'waiting_customer', 'waiting_staff', 'on_hold', 'resolved', 'closed'] as const;

export function StaffTicketView({
  ticket,
  messages,
  notes,
  events,
  attachments,
  staffId,
  staffName,
  canned,
}: {
  ticket: Ticket;
  messages: Message[];
  notes: Note[];
  events: TicketEvent[];
  attachments: Attachment[];
  fieldsSchema: unknown;
  staffId: string;
  staffName: string;
  canned: Canned[];
}) {
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setFlash(null);
    const res = await fetch(`/api/staff/tickets/${ticket.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const j = (await res.json()) as { ok: boolean; error?: string };
    setBusy(false);
    if (j.ok) {
      setFlash(`${action} done`);
      if (action === 'reply') setReply('');
      if (action === 'note') setNote('');
      window.location.reload();
    } else {
      setFlash(j.error ?? `${action} failed`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/staff/queue" className="text-sm text-muted-foreground hover:text-foreground">
        ← Queue
      </Link>

      <div className="glass-card mt-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">{ticket.isConfidential ? '🔒 Confidential' : 'Ticket'}</p>
          <div className="flex items-center gap-2">
            <Keycap>{ticket.trackingId}</Keycap>
            <StatusPill
              tone={ticket.status === 'resolved' ? 'status-resolved' : 'status-waiting'}
              label={ticket.status.replaceAll('_', ' ')}
            />
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>{ticket.requesterName}</span>
          <span>{ticket.requesterEmail}</span>
          <span>priority {ticket.priority}</span>
          <span>source {ticket.source}</span>
          {ticket.discordThreadId && <span>discord thread linked</span>}
        </div>
        {Object.keys((ticket.fields as Record<string, unknown>) ?? {}).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(ticket.fields as Record<string, string | boolean>)
              .filter(([, v]) => v !== '' && v !== false)
              .map(([k, v]) => (
                <span key={k} className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {k}: {String(v).slice(0, 40)}
                </span>
              ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          {messages.map((m) => (
            <article key={m.id} className={`glass-card p-5 ${m.authorType === 'staff' ? 'border-primary/40' : ''}`}>
              <header className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                {m.authorType === 'staff' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/brand/conceal-mark.svg" alt="" className="size-5" />
                )}
                <strong>{m.authorType === 'staff' ? `${m.authorName} · staff` : m.authorName}</strong>
                <time className="font-mono text-xs text-muted-foreground">{m.createdAt.toISOString().slice(0, 16).replace('T', ' ')}Z</time>
                <span className="font-mono text-xs text-muted-foreground">via {m.via}</span>
              </header>
              <div className="prose-ticket text-[0.95rem]" dangerouslySetInnerHTML={{ __html: m.bodyHtml }} />
            </article>
          ))}

          <div className="glass-card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Reply</p>
              <div className="flex flex-wrap gap-1">
                {canned.slice(0, 4).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setReply(
                        c.bodyMd
                          .replaceAll('{{name}}', ticket.requesterName.split(' ')[0] ?? 'there')
                          .replaceAll('{{tracking_id}}', ticket.trackingId),
                      )
                    }
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
            <textarea className="field-textarea !min-h-36" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply — the customer will see it. Markdown supported." />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-sm" disabled={busy || !reply.trim()} onClick={() => act('reply', { bodyMd: reply })}>
                Send reply
              </button>
              <button type="button" className="btn-secondary text-sm" disabled={busy || !reply.trim()} onClick={() => act('reply', { bodyMd: reply, status: 'resolved' })}>
                Send &amp; resolve
              </button>
              <button type="button" className="btn-secondary text-sm" disabled={busy || !note.trim()} onClick={() => act('note', { bodyMd: note })}>
                Add internal note
              </button>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">Internal note (never shown to the customer)</summary>
              <textarea className="field-textarea mt-2 !min-h-24" value={note} onChange={(e) => setNote(e.target.value)} />
            </details>
            {flash && <p className="text-sm text-primary">{flash}</p>}
          </div>

          {notes.length > 0 && (
            <div className="glass-card space-y-3 p-5">
              <p className="eyebrow">Notes</p>
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="font-mono text-xs text-muted-foreground">
                    {n.authorName} · {n.createdAt.toISOString().slice(0, 16).replace('T', ' ')}Z
                  </p>
                  <div className="prose-ticket mt-1" dangerouslySetInnerHTML={{ __html: n.bodyHtml }} />
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass-card space-y-3 p-5 text-sm">
            <p className="eyebrow">Actions</p>
            <div>
              <label className="field-label text-xs" htmlFor="status">
                Status
              </label>
              <select id="status" className="field-select" value={ticket.status} disabled={busy} onChange={(e) => act('status', { status: e.target.value })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label text-xs" htmlFor="priority">
                Priority
              </label>
              <select id="priority" className="field-select" value={ticket.priority} disabled={busy} onChange={(e) => act('priority', { priority: e.target.value })}>
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-secondary w-full justify-center text-sm" disabled={busy} onClick={() => act('assign', { staffId })}>
              Assign to me ({staffName.split(' ')[0]})
            </button>
          </div>

          <div className="glass-card p-5">
            <p className="eyebrow">Timeline</p>
            <ul className="mt-3 space-y-2 font-mono text-xs text-muted-foreground">
              {events.map((e) => (
                <li key={e.id}>
                  {e.createdAt.toISOString().slice(5, 16).replace('T', ' ')} — {e.type}
                </li>
              ))}
              {events.length === 0 && <li>no events</li>}
            </ul>
          </div>

          <div className="glass-card p-5">
            <p className="eyebrow">Attachments</p>
            {attachments.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">None</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/attachments/${a.id}`} className="font-mono text-xs text-primary hover:underline underline-offset-4">
                      📎 {a.filename}
                    </a>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{Math.ceil(a.size / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Stored in MinIO; presigned 15-minute links.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
