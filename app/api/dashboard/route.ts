import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = 'dashboard:data';

export async function GET() {
  const payload = await kv.get<{ data: object; lastEdited: string | null }>(KEY) ?? {};
  return NextResponse.json(payload);
}

export async function POST(req: Request) {
  const body = await req.json();
  await kv.set(KEY, body);
  return NextResponse.json({ ok: true });
}
