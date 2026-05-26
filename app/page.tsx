import ClientDashboard from './ClientDashboard';
import { getAllStatuses, getLastRun, getNextRun, ParsedStatus } from '@/lib/db';

async function getInitialData() {
  try {
    const [statuses, lastUpdated, nextUpdate] = await Promise.all([
      getAllStatuses(),
      getLastRun(),
      getNextRun(),
    ]);

    const carriers: Record<string, (ParsedStatus & { stale: boolean; staleSince: string | null }) | null> = {};
    const STALE_MS = 13 * 60 * 60 * 1000;
    for (const [key, status] of Object.entries(statuses)) {
      if (!status) { carriers[key] = null; continue; }
      const age = Date.now() - new Date(status.updatedAt).getTime();
      const stale = age > STALE_MS;
      carriers[key] = { ...status, stale, staleSince: stale ? status.updatedAt : null };
    }

    return { lastUpdated, nextUpdate, carriers };
  } catch {
    return { lastUpdated: null, nextUpdate: null, carriers: { japanpost: null, fedex: null, ups: null, dhl: null } };
  }
}

export default async function Page() {
  const initial = await getInitialData();
  return <ClientDashboard initial={initial} />;
}
