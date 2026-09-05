import type { Metadata } from 'next';
import { LookupForm } from '@/components/lookup-form';

export const metadata = { title: 'Check a ticket' };

export default async function LookupPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-xl px-6 py-20">
      <p className="eyebrow">Ticket lookup</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Check an existing ticket</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter the tracking ID from your confirmation email together with the email address you used.
      </p>
      <div className="mt-8">
        <LookupForm initialId={id ?? ''} />
      </div>
    </div>
  );
}
