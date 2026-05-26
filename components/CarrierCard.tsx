'use client';

import { ParsedStatus } from '@/lib/db';

interface CarrierCardProps {
  carrierKey: string;
  data: (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;
}

const CARRIER_META: Record<string, { name: string; url: string; color: string }> = {
  japanpost: { name: 'Japan Post', url: 'https://www.post.japanpost.jp/int/information/index_en.html', color: '#c8102e' },
  fedex:     { name: 'FedEx',      url: 'https://www.fedex.com/en-us/service-alerts.html',            color: '#4d148c' },
  ups:       { name: 'UPS',        url: 'https://www.ups.com/us/en/service-alerts.page',              color: '#351c15' },
  dhl:       { name: 'DHL',        url: 'https://www.dhl.com/us-en/home/our-divisions/parcel/business-customers/shipping/service-updates.html', color: '#D40511' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; glow: string; dot: string }> = {
  operational: { label: 'OPERATIONAL', bg: '#003d28', glow: '#00c48c', dot: '#00ff9d' },
  partial:     { label: 'PARTIAL',     bg: '#3d2d00', glow: '#ffc107', dot: '#ffd740' },
  suspended:   { label: 'SUSPENDED',   bg: '#3d0010', glow: '#ff4757', dot: '#ff6b81' },
  unknown:     { label: 'UNKNOWN',     bg: '#1a1f2e', glow: '#888888', dot: '#aaaaaa' },
};

function overallStatus(data: ParsedStatus): string {
  if (data.usDestinationStatus === 'suspended' || data.japanOriginStatus === 'suspended') return 'suspended';
  if (data.usDestinationStatus === 'partial' || data.japanOriginStatus === 'partial') return 'partial';
  if (data.usDestinationStatus === 'operational' && data.japanOriginStatus === 'operational') return 'operational';
  return 'unknown';
}

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: cfg.dot,
        boxShadow: `0 0 6px ${cfg.dot}`,
        display: 'inline-block', flexShrink: 0,
      }} />
      <span style={{ color: cfg.dot, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em' }}>
        {status.toUpperCase()}
      </span>
    </span>
  );
}

export default function CarrierCard({ carrierKey, data }: CarrierCardProps) {
  const meta = CARRIER_META[carrierKey] ?? { name: carrierKey, url: '#', color: '#333' };

  const status = data ? overallStatus(data) : 'unknown';
  const cfg = STATUS_CONFIG[status];

  return (
    <div style={{
      background: '#0c1220',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderTop: `3px solid ${cfg.glow}`,
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: `0 0 20px ${cfg.glow}18`,
    }}>
      {/* Status banner */}
      <div style={{
        background: cfg.bg,
        padding: '14px 20px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: `1px solid ${cfg.glow}30`,
      }}>
        <span style={{
          width: 16, height: 16, borderRadius: '50%',
          background: cfg.dot,
          boxShadow: `0 0 12px ${cfg.dot}, 0 0 4px ${cfg.dot}`,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: '1.5rem',
          fontWeight: 900,
          color: cfg.dot,
          letterSpacing: '0.12em',
          textShadow: `0 0 20px ${cfg.glow}`,
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Carrier name */}
      <div style={{
        padding: '14px 20px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 6, height: 30, background: meta.color,
          borderRadius: 3, flexShrink: 0,
        }} />
        <span style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '-0.02em',
        }}>
          {meta.name}
        </span>
      </div>

      {/* Route statuses */}
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {!data ? (
          <span style={{ color: '#555', fontSize: '0.95rem' }}>Loading…</span>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6a7a9a', fontSize: '0.9rem', fontWeight: 600 }}>JAPAN → USA</span>
              <StatusDot status={data.usDestinationStatus} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6a7a9a', fontSize: '0.9rem', fontWeight: 600 }}>JAPAN ORIGIN</span>
              <StatusDot status={data.japanOriginStatus} />
            </div>
            {data.activeAlerts && data.activeAlerts.length > 0 && (
              <div style={{
                marginTop: 6,
                padding: '6px 10px',
                background: 'rgba(255,100,0,0.08)',
                border: '1px solid rgba(255,100,0,0.2)',
                borderRadius: 6,
                fontSize: '0.78rem',
                color: '#ffaa66',
                lineHeight: 1.4,
              }}>
                ⚠ {data.activeAlerts[0].title}
                {data.activeAlerts.length > 1 && ` (+${data.activeAlerts.length - 1} more)`}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {data?.stale && (
          <span style={{ fontSize: '0.72rem', color: '#ff9944' }}>⚠ Stale data</span>
        )}
        {!data?.stale && <span />}
        <a href={meta.url} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '0.72rem', color: '#3a6aaa', textDecoration: 'none' }}>
          ↗ Official
        </a>
      </div>
    </div>
  );
}
