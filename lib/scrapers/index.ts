import { scrapeJapanPost } from './japanpost';
import { scrapeFedEx } from './fedex';
import { scrapeUPS } from './ups';
import { scrapeDHL } from './dhl';

export type CarrierName = 'japanpost' | 'fedex' | 'ups' | 'dhl';

const BOT_BLOCK_STRINGS = ['captcha', 'cloudflare', 'access denied', '403', 'enable javascript'];

function isBotBlocked(markdown: string): boolean {
  const lower = markdown.toLowerCase();
  return BOT_BLOCK_STRINGS.some((s) => lower.includes(s));
}

export interface ScrapeResult {
  carrier: CarrierName;
  markdown: string | null;
  error: string | null;
  botBlocked: boolean;
}

async function scrapeOne(
  carrier: CarrierName,
  fn: () => Promise<string>
): Promise<ScrapeResult> {
  try {
    const markdown = await fn();
    if (markdown.length < 200) {
      return { carrier, markdown: null, error: 'Content too short', botBlocked: false };
    }
    if (isBotBlocked(markdown)) {
      return { carrier, markdown: null, error: 'Bot blocked', botBlocked: true };
    }
    return { carrier, markdown, error: null, botBlocked: false };
  } catch (e: unknown) {
    return { carrier, markdown: null, error: e instanceof Error ? e.message : String(e), botBlocked: false };
  }
}

export async function scrapeAll(): Promise<ScrapeResult[]> {
  const results = await Promise.allSettled([
    scrapeOne('japanpost', scrapeJapanPost),
    scrapeOne('fedex', scrapeFedEx),
    scrapeOne('ups', scrapeUPS),
    scrapeOne('dhl', scrapeDHL),
  ]);

  return results.map((r, i) => {
    const carrier = (['japanpost', 'fedex', 'ups', 'dhl'] as CarrierName[])[i];
    if (r.status === 'fulfilled') return r.value;
    return { carrier, markdown: null, error: String(r.reason), botBlocked: false };
  });
}
