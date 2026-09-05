import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategory } from '@/lib/tickets/service';
import { env } from '@/lib/env';
import { TicketForm } from '@/components/ticket-form';
import type { FormField } from '@/lib/forms/schema';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const c = await getCategory(category);
  return { title: c ? `New ticket — ${c.name}` : 'New ticket' };
}

export default async function NewCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const c = await getCategory(category);
  if (!c || !c.isPublic) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-14">
      <p className="eyebrow">New ticket · {c.name}</p>
      <h1 className="mt-4 mb-10 text-4xl font-semibold tracking-tight">Submit a support request</h1>
      <TicketForm
        categorySlug={c.slug}
        categoryName={c.name}
        fields={c.formSchema as FormField[]}
        docLinks={c.docLinks as { title: string; href: string }[]}
        turnstileSiteKey={env().TURNSTILE_SITE_KEY}
      />
    </div>
  );
}
