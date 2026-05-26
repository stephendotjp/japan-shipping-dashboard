import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = 'matrix:overrides';

export async function GET() {
  const data = await kv.get<object>(KEY) ?? { cells: {}, notes: {} };
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  await kv.set(KEY, body);
  return NextResponse.json({ ok: true });
}
