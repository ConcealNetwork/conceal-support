import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { env, integrations } from '@/lib/env';
import {
  exchangeCode,
  fetchProfile,
  createSession,
  readOAuthState,
  clearOAuthState,
  setOAuthState,
} from '@/lib/auth/discord';
import { ensureStaffFromDiscord } from '@/lib/auth/staff';

/** Start OAuth. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (!integrations().discordOAuth) {
    return NextResponse.redirect(new URL('/staff?error=discord-not-configured', url.origin));
  }
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    const generated = randomBytes(16).toString('hex');
    await setOAuthState(generated);
    const params = new URLSearchParams({
      client_id: env().DISCORD_CLIENT_ID!,
      redirect_uri: `${env().APP_URL}/api/auth/discord/callback`,
      response_type: 'code',
      scope: 'identify email guilds.members.read',
      state: generated,
      prompt: 'consent',
    });
    return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`);
  }

  const expected = await readOAuthState();
  await clearOAuthState();
  if (!state || state !== expected) {
    return NextResponse.redirect(new URL('/staff?error=state-mismatch', url.origin));
  }

  const token = await exchangeCode(code);
  if (!token) return NextResponse.redirect(new URL('/staff?error=token-exchange', url.origin));

  const profile = await fetchProfile(token.access_token);
  if (!profile || !profile.isStaff) {
    return NextResponse.redirect(new URL('/staff?error=not-staff', url.origin));
  }

  const staff = await ensureStaffFromDiscord({
    discordUserId: profile.discordUserId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    email: profile.email,
  });
  if (!staff) return NextResponse.redirect(new URL('/staff?error=no-staff-profile', url.origin));

  const role = profile.isAdmin ? 'admin' : staff.role;
  if (role !== staff.role) {
    const { db, schema } = await import('@/lib/db');
    const { eq } = await import('drizzle-orm');
    await db.update(schema.staff).set({ role }).where(eq(schema.staff.id, staff.id));
  }

  await createSession(staff.id, req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), req.headers.get('user-agent') ?? undefined);
  return NextResponse.redirect(new URL('/staff/queue', url.origin));
}
