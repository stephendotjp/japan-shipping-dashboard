import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getHistory, CarrierKey } from '@/lib/db';

const VALID_KEYS: CarrierKey[] = ['japanpost', 'fedex', 'ups', 'dhl'];

export async function GET(req: NextRequest) {
  const carrier = req.nextUrl.searchParams.get('carrier') as CarrierKey;
  if (!VALID_KEYS.includes(carrier)) {
    return NextResponse.json({ error: 'Invalid carrier' }, { status: 400 });
  }
  const history = await getHistory(carrier);
  return NextResponse.json(history);
}
