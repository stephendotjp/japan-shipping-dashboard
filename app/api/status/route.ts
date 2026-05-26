import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getAllStatuses, getLastRun, getNextRun, ParsedStatus } from '@/lib/db';

const STALE_HOURS = 13;

function isStale(updatedAt: string | undefined): { stale: boolean; staleSince: string | null } {
  if (!updatedAt) return { stale: true, staleSince: null };
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age > STALE_HOURS * 60 * 60 * 1000) {
    return { stale: true, staleSince: updatedAt };
  }
  return { stale: false, staleSince: null };
}

export async function GET() {
  const [statuses, lastUpdated, nextUpdate] = await Promise.all([
    getAllStatuses(),
    getLastRun(),
    getNextRun(),
  ]);

  const carriers: Record<string, (ParsedStatus & { stale: boolean; staleSince: string | null }) | null> = {};

  for (const [key, status] of Object.entries(statuses)) {
    if (!status) {
      carriers[key] = null;
      continue;
    }
    const { stale, staleSince } = isStale(status.updatedAt);
    carriers[key] = { ...status, stale, staleSince };
  }

  return NextResponse.json({ lastUpdated, nextUpdate, carriers });
}
