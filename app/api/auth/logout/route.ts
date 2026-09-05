import { NextResponse, type NextRequest } from 'next/server';
import { destroySession } from '@/lib/auth/discord';

export async function POST(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL('/staff', req.nextUrl.origin));
}
