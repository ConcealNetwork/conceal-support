import Image from 'next/image';

export function BrandMark({ size = 34 }: { size?: number }) {
  return <Image src="/brand/conceal-mark.svg" alt="" width={size} height={size} />;
}

/** Status dot pill — "● Waiting for you" */
export function StatusPill({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="status-pill" style={{ color: `hsl(var(--${tone}))` }}>
      <span className="dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Keycap({ children }: { children: React.ReactNode }) {
  return <span className="keycap">{children}</span>;
}

/** Thin amber ring + metal mark, used as the hero motif. */
export function HeroMark({ size = 320 }: { size?: number }) {
  return (
    <div aria-hidden="true" className="relative hidden select-none lg:block" style={{ width: size, height: size }}>
      <div className="hero-ring absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/conceal-mark.svg" alt="" className="h-full w-full rounded-full object-contain p-10 opacity-90" />
      </div>
    </div>
  );
}
