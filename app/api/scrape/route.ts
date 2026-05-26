import { NextRequest, NextResponse } from 'next/server';
import { scrapeAll, CarrierName } from '@/lib/scrapers';
import { parseCarrierMarkdown } from '@/lib/parser';
import {
  setCarrierStatus,
  appendHistory,
  setLastRun,
  setNextRun,
  CarrierKey,
} from '@/lib/db';

export const maxDuration = 60;

const CARRIER_DISPLAY_NAMES: Record<CarrierName, string> = {
  japanpost: 'Japan Post',
  fedex: 'FedEx',
  ups: 'UPS',
  dhl: 'DHL',
};

function isAuthorized(req: NextRequest): boolean {
  if (req.headers.get('x-vercel-cron') === '1') return true;
  const auth = req.headers.get('authorization');
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

function nextRunAfter(now: Date): string {
  // Runs at 09:00 and 21:00 UTC
  const hours = [9, 21];
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const todayMinutes = hours.map((h) => h * 60);
  const next = todayMinutes.find((m) => m > current);
  const result = new Date(now);
  result.setUTCSeconds(0);
  result.setUTCMilliseconds(0);
  if (next !== undefined) {
    result.setUTCHours(Math.floor(next / 60));
    result.setUTCMinutes(next % 60);
  } else {
    result.setUTCDate(result.getUTCDate() + 1);
    result.setUTCHours(hours[0]);
    result.setUTCMinutes(0);
  }
  return result.toISOString();
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = await scrapeAll();
  const summary: Record<string, unknown> = {};

  await Promise.allSettled(
    results.map(async ({ carrier, markdown, error, botBlocked }) => {
      const ts = new Date().toISOString();
      if (!markdown) {
        const reason = botBlocked ? 'bot_blocked' : (error ?? 'unknown_error');
        summary[carrier] = { success: false, reason };
        await appendHistory(carrier as CarrierKey, {
          timestamp: ts,
          success: false,
          error: reason,
          botBlocked,
        });
        return;
      }

      try {
        const parsed = await parseCarrierMarkdown(CARRIER_DISPLAY_NAMES[carrier as CarrierName], markdown);
        await setCarrierStatus(carrier as CarrierKey, parsed);
        await appendHistory(carrier as CarrierKey, {
          timestamp: ts,
          success: true,
          contentLength: markdown.length,
          confidence: parsed.confidence,
        });
        summary[carrier] = { success: true, confidence: parsed.confidence };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        summary[carrier] = { success: false, reason: msg };
        await appendHistory(carrier as CarrierKey, {
          timestamp: ts,
          success: false,
          error: msg,
        });
      }
    })
  );

  await setLastRun(now.toISOString());
  await setNextRun(nextRunAfter(now));

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), summary });
}

// Allow GET for Vercel cron (Vercel sends GET for cron jobs)
export async function GET(req: NextRequest) {
  return POST(req);
}
