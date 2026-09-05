import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { listCategories } from '@/lib/tickets/service';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Open a ticket' };

export default async function NewTicketPage() {
  const categories = await listCategories();
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <p className="eyebrow">New ticket</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">What can we help you with?</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <Link key={c.id} href={`/new/${c.slug}`} className="glass-card group p-6 transition hover:-translate-y-0.5">
            <p className="eyebrow">{c.name}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{c.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Continue <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
