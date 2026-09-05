import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Link from 'next/link';
import { env } from '@/lib/env';
import './global.css';

export const metadata: Metadata = {
  metadataBase: new URL(env().APP_URL),
  title: { default: 'Conceal Support', template: '%s · Conceal Support' },
  description: 'Official support for Conceal Network — wallets, bridge, nodes and security.',
};

const navLinks = [
  { href: '/new', label: 'Open a ticket' },
  { href: '/lookup', label: 'Check a ticket' },
  { href: '/status', label: 'Status' },
  { href: env().DOCS_URL, label: 'Docs', external: true },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} data-theme="dark">
      <body className="flex min-h-screen flex-col ambient-glow">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <header className="border-b border-border/60">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <Link href="/" className="brand-row" aria-label="Conceal Support home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/conceal-mark.svg" alt="" />
              <span>Conceal Support</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted-foreground">
              {navLinks.map((l) =>
                'external' in l && l.external ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.label} href={l.href} className="hover:text-foreground">
                    {l.label}
                  </Link>
                ),
              )}
              <Link href="/staff" className="btn-secondary !px-4 !py-1.5 text-sm">
                Staff
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border/60 py-10">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {['No account needed', 'Reply by email', 'Staff never ask for keys', 'Self-hosted'].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="inline-block size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {f}
                </li>
              ))}
            </ul>
            <p>
              © {new Date().getFullYear()}{' '}
              <a href="https://conceal.network" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                Conceal Network
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
