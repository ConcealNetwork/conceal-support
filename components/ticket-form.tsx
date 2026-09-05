'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { FormField } from '@/lib/forms/schema';

type Props = {
  categorySlug: string;
  categoryName: string;
  fields: FormField[];
  docLinks: { title: string; href: string }[];
  turnstileSiteKey?: string;
  priorityLocked?: boolean;
};

type Phase = 'idle' | 'submitting' | 'done' | 'error';

export function TicketForm(props: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [guard, setGuard] = useState<{ level: string; message: string } | null>(null);
  const [result, setResult] = useState<{ trackingId: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhase('submitting');
    setErrors({});
    setGuard(null);

    let turnstileToken: string | undefined;
    if (props.turnstileSiteKey) {
      turnstileToken = await getTurnstileToken();
      if (!turnstileToken) {
        setPhase('error');
        setErrors({ form: 'Captcha could not be completed. Please retry.' });
        return;
      }
    }

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      categorySlug: props.categorySlug,
      name: fd.get('name'),
      email: fd.get('email'),
      subject: fd.get('subject'),
      priority: fd.get('priority') ?? undefined,
      message,
      fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v])),
      turnstileToken,
    };

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = (await res.json()) as
      | { ok: true; trackingId: string }
      | { ok: false; errors: Record<string, string>; guard?: { level: string; message: string } };

    if (j.ok) {
      // Upload attachments (if any) against the freshly created ticket.
      const files = (fd.get('attachments') as FileList | null) ?? null;
      if (files && files.length > 0) {
        const fd2 = new FormData();
        fd2.set('trackingId', j.trackingId);
        fd2.set('email', String(fd.get('email') ?? ''));
        for (const f of Array.from(files).slice(0, 3)) fd2.append('files', f);
        await fetch('/api/attachments', { method: 'POST', body: fd2 }).catch(() => undefined);
      }
      setResult({ trackingId: j.trackingId });
      setPhase('done');
    } else {
      setErrors(j.errors);
      if (j.guard) setGuard(j.guard);
      setPhase('error');
    }
  }

  function checkMessage(text: string) {
    setMessage(text);
    // Import of the guard module is server-safe; do a lightweight client check.
    // Full validation happens server-side either way.
    if (!text) return setGuard(null);
    import('@/lib/guards/sensitive').then(({ checkSensitive }) => {
      const v = checkSensitive(text);
      setGuard(v.level === 'ok' ? null : { level: v.level, message: v.message! });
    });
  }

  if (phase === 'done' && result) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="eyebrow">Ticket created</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight">Keep this ID</h2>
        <p className="mt-6">
          <span className="keycap text-lg">{result.trackingId}</span>
        </p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          We emailed you a confirmation with a private link to the ticket. Keep the tracking ID —
          you&rsquo;ll need it with your email address to view the ticket again.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href={`/ticket/${result.trackingId}`} className="btn-primary">
            View ticket
          </a>
          <Link href="/" className="btn-secondary">
            Back to support home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]" noValidate={false}>
      <div className="space-y-5">
        {errors['form'] && <FormError>{errors['form']}</FormError>}

        <div className="glass-card space-y-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" name="name" required error={errors['name']} />
            <Field label="Email" name="email" type="email" required error={errors['email']} help="We send updates here. It also unlocks the ticket." />
          </div>
          <Field label="Subject" name="subject" required maxLength={120} error={errors['subject']} />

          {!props.priorityLocked && (
            <div>
              <label className="field-label" htmlFor="priority">
                Priority
              </label>
              <select id="priority" name="priority" className="field-select" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}
        </div>

        <div className="glass-card space-y-5 p-6">
          <p className="eyebrow">{props.categoryName} details</p>
          {props.fields.map((f) => (
            <DynamicField key={f.id} field={f} value={values[f.id]} onChange={(v) => setValues((s) => ({ ...s, [f.id]: v }))} error={errors[`field_${f.id}`]} />
          ))}
        </div>

        <div className="glass-card space-y-3 p-6">
          <label className="field-label" htmlFor="message">
            What happened? <span className="text-primary">*</span>
          </label>
          <SecurityNotice />
          {guard && (
            <div
              role={guard.level === 'block' ? 'alert' : 'status'}
              className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                guard.level === 'block'
                  ? 'border-destructive/60 bg-destructive/10 text-red-300'
                  : 'border-primary/40 bg-primary/10 text-foreground'
              }`}
            >
              {guard.level === 'block' ? <ShieldAlert size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0 text-primary" />}
              <span>{guard.message}</span>
            </div>
          )}
          <textarea
            id="message"
            className="field-textarea"
            required
            value={message}
            onChange={(e) => checkMessage(e.target.value)}
            placeholder="Describe what you did, what you expected, and what happened instead. Include versions and exact error text."
          />
          {errors['message'] && <FormError>{errors['message']}</FormError>}

          <div>
            <label className="field-label" htmlFor="attachments">
              Attachments <span className="font-normal text-muted-foreground">(optional, up to 3 files, 10 MB each)</span>
            </label>
            <input id="attachments" name="attachments" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.log,.json,.csv,.pdf,.zip,.gz,.yml,.yaml,.md" className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium" />
          </div>
        </div>

        {props.turnstileSiteKey && (
          <div className="cf-turnstile" data-sitekey={props.turnstileSiteKey} data-theme="dark" />
        )}

        <button type="submit" className="btn-primary disabled:opacity-50" disabled={phase === 'submitting' || guard?.level === 'block'}>
          {phase === 'submitting' ? 'Submitting…' : 'Submit ticket'}
        </button>
      </div>

      <aside className="space-y-4">
        <div className="glass-card p-5">
          <p className="eyebrow">Before you post</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Check the pinned guides — most sync and balance questions are answered there.</li>
            <li>• Never share seed phrases, keys or passwords.</li>
            <li>• Transaction hashes are safe to share.</li>
          </ul>
        </div>
        <div className="glass-card p-5">
          <p className="eyebrow">Guides</p>
          <ul className="mt-3 space-y-2 text-sm">
            {props.docLinks.map((d) => (
              <li key={d.href}>
                <a href={d.href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                  {d.title} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </form>
  );
}

function SecurityNotice() {
  return (
    <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm leading-6">
      Conceal staff will never ask for your seed phrase, private keys or wallet password. Messages
      containing a 25-word seed phrase are blocked automatically.
    </p>
  );
}

function Field({ label, name, type = 'text', required, error, help, maxLength }: { label: string; name: string; type?: string; required?: boolean; error?: string; help?: string; maxLength?: number }) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label} {required && <span className="text-primary">*</span>}
      </label>
      <input id={name} name={name} type={type} required={required} maxLength={maxLength} className="field-input" />
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
      {error && <FormError>{error}</FormError>}
    </div>
  );
}

function DynamicField({ field, value, onChange, error }: { field: FormField; value: string | boolean | undefined; onChange: (v: string | boolean) => void; error?: string }) {
  const id = `field_${field.id}`;
  if (field.type === 'select') {
    return (
      <div>
        <label className="field-label" htmlFor={id}>
          {field.label} {field.required && <span className="text-primary">*</span>}
        </label>
        <select id={id} className="field-select" required={field.required} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            Choose…
          </option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
        {error && <FormError>{error}</FormError>}
      </div>
    );
  }
  if (field.type === 'textarea') {
    return (
      <div>
        <label className="field-label" htmlFor={id}>
          {field.label} {field.required && <span className="text-primary">*</span>}
        </label>
        <textarea id={id} className="field-textarea !min-h-32" maxLength={field.maxLength} required={field.required} placeholder={field.placeholder} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
        {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
        {error && <FormError>{error}</FormError>}
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" className="mt-1 size-4 accent-[hsl(var(--primary))]" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <div>
          <label htmlFor={id} className="text-sm font-medium">
            {field.label}
          </label>
          {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
          {error && <FormError>{error}</FormError>}
        </div>
      </div>
    );
  }
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {field.label} {field.required && <span className="text-primary">*</span>}
      </label>
      <input id={id} className="field-input font-mono" maxLength={field.maxLength} required={field.required} placeholder={field.placeholder} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />
      {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
      {error && <FormError>{error}</FormError>}
    </div>
  );
}

function FormError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-red-400">{children}</p>;
}

async function getTurnstileToken(): Promise<string | undefined> {
  const w = window as unknown as { turnstile?: { getResponse: () => string } };
  if (!w.turnstile) {
    // widget script may not have loaded — wait briefly
    await new Promise((r) => setTimeout(r, 1500));
  }
  return w.turnstile?.getResponse() || undefined;
}
