import { Client } from 'minio';
import { env, integrations } from '@/lib/env';

let client: Client | null = null;

export function minioClient(): Client | null {
  if (!integrations().minio) return null;
  if (!client) {
    const e = env();
    client = new Client({
      endPoint: e.MINIO_ENDPOINT!,
      port: e.MINIO_PORT,
      useSSL: e.MINIO_USE_SSL,
      accessKey: e.MINIO_ACCESS_KEY!,
      secretKey: e.MINIO_SECRET_KEY!,
    });
  }
  return client;
}

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/plain', 'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'application/json', 'text/csv', 'application/x-yaml', 'text/markdown', 'application/gzip',
]);
const MAX_SIZE = 10 * 1024 * 1024;

export type UploadInput = {
  ticketId: string;
  filename: string;
  mime: string;
  bytes: Buffer;
};

export type UploadResult =
  | { ok: true; objectKey: string; size: number; sha256: string }
  | { ok: false; error: string };

export async function putAttachment(input: UploadInput): Promise<UploadResult> {
  if (!integrations().minio) return { ok: false, error: 'Attachment storage is not configured.' };
  if (input.bytes.length > MAX_SIZE) return { ok: false, error: 'File is larger than 10 MB.' };
  if (!ALLOWED_MIME.has(input.mime)) return { ok: false, error: `File type ${input.mime} is not allowed.` };

  const { createHash, randomBytes } = await import('node:crypto');
  const sha = createHash('sha256').update(input.bytes).digest('hex');
  const objectKey = `${input.ticketId}/${randomBytes(8).toString('hex')}/${input.filename.replace(/[^\w.-]+/g, '_').slice(0, 120)}`;
  const e = env();

  await minioClient()!.putObject(e.MINIO_BUCKET, objectKey, input.bytes, input.bytes.length, {
    'Content-Type': input.mime,
    'Content-Disposition': 'attachment',
  });
  return { ok: true, objectKey, size: input.bytes.length, sha256: sha };
}

export async function ensureBucket(): Promise<void> {
  const c = minioClient();
  if (!c) return;
  const e = env();
  const exists = await c.bucketExists(e.MINIO_BUCKET);
  if (!exists) await c.makeBucket(e.MINIO_BUCKET);
}

/** Presigned GET (15 min) — downloads never proxy through the app. */
export async function attachmentDownloadUrl(objectKey: string): Promise<string | null> {
  const c = minioClient();
  if (!c) return null;
  return c.presignedGetObject(env().MINIO_BUCKET, objectKey, 15 * 60);
}

/** Lifecycle rule: expire objects under closed tickets after 180 days (enforced by worker sweep). */
export async function deleteAttachment(objectKey: string): Promise<void> {
  const c = minioClient();
  if (!c) return;
  await c.removeObject(env().MINIO_BUCKET, objectKey);
}
