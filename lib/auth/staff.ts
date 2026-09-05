import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function findStaffByDiscordId(discordUserId: string) {
  const rows = await db.select().from(schema.staff).where(eq(schema.staff.discordUserId, discordUserId)).limit(1);
  return rows[0] ?? null;
}

export async function findStaffByEmail(email: string) {
  const rows = await db
    .select()
    .from(schema.staff)
    .where(sql`lower(${schema.staff.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Ensure a staff row exists for an authenticated Discord member. Admins are
 * seeded by email; everyone else joins the roster on first Discord login if
 * they hold the staff role (caller checks roles).
 */
export async function ensureStaffFromDiscord(d: { discordUserId: string; displayName: string; avatarUrl: string | null; email: string | null }) {
  const existing = await findStaffByDiscordId(d.discordUserId);
  if (existing) return existing;
  if (!d.email) return null;
  const byEmail = await findStaffByEmail(d.email);
  if (byEmail) {
    const updated = await db
      .update(schema.staff)
      .set({ discordUserId: d.discordUserId, displayName: d.displayName, avatarUrl: d.avatarUrl, updatedAt: sql`now()` })
      .where(eq(schema.staff.id, byEmail.id))
      .returning();
    return updated[0]!;
  }
  const created = await db
    .insert(schema.staff)
    .values({
      email: d.email,
      displayName: d.displayName,
      avatarUrl: d.avatarUrl,
      discordUserId: d.discordUserId,
      role: 'agent',
    })
    .returning();
  return created[0]!;
}

/** Deactivate staff who lost the Discord role (nightly job). */
export async function syncRoster(activeDiscordIds: string[]) {
  const rows = await db.select().from(schema.staff).where(eq(schema.staff.isActive, true));
  const active = new Set(activeDiscordIds);
  for (const s of rows) {
    if (s.discordUserId && !active.has(s.discordUserId)) {
      await db.update(schema.staff).set({ isActive: false, updatedAt: sql`now()` }).where(eq(schema.staff.id, s.id));
    }
  }
}
