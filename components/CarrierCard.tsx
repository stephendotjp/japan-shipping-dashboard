'use client';

import { ParsedStatus } from '@/lib/db';

interface CarrierCardProps {
  carrierKey: string;
  data: (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;
}

const CARRIER_META: Record<string, { name: string; type: string; url: string }> = {
  japanpost: { name: 'Japan Post',  type: 'International Postal Authority', url: 'https://www.post.japanpost.jp/int/information/index_en.html' },
  fedex:     { name: 'FedEx',       type: 'Express Freight Division',       url: 'https://www.fedex.com/en-us/service-alerts.html' },
  ups:       { name: 'UPS',         type: 'Parcel & Logistics Unit',        url: 'https://www.ups.com/us/en/service-alerts.page' },
  dhl:       { name: 'DHL',         type: 'International Express Courier',  url: 'https://www.dhl.com/us-en/home/our-divisions/parcel/business-customers/shipping/service-updates.html' },
};

type Status = 'operational' | 'partial' | 'suspended' | 'unknown';

const STATUS_CHIP: Record<Status, { bg: string; text: string; border: string; label: string }> = {
  operational: { bg: '#D8E8D0', text: '#384E30', border: '#9ABE90', label: 'OPERATIONAL' },
  partial:     { bg: '#EAE0B8', text: '#5E4818', border: '#C0A848', label: 'PARTIAL' },
  suspended:   { bg: '#E4D0CC', text: '#702820', border: '#C08888', label: 'SUSPENDED' },
  unknown:     { bg: '#E0DDD6', text: '#7A7670', border: '#BEBAB0', label: 'UNKNOWN' },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CHIP[status as Status] ?? STATUS_CHIP.unknown;
  return (
    <span style={{
      display: 'inline-block',
      background: cfg.bg,
      color: cfg.text,
      border: `1px solid ${cfg.border}`,
      borderRadius: '2px',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '0.1em',
      padding: '2px 7px',
      fontFamily: 'var(--font-sans)',
    }}>
      {cfg.label}
    </span>
  );
}

function overallStatus(data: ParsedStatus): Status {
  if (data.usDestinationStatus === 'suspended' || data.japanOriginStatus === 'suspended') return 'suspended';
  if (data.usDestinationStatus === 'partial' || data.japanOriginStatus === 'partial') return 'partial';
  if (data.usDestinationStatus === 'operational' && data.japanOriginStatus === 'operational') return 'operational';
  return 'unknown';
}

const LABEL: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '0.12em',
  color: '#7A7670',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-sans)',
};

export default function CarrierCard({ carrierKey, data }: CarrierCardProps) {
  const meta = CARRIER_META[carrierKey] ?? { name: carrierKey, type: '', url: '#' };
  const status = data ? overallStatus(data) : 'unknown';
  const topAlert = data?.activeAlerts?.[0];

  return (
    <div style={{
      background: '#F0EDE6',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#1E1D1A', marginBottom: 3, letterSpacing: '0.02em' }}>
            {meta.name}
          </div>
          <div style={LABEL}>{meta.type}</div>
        </div>
        <StatusChip status={status} />
      </div>

      {/* Route rows */}
      <div style={{ padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {!data ? (
          <div style={{ ...LABEL, color: '#C0BAB0', paddingTop: 4 }}>NO DATA</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={LABEL}>INTL. SERVICES</span>
              <StatusChip status={data.usDestinationStatus} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={LABEL}>JAPAN ORIGIN</span>
              <StatusChip status={data.japanOriginStatus} />
            </div>
          </>
        )}
      </div>

      {/* Alert strip */}
      <div style={{
        minHeight: '28px',
        padding: '6px 20px',
        background: topAlert ? '#EAE0B8' : '#F0EDE6',
        borderTop: `1px solid ${topAlert ? '#C0A848' : 'var(--border)'}`,
        borderBottom: '1px solid var(--border)',
      }}>
        {topAlert ? (
          <div style={{
            fontSize: '11px',
            color: '#5E4818',
            letterSpacing: '0.03em',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {topAlert.title}
            {(data?.activeAlerts?.length ?? 0) > 1 && (
              <span style={{ color: '#8C7030', marginLeft: 6 }}>
                +{(data?.activeAlerts?.length ?? 1) - 1} more
              </span>
            )}
          </div>
        ) : (
          <div style={{ ...LABEL, color: '#C0BAB0' }}>NO ACTIVE ALERTS</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {data?.stale ? (
          <span style={{ ...LABEL, color: '#8C7030' }}>DATA STALE</span>
        ) : (
          <span />
        )}
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...LABEL, color: '#7A7670', textDecoration: 'underline', textDecorationColor: '#C8C4BA' }}
        >
          SOURCE
        </a>
      </div>
    </div>
  );
}
