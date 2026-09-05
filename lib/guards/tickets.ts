import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';

/** Ticket IDs are grouped as CCX-XXXX-XXXX (Crockford base32, no ambiguous glyphs). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newTrackingId(): string {
  const buf = randomBytes(8);
  let a = 0;
  let b = 0;
  for (let i = 0; i < 4; i++) a = a * 32 + (buf[i]! % 32);
  for (let i = 4; i < 8; i++) b = b * 32 + (buf[i]! % 32);
  return `CCX-${toQuad(a)}-${toQuad(b)}`;
}

function toQuad(n: number): string {
  let s = '';
  for (let i = 3; i >= 0; i--) {
    s = ALPHABET[Math.floor(n / 32 ** i) % 32] + s;
  }
  return s;
}

export function normalizeTrackingId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidTrackingId(raw: string): boolean {
  return /^CCX-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(normalizeTrackingId(raw));
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** URL-safe signed token (magic links). Stateless verification via HMAC. */
export function signToken(payload: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${mac}`;
}

export function verifyToken(token: string, secret: string): string | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const payload = Buffer.from(body, 'base64url').toString();
  const expected = createHmac('sha256', secret).update(payload).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return payload;
}

export function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
