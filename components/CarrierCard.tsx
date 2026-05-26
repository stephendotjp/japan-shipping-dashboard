'use client';

import { ParsedStatus } from '@/lib/db';

interface CarrierCardProps {
  carrierKey: string;
  data: (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;
}

const CARRIER_META: Record<string, { emoji: string; name: string; url: string }> = {
  japanpost: { emoji: '🇯🇵', name: 'Japan Post', url: 'https://www.post.japanpost.jp/int/information/index_en.html' },
  fedex: { emoji: '📦', name: 'FedEx', url: 'https://www.fedex.com/en-us/service-alerts.html' },
  ups: { emoji: '🟤', name: 'UPS', url: 'https://www.ups.com/us/en/service-alerts.page' },
  dhl: { emoji: '🟡', name: 'DHL', url: 'https://www.dhl.com/us-en/home/our-divisions/parcel/business-customers/shipping/service-updates.html' },
};

const STATUS_COLORS: Record<string, string> = {
  operational: '#00c48c',
  partial: '#ffc107',
  suspended: '#ff4757',
  unknown: '#888888',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span style={{
      background: STATUS_COLORS[status] ?? STATUS_COLORS.unknown,
      color: '#000',
      borderRadius: '999px',
      padding: '2px 10px',
      fontSize: '0.75rem',
      fontWeight: 700,
      textTransform: 'uppercase',
    }}>
      {status}
    </span>
  );
}

function formatJST(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Tokyo',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' JST';
}

const SEVERITY_COLORS: Record<string, string> = {
  info: '#4a9eff',
  warning: '#ffc107',
  critical: '#ff4757',
};

export default function CarrierCard({ carrierKey, data }: CarrierCardProps) {
  const meta = CARRIER_META[carrierKey] ?? { emoji: '🚚', name: carrierKey, url: '#' };

  if (!data) {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{meta.emoji} {meta.name}</span>
          <StatusPill status="unknown" />
        </div>
        <div style={{ color: '#888', fontSize: '0.9rem' }}>Initial data loading...</div>
      </div>
    );
  }

  const overallStatus = data.usDestinationStatus === 'suspended' || data.japanOriginStatus === 'suspended'
    ? 'suspended'
    : data.usDestinationStatus === 'partial' || data.japanOriginStatus === 'partial'
    ? 'partial'
    : data.usDestinationStatus === 'operational' && data.japanOriginStatus === 'operational'
    ? 'operational'
    : 'unknown';

  return (
    <div style={cardStyle}>
      {data.stale && (
        <div style={{
          background: 'rgba(255, 150, 0, 0.15)',
          border: '1px solid rgba(255, 150, 0, 0.4)',
          borderRadius: 6,
          padding: '6px 10px',
          marginBottom: 10,
          fontSize: '0.8rem',
          color: '#ffaa33',
        }}>
          ⚠ Data from {data.staleSince ? formatJST(data.staleSince) : 'unknown'} — live update pending
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{meta.emoji} {meta.name}</span>
        <StatusPill status={overallStatus} />
      </div>

      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 10 }}>
        Updated: {formatJST(data.updatedAt)} | Confidence: {data.confidence}
      </div>

      {data.rawSummary && (
        <p style={{ fontSize: '0.875rem', color: '#ccc', marginBottom: 10, lineHeight: 1.5 }}>
          {data.rawSummary}
        </p>
      )}

      {data.activeAlerts && data.activeAlerts.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4 }}>Active Alerts:</div>
          {data.activeAlerts.map((alert, i) => (
            <div key={i} style={{
              borderLeft: `3px solid ${SEVERITY_COLORS[alert.severity] ?? '#888'}`,
              paddingLeft: 8,
              marginBottom: 6,
              fontSize: '0.8rem',
              color: '#ddd',
            }}>
              <strong style={{ color: SEVERITY_COLORS[alert.severity] }}>{alert.title}</strong>
              {alert.description && <span style={{ color: '#aaa' }}>: {alert.description}</span>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Japan → USA:</span>
        <StatusPill status={data.usDestinationStatus} />
        <span style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: 8 }}>Origin:</span>
        <StatusPill status={data.japanOriginStatus} />
      </div>

      <a
        href={meta.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: '0.75rem',
          color: '#4a9eff',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        ↗ Official site
      </a>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 12,
  padding: 20,
  color: '#fff',
};
