import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HeroMark } from '@/components/brand';
import { listCategories } from '@/lib/tickets/service';
import { networkStatus } from '@/lib/integrations/explorer';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [categories, net] = await Promise.all([listCategories(), networkStatus()]);

  return (
    <div>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pt-20 pb-16 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="max-w-3xl">
          <p className="eyebrow">Conceal Support</p>
          <h1 className="mt-6 text-5xl font-light leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            Stuck on <span className="text-primary font-semibold">something?</span>
            <br />
            We&rsquo;ll <span className="font-bold">sort it.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Get help with wallets, the wCCX bridge, nodes and anything else Conceal. No account
            needed — a tracking ID and your email are all it takes.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/new" className="btn-primary">
              Open a ticket <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/lookup" className="btn-secondary">
              Check an existing ticket →
            </Link>
          </div>
          <p className="mt-6 max-w-lg text-sm text-muted-foreground">
            Security notice: Conceal staff will <strong className="text-foreground">never</strong> ask
            for your seed phrase, private keys or wallet password.{' '}
            <Link href="/security" className="text-primary underline underline-offset-4">
              How to spot scammers
            </Link>
            .
          </p>
        </div>
        <div className="hidden lg:block">
          <HeroMark />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="glass-card p-6">
          <dl className="grid grid-cols-2 gap-6 text-sm sm:grid-cols-4">
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Chain height</dt>
              <dd className="mt-1 font-mono text-xl">{net?.height?.toLocaleString() ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Last block</dt>
              <dd className="mt-1 font-mono text-xl">
                {net?.lastBlockAgeSeconds != null ? `${net.lastBlockAgeSeconds < 120 ? `${net.lastBlockAgeSeconds}s` : `${Math.round(net.lastBlockAgeSeconds / 60)}m`} ago` : '—'}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Docs</dt>
              <dd className="mt-1">
                <a href={env().DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                  conceal-wiki →
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Explorer</dt>
              <dd className="mt-1">
                <a href={env().EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                  explorer →
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="text-2xl font-semibold tracking-tight">What do you need help with?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/new/${c.slug}`}
              className="glass-card group p-6 transition hover:-translate-y-0.5"
            >
              <p className="eyebrow">{c.name}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{c.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open a ticket
                <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
