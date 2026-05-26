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
  const statuses = Object.values(carriers).filter(Boolean).map((c) => c!.usDestinationStatus);
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
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' JST';
}

const CARRIER_KEYS = ['japanpost', 'fedex', 'ups', 'dhl'];

export default function ClientDashboard({ initial }: Props) {
  const [data, setData] = useState<StatusResponse>(initial);
  const [countdown, setCountdown] = useState('--:--:--');
  const [triggeredInitialScrape, setTriggeredInitialScrape] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) setData(await res.json());
    } catch { /* retain existing */ }
  }, []);

  useEffect(() => {
    if (triggeredInitialScrape) return;
    const hasNoData = Object.values(initial.carriers).every((c) => c === null);
    if (hasNoData) {
      setTriggeredInitialScrape(true);
      fetch('/api/admin/trigger', { method: 'POST' }).catch(() => {});
    }
  }, [initial.carriers, triggeredInitialScrape]);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(data.nextUpdate));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data.nextUpdate]);

  const usStatus = computeUSStatus(data.carriers);

  return (
    <div style={{
      background: '#020812',
      minHeight: '100vh',
      color: '#fff',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.4)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#ffd700',
            boxShadow: '0 0 10px #ffd700',
          }} />
          <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '0.05em', color: '#e8f0ff' }}>
            JAPAN SHIPPING STATUS
          </span>
        </div>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#445', letterSpacing: '0.08em', marginBottom: 2 }}>LAST UPDATED</div>
            <div style={{ fontSize: '0.9rem', color: '#aabbcc', fontVariantNumeric: 'tabular-nums' }}>
              {formatJST(data.lastUpdated)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#445', letterSpacing: '0.08em', marginBottom: 2 }}>NEXT UPDATE</div>
            <div style={{ fontSize: '1.1rem', color: '#4a9eff', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>
              {countdown}
            </div>
          </div>
          <a href="/admin" style={{ fontSize: '0.72rem', color: '#334', textDecoration: 'none', padding: '6px 12px', border: '1px solid #223', borderRadius: 6 }}>
            Admin
          </a>
        </div>
      </div>

      {/* Globe */}
      <div style={{
        flex: '1 1 0',
        minHeight: 0,
        padding: '12px 24px 8px',
        display: 'flex',
      }}>
        <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }}>
          <Globe usStatus={usStatus} />
        </div>
      </div>

      {/* Carrier cards — 4 in a row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        padding: '8px 24px 20px',
        flexShrink: 0,
      }}>
        {CARRIER_KEYS.map((key) => (
          <CarrierCard key={key} carrierKey={key} data={data.carriers[key] ?? null} />
        ))}
      </div>
    </div>
  );
}
