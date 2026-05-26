'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import CarrierCard from '@/components/CarrierCard';
import { ParsedStatus } from '@/lib/db';

const WorldMap = dynamic(() => import('@/components/Globe'), { ssr: false });

type CarrierData = (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;

interface StatusResponse {
  lastUpdated: string | null;
  nextUpdate: string | null;
  carriers: Record<string, CarrierData>;
}

interface Props { initial: StatusResponse; }

const CARRIER_KEYS = ['japanpost', 'fedex', 'ups', 'dhl'];
type StatusLevel = 'operational' | 'partial' | 'suspended' | 'unknown';

function overallStatus(d: ParsedStatus): StatusLevel {
  if (d.usDestinationStatus === 'suspended' || d.japanOriginStatus === 'suspended') return 'suspended';
  if (d.usDestinationStatus === 'partial'   || d.japanOriginStatus === 'partial')   return 'partial';
  if (d.usDestinationStatus === 'operational' && d.japanOriginStatus === 'operational') return 'operational';
  return 'unknown';
}

function computeSummary(carriers: Record<string, CarrierData>) {
  let operational = 0, partial = 0, unknown = 0, alerts = 0;
  for (const d of Object.values(carriers)) {
    if (!d) { unknown++; continue; }
    const s = overallStatus(d);
    if (s === 'operational') operational++;
    else if (s === 'partial') partial++;
    else unknown++;
    alerts += d.activeAlerts?.length ?? 0;
  }
  return { operational, partial, unknown, alerts };
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
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }) + ' JST';
}

function progressPercent(nextUpdate: string | null): number {
  if (!nextUpdate) return 0;
  const next = new Date(nextUpdate).getTime();
  const total = 6 * 60 * 60 * 1000; // 6h window between updates
  const remaining = next - Date.now();
  if (remaining <= 0) return 100;
  return Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };
const LABEL: React.CSSProperties = {
  fontSize: '10px', fontWeight: 500, letterSpacing: '0.1em',
  color: '#888', textTransform: 'uppercase',
};

export default function ClientDashboard({ initial }: Props) {
  const [data, setData] = useState<StatusResponse>(initial);
  const [countdown, setCountdown] = useState('--:--:--');
  const [progress, setProgress] = useState(0);
  const [triggered, setTriggered] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) setData(await res.json());
    } catch { /* retain */ }
  }, []);

  useEffect(() => {
    if (triggered) return;
    const empty = Object.values(initial.carriers).every(c => c === null);
    if (empty) {
      setTriggered(true);
      fetch('/api/admin/trigger', { method: 'POST' }).catch(() => {});
    }
  }, [initial.carriers, triggered]);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    const tick = () => {
      setCountdown(formatCountdown(data.nextUpdate));
      setProgress(progressPercent(data.nextUpdate));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data.nextUpdate]);

  const summary = computeSummary(data.carriers);

  return (
    <div style={{
      background: 'var(--bg)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
    }}>

      {/* ── Topbar ── */}
      <div style={{
        background: 'var(--topbar)',
        padding: '0 28px',
        height: '54px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#F5F3EF', letterSpacing: '0.02em' }}>
            Japan Shipping Status
          </div>
          <div style={{ ...LABEL, color: '#666', marginTop: 1 }}>
            International carrier monitor
          </div>
        </div>
        <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...LABEL, color: '#555' }}>Last updated</div>
            <div style={{ ...MONO, fontSize: '12px', color: '#999', marginTop: 1 }}>
              {formatJST(data.lastUpdated)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...LABEL, color: '#555' }}>Next update</div>
            <div style={{ ...MONO, fontSize: '14px', fontWeight: 500, color: '#F5F3EF', marginTop: 1 }}>
              {countdown}
            </div>
          </div>
          <a
            href="/admin"
            style={{ ...LABEL, color: '#555', padding: '5px 10px', border: '1px solid #333', borderRadius: '2px' }}
          >
            Admin
          </a>
        </div>
      </div>

      {/* ── World map panel ── */}
      <WorldMap />

      {/* ── Carrier cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        borderTop: '1px solid var(--border)',
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        margin: '0',
        background: 'var(--border)',
        gap: '1px',
      }}>
        {CARRIER_KEYS.map(key => (
          <CarrierCard key={key} carrierKey={key} data={data.carriers[key] ?? null} />
        ))}
      </div>

      {/* ── Summary bar ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        background: 'var(--border)',
        gap: '1px',
        borderBottom: '1px solid var(--border)',
      }}>
        {[
          { label: 'Operational', value: summary.operational, color: '#2D6B1A' },
          { label: 'Partial',     value: summary.partial,     color: '#7A5800' },
          { label: 'Unknown',     value: summary.unknown,     color: '#888' },
          { label: 'Active Alerts', value: summary.alerts,   color: summary.alerts > 0 ? '#8B1A1A' : '#888' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#fff',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}>
            <span style={{ ...MONO, fontSize: '22px', fontWeight: 500, color }}>{value}</span>
            <span style={{ ...LABEL, color: '#aaa' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid var(--border)',
        padding: '0 20px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        marginTop: 'auto',
      }}>
        <span style={{ ...LABEL, color: '#C0BCB6' }}>
          Data: Firecrawl scrape + Claude AI parse · Refreshes at 06:00 &amp; 18:00 JST
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...LABEL, color: '#C0BCB6' }}>Refreshes in</span>
          <span style={{ ...MONO, fontSize: '11px', color: '#888' }}>{countdown}</span>
          <div style={{ width: 80, height: 3, background: '#ECEAE4', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: '#1A1A18',
              transition: 'width 1s linear',
            }} />
          </div>
        </div>
      </div>

    </div>
  );
}
