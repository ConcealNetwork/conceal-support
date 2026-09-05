import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="eyebrow">Security</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Real support never asks for your keys</h1>
      <p className="mt-4 leading-8 text-muted-foreground">
        Impersonation scams target crypto users every day. This page explains exactly how legitimate
        Conceal support behaves, so you can spot a fake instantly.
      </p>

      <div className="glass-card mt-8 border-primary/40 p-6">
        <h2 className="text-lg font-semibold">Conceal support will never</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
          <li>• Ask for your 25-word seed phrase, spend key, view key or wallet password — in any channel.</li>
          <li>• Ask you to &ldquo;validate&rdquo;, &ldquo;synchronise&rdquo; or &ldquo;unlock&rdquo; your wallet by entering keys on a website.</li>
          <li>• Request payment to resolve a ticket. Support is free.</li>
          <li>• DM you first. We only reply inside your ticket or to your support email.</li>
          <li>• Rush you. Urgency is the scammer&rsquo;s main tool.</li>
        </ul>
      </div>

      <div className="glass-card mt-4 p-6">
        <h2 className="text-lg font-semibold">How to verify a contact is genuine</h2>
        <ul className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">
          <li>• Open <Link href="/" className="text-primary underline underline-offset-4">conceal.network support</Link> yourself — never click links from unsolicited messages.</li>
          <li>• Only staff replies in your ticket view (with the Conceal mark) or from <span className="font-mono text-xs">@conceal.network</span> addresses are genuine.</li>
          <li>• Our apps and downloads are listed on the official site and GitHub; verify releases before installing.</li>
        </ul>
      </div>

      <div className="glass-card mt-4 p-6">
        <h2 className="text-lg font-semibold">If you shared your seed phrase</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Assume the wallet is compromised. Create a new wallet on a clean device, move remaining
          funds to it, and treat all secrets from the old wallet as burned. Then report the incident
          via a{' '}
          <Link href="/new/chain-security" className="text-primary underline underline-offset-4">
            Chain / Security ticket
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
