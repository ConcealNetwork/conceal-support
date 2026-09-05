import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../lib/db/index.ts';
import { categorySeeds } from '../content/categories.ts';

for (const c of categorySeeds) {
  await db
    .insert(schema.categories)
    .values({
      slug: c.slug,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      defaultPriority: c.defaultPriority,
      formSchema: c.formSchema,
      docLinks: c.docLinks,
    })
    .onConflictDoUpdate({
      target: schema.categories.slug,
      set: {
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        defaultPriority: c.defaultPriority,
        formSchema: c.formSchema,
        docLinks: c.docLinks,
        updatedAt: sql`now()`,
      },
    });
  console.log(`category: ${c.slug}`);
}

const canned = [
  {
    title: 'Ask for basics',
    bodyMd:
      'Hi {{name}},\n\nThanks for reaching out. To look into this we need a little more detail:\n\n- Wallet and version\n- Operating system\n- The exact error text (if any)\n- Your current wallet block height vs the explorer height\n\nPlease never send your seed phrase, private keys or wallet password.\n\nTicket: {{tracking_id}}',
  },
  {
    title: 'Sync guidance',
    bodyMd:
      'Hi {{name}},\n\nA wallet that is behind the network can show an incomplete balance. Please compare your wallet height with https://explorer.conceal.network/ and leave the wallet open until it catches up. If it stops advancing, note the height it stops at and reply here.\n\nGuide: https://concealnetwork.github.io/conceal-wiki/docs/troubleshooting/',
  },
  {
    title: 'Resolved – closing',
    bodyMd: 'Glad that is sorted, {{name}}. I am marking this ticket resolved; reply to this email if anything else comes up.',
  },
];
for (const r of canned) {
  const existing = await db.select({ id: schema.cannedReplies.id }).from(schema.cannedReplies).where(eq(schema.cannedReplies.title, r.title));
  if (existing.length === 0) await db.insert(schema.cannedReplies).values(r);
}

const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
if (adminEmail) {
  const existing = await db.select({ id: schema.staff.id }).from(schema.staff).where(sql`lower(${schema.staff.email}) = lower(${adminEmail})`);
  if (existing.length === 0) {
    await db.insert(schema.staff).values({ email: adminEmail, displayName: adminEmail.split('@')[0], role: 'admin' });
    console.log(`admin created: ${adminEmail}`);
  }
}

console.log('seed complete');
process.exit(0);
