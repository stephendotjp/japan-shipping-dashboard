import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAllStatuses, getLastRun, CarrierKey } from '@/lib/db';

const START_TIME = Date.now();

export async function GET() {
  const [statuses, lastRun] = await Promise.all([getAllStatuses(), getLastRun()]);

  const perCarrier: Record<string, { lastSuccess: string | null; hasData: boolean }> = {};
  for (const [key, status] of Object.entries(statuses) as [CarrierKey, typeof statuses[CarrierKey]][]) {
    perCarrier[key] = {
      lastSuccess: status?.updatedAt ?? null,
      hasData: status !== null,
    };
  }

  return NextResponse.json({
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    lastScrape: lastRun,
    carriers: perCarrier,
  });
}
