'use client';

import { ParsedStatus } from '@/lib/db';

interface CarrierCardProps {
  carrierKey: string;
  data: (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;
}

const CARRIER_META: Record<string, { name: string; type: string; url: string }> = {
  japanpost: { name: 'Japan Post',  type: 'International Postal Service', url: 'https://www.post.japanpost.jp/int/information/index_en.html' },
  fedex:     { name: 'FedEx',       type: 'Express & Freight Carrier',    url: 'https://www.fedex.com/en-us/service-alerts.html' },
  ups:       { name: 'UPS',         type: 'Parcel & Freight Carrier',     url: 'https://www.ups.com/us/en/service-alerts.page' },
  dhl:       { name: 'DHL',         type: 'International Express',        url: 'https://www.dhl.com/us-en/home/our-divisions/parcel/business-customers/shipping/service-updates.html' },
};

type Status = 'operational' | 'partial' | 'suspended' | 'unknown';

const STATUS_CHIP: Record<Status, { bg: string; text: string; border: string; label: string }> = {
  operational: { bg: '#EAF4E5', text: '#2D6B1A', border: '#B4D9A2', label: 'OPERATIONAL' },
  partial:     { bg: '#FEF3CD', text: '#7A5800', border: '#F0D070', label: 'PARTIAL' },
  suspended:   { bg: '#FDECEA', text: '#8B1A1A', border: '#F0A0A0', label: 'SUSPENDED' },
  unknown:     { bg: '#F0EEE8', text: '#888888', border: '#D8D6D0', label: 'UNKNOWN' },
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
  letterSpacing: '0.1em',
  color: '#888',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-sans)',
};

export default function CarrierCard({ carrierKey, data }: CarrierCardProps) {
  const meta = CARRIER_META[carrierKey] ?? { name: carrierKey, type: '', url: '#' };
  const status = data ? overallStatus(data) : 'unknown';
  const topAlert = data?.activeAlerts?.[0];

  return (
    <div style={{
      background: '#fff',
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
          <div style={{ fontSize: '16px', fontWeight: 500, color: '#1A1A18', marginBottom: 3 }}>
            {meta.name}
          </div>
          <div style={LABEL}>{meta.type}</div>
        </div>
        <StatusChip status={status} />
      </div>

      {/* Route rows */}
      <div style={{ padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {!data ? (
          <div style={{ ...LABEL, color: '#ccc', paddingTop: 4 }}>NO DATA</div>
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
        background: topAlert ? '#FFFBF0' : 'transparent',
        borderTop: `1px solid ${topAlert ? '#F0D070' : 'var(--border)'}`,
        borderBottom: '1px solid var(--border)',
      }}>
        {topAlert ? (
          <div style={{
            fontSize: '11px',
            color: '#7A5800',
            letterSpacing: '0.02em',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {topAlert.title}
            {(data?.activeAlerts?.length ?? 0) > 1 && (
              <span style={{ color: '#B08000', marginLeft: 6 }}>
                +{(data?.activeAlerts?.length ?? 1) - 1} more
              </span>
            )}
          </div>
        ) : (
          <div style={{ ...LABEL, color: '#C8C4BC' }}>NO ACTIVE ALERTS</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {data?.stale ? (
          <span style={{ ...LABEL, color: '#B08000' }}>DATA STALE</span>
        ) : (
          <span />
        )}
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...LABEL, color: '#888', textDecoration: 'underline', textDecorationColor: '#D8D6D0' }}
        >
          SOURCE
        </a>
      </div>
    </div>
  );
}
