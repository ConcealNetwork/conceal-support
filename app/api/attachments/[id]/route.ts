import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { currentStaff } from '@/lib/auth/discord';
import { attachmentDownloadUrl } from '@/lib/integrations/minio';

/** Staff-only attachment download via presigned MinIO URL. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentStaff();
  if (!session || !session.mfaPassed) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const rows = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id)).limit(1);
  const att = rows[0];
  if (!att) return NextResponse.json({ ok: false }, { status: 404 });

  const url = await attachmentDownloadUrl(att.objectKey);
  if (!url) return NextResponse.json({ ok: false, error: 'storage not configured' }, { status: 503 });
  return NextResponse.redirect(url);
}
