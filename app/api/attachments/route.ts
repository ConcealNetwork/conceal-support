import { NextResponse, type NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { getTicketByTrackingId, verifyCustomerChallenge } from '@/lib/tickets/service';
import { putAttachment } from '@/lib/integrations/minio';

const MAX_FILES = 3;

/** Customer attachment upload — gated by tracking ID + email, like the ticket itself. */
export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const trackingId = String(fd.get('trackingId') ?? '');
  const email = String(fd.get('email') ?? '');
  const files = fd.getAll('files').filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  if (files.length === 0) return NextResponse.json({ ok: false, error: 'No files.' }, { status: 400 });

  const ticket = await getTicketByTrackingId(trackingId);
  if (!ticket || !verifyCustomerChallenge(trackingId, email, ticket)) {
    return NextResponse.json({ ok: false, error: 'Not authorized.' }, { status: 403 });
  }

  const uploaded: string[] = [];
  const failed: string[] = [];
  for (const f of files) {
    const bytes = Buffer.from(await f.arrayBuffer());
    const res = await putAttachment({
      ticketId: ticket.id,
      filename: f.name || 'attachment',
      mime: f.type || 'application/octet-stream',
      bytes,
    });
    if (res.ok) {
      await db.insert(schema.attachments).values({
        ticketId: ticket.id,
        objectKey: res.objectKey,
        filename: f.name || 'attachment',
        mime: f.type || 'application/octet-stream',
        size: res.size,
        sha256: res.sha256,
      });
      uploaded.push(f.name);
    } else {
      failed.push(`${f.name}: ${res.error}`);
    }
  }
  return NextResponse.json({ ok: failed.length === 0, uploaded, failed });
}
