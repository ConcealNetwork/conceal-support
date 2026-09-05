import Link from 'next/link';
import { currentStaff, oauthConfigured } from '@/lib/auth/discord';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Staff sign-in' };

const ERRORS: Record<string, string> = {
  'discord-not-configured': 'Discord sign-in is not configured on this deployment yet (missing DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET).',
  'state-mismatch': 'Sign-in could not be verified (state mismatch). Try again.',
  'token-exchange': 'Discord rejected the sign-in. Try again.',
  'not-staff': 'Your Discord account does not hold the Conceal support staff role.',
  'no-staff-profile': 'Your Discord account is not linked to a staff profile. Ask an administrator to seed your email.',
};

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const staff = await currentStaff();

  return (
    <div className="mx-auto grid min-h-[60vh] w-full max-w-md place-items-center px-6">
      <div className="glass-card w-full p-8 text-center">
        <p className="eyebrow">Conceal Support</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Staff console</h1>
        {error && <p className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-red-300">{ERRORS[error] ?? error}</p>}
        {staff ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Signed in as <strong className="text-foreground">{staff.staff.displayName}</strong>
              {staff.mfaPassed ? '' : ' — pending second factor'}
            </p>
            <Link href="/staff/queue" className="btn-primary w-full justify-center">
              Go to the queue
            </Link>
          </div>
        ) : oauthConfigured() ? (
          <div className="mt-6">
            <a href="/api/auth/discord/callback" className="btn-primary w-full justify-center">
              Sign in with Discord
            </a>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Access requires the support-staff role in the Conceal Discord server. A second factor
              (passkey or TOTP) is required before taking actions.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Discord OAuth is not configured. Set <span className="font-mono">DISCORD_CLIENT_ID</span>,{' '}
            <span className="font-mono">DISCORD_CLIENT_SECRET</span> and{' '}
            <span className="font-mono">DISCORD_GUILD_ID</span> in the environment, then restart.
          </p>
        )}
      </div>
    </div>
  );
}
