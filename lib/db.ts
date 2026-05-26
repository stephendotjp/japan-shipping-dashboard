import { kv } from '@vercel/kv';

export type CarrierKey = 'japanpost' | 'fedex' | 'ups' | 'dhl';

export interface ParsedStatus {
  carrier: string;
  usDestinationStatus: 'operational' | 'partial' | 'suspended' | 'unknown';
  japanOriginStatus: 'operational' | 'partial' | 'suspended' | 'unknown';
  allClear: boolean;
  activeAlerts: { title: string; description: string; severity: 'info' | 'warning' | 'critical' }[];
  rawSummary: string;
  confidence: 'high' | 'medium' | 'low';
  scrapedContentLength: number;
  updatedAt: string;
}

export interface HistoryEntry {
  timestamp: string;
  success: boolean;
  error?: string;
  botBlocked?: boolean;
  contentLength?: number;
  confidence?: string;
}

export async function getCarrierStatus(carrier: CarrierKey): Promise<ParsedStatus | null> {
  return kv.get<ParsedStatus>(`status:${carrier}`);
}

export async function setCarrierStatus(carrier: CarrierKey, status: ParsedStatus): Promise<void> {
  await kv.set(`status:${carrier}`, status);
}

export async function appendHistory(carrier: CarrierKey, entry: HistoryEntry): Promise<void> {
  const key = `scrape:history:${carrier}`;
  const existing = await kv.get<HistoryEntry[]>(key) ?? [];
  const updated = [entry, ...existing].slice(0, 10);
  await kv.set(key, updated);
}

export async function getHistory(carrier: CarrierKey): Promise<HistoryEntry[]> {
  return (await kv.get<HistoryEntry[]>(`scrape:history:${carrier}`)) ?? [];
}

export async function setLastRun(ts: string): Promise<void> {
  await kv.set('scrape:lastRun', ts);
}

export async function getLastRun(): Promise<string | null> {
  return kv.get<string>('scrape:lastRun');
}

export async function setNextRun(ts: string): Promise<void> {
  await kv.set('scrape:nextRun', ts);
}

export async function getNextRun(): Promise<string | null> {
  return kv.get<string>('scrape:nextRun');
}

export async function getAllStatuses(): Promise<Record<CarrierKey, ParsedStatus | null>> {
  const [japanpost, fedex, ups, dhl] = await Promise.all([
    getCarrierStatus('japanpost'),
    getCarrierStatus('fedex'),
    getCarrierStatus('ups'),
    getCarrierStatus('dhl'),
  ]);
  return { japanpost, fedex, ups, dhl };
}
