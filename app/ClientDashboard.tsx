'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import CarrierCard from '@/components/CarrierCard';
import { ParsedStatus } from '@/lib/db';

const Globe = dynamic(() => import('@/components/Globe'), { ssr: false });

type CarrierData = (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;

interface StatusResponse {
  lastUpdated: string | null;
  nextUpdate: string | null;
  carriers: Record<string, CarrierData>;
}

interface Props {
  initial: StatusResponse;
}

function computeUSStatus(carriers: Record<string, CarrierData>): 'operational' | 'partial' | 'suspended' | 'unknown' {
  const statuses = Object.values(carriers)
    .filter(Boolean)
    .map((c) => c!.usDestinationStatus);
  if (statuses.length === 0) return 'unknown';
  if (statuses.some((s) => s === 'suspended')) return 'suspended';
  if (statuses.some((s) => s === 'partial')) return 'partial';
  if (statuses.every((s) => s === 'operational')) return 'operational';
  return 'unknown';
}

function formatCountdown(nextUpdate: string | null): string {
  if (!nextUpdate) return '--:--:--';
  const diff = new Date(nextUpdate).getTime() - Date.now();
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatJST(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' JST';
}

export default function ClientDashboard({ initial }: Props) {
  const [data, setData] = useState<StatusResponse>(initial);
  const [countdown, setCountdown] = useState('');
  const [triggeredInitialScrape, setTriggeredInitialScrape] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) setData(await res.json());
    } catch { /* retain existing data */ }
  }, []);

  // Trigger initial scrape if no data
  useEffect(() => {
    if (triggeredInitialScrape) return;
    const hasNoData = Object.values(initial.carriers).every((c) => c === null);
    if (hasNoData) {
      setTriggeredInitialScrape(true);
      fetch('/api/scrape', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_APP_URL ?? ''}` },
      }).catch(() => {});
    }
  }, [initial.carriers, triggeredInitialScrape]);

  // Poll every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(data.nextUpdate));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data.nextUpdate]);

  const usStatus = computeUSStatus(data.carriers);
  const CARRIER_KEYS = ['japanpost', 'fedex', 'ups', 'dhl'];

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Japan Shipping Status
          </h1>
          <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: '0.8rem', color: '#888' }}>
            <span>Last updated: {formatJST(data.lastUpdated)}</span>
            <span>Next update in: <span style={{ color: '#4a9eff', fontVariantNumeric: 'tabular-nums' }}>{countdown}</span></span>
          </div>
        </div>

        {/* Globe */}
        <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}>
          <Globe usStatus={usStatus} />
        </div>

        {/* Cards grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {CARRIER_KEYS.map((key) => (
            <CarrierCard key={key} carrierKey={key} data={data.carriers[key] ?? null} />
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.75rem', color: '#444' }}>
          <a href="/admin" style={{ color: '#555', textDecoration: 'none' }}>Admin / Debug</a>
        </div>
      </div>
    </div>
  );
}
