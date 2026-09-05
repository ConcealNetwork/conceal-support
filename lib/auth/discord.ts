import { randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { env, integrations } from '@/lib/env';
import { sha256 } from '@/lib/guards/tickets';

const SESSION_COOKIE = 'cs_session';
const OAUTH_STATE_COOKIE = 'cs_oauth_state';
const SESSION_TTL_HOURS = 8;

export type DiscordProfile = {
  discordUserId: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  roleIds: string[];
  isAdmin: boolean;
  isStaff: boolean;
};

export function oauthConfigured(): boolean {
  return integrations().discordOAuth;
}

export function oauthAuthorizeUrl(): string {
  const e = env();
  const params = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID!,
    redirect_uri: `${e.APP_URL}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify email guilds guilds.members.read',
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function setOAuthState(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
}

export async function readOAuthState(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(OAUTH_STATE_COOKIE)?.value ?? null;
}

export async function clearOAuthState(): Promise<void> {
  const jar = await cookies();
  jar.delete(OAUTH_STATE_COOKIE);
}

export async function exchangeCode(code: string): Promise<{ access_token: string } | null> {
  const e = env();
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: e.DISCORD_CLIENT_ID!,
      client_secret: e.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${e.APP_URL}/api/auth/discord/callback`,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  return (await res.json()) as { access_token: string };
}

type DiscordUser = { id: string; username: string; global_name?: string; avatar: string | null; email?: string };

export async function fetchProfile(accessToken: string): Promise<DiscordProfile | null> {
  const e = env();
  const [userRes, memberRes] = await Promise.all([
    fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) }),
    fetch(`https://discord.com/api/users/@me/guilds/${e.DISCORD_GUILD_ID}/member`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null),
  ]);
  if (!userRes.ok) return null;
  const user = (await userRes.json()) as DiscordUser;

  let roleIds: string[] = [];
  if (memberRes?.ok) {
    const member = (await memberRes.json()) as { roles?: string[] };
    roleIds = member.roles ?? [];
  }
  return {
    discordUserId: user.id,
    displayName: user.global_name || user.username,
    avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
    email: user.email ?? null,
    roleIds,
    isAdmin: Boolean(e.DISCORD_ADMIN_ROLE_ID && roleIds.includes(e.DISCORD_ADMIN_ROLE_ID)),
    isStaff: Boolean(e.DISCORD_STAFF_ROLE_ID && roleIds.includes(e.DISCORD_STAFF_ROLE_ID)) || Boolean(e.DISCORD_ADMIN_ROLE_ID && roleIds.includes(e.DISCORD_ADMIN_ROLE_ID)),
  };
}

/** Create a session row and set the cookie. */
export async function createSession(staffId: string, ip?: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const jar = await cookies();
  await db.insert(schema.sessions).values({
    id: sha256(token),
    staffId,
    ip,
    userAgent,
    expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000),
  });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export type CurrentStaff = {
  sessionId: string;
  staff: typeof schema.staff.$inferSelect;
  mfaPassed: boolean;
};

export async function currentStaff(): Promise<CurrentStaff | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ session: schema.sessions, staff: schema.staff })
    .from(schema.sessions)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.sessions.staffId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || !row.staff.isActive) return null;
  return { sessionId: row.session.id, staff: row.staff, mfaPassed: row.session.mfaPassed };
}

/** Sessions awaiting the second factor use a shorter marker; full access needs mfaPassed. */
export async function markMfaPassed(sessionId: string): Promise<void> {
  await db.update(schema.sessions).set({ mfaPassed: true }).where(eq(schema.sessions.id, sessionId));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export function avatarHashFallback(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 8);
}
