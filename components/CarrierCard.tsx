'use client';

import { ParsedStatus } from '@/lib/db';

interface CarrierCardProps {
  carrierKey: string;
  data: (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;
}

const CARRIER_META: Record<string, { name: string; sub: string }> = {
  japanpost: { name: 'Japan Post',  sub: 'Postal Authority' },
  fedex:     { name: 'FedEx',       sub: 'Express Freight' },
  ups:       { name: 'UPS',         sub: 'Parcel & Logistics' },
  dhl:       { name: 'DHL',         sub: 'International Express' },
};

type Status = 'operational' | 'partial' | 'suspended' | 'unknown';

function overallStatus(data: ParsedStatus): Status {
  if (data.usDestinationStatus === 'suspended' || data.japanOriginStatus === 'suspended') return 'suspended';
  if (data.usDestinationStatus === 'partial' || data.japanOriginStatus === 'partial') return 'partial';
  if (data.usDestinationStatus === 'operational' && data.japanOriginStatus === 'operational') return 'operational';
  return 'unknown';
}

function toCardClass(s: Status) {
  if (s === 'operational') return 'ok';
  if (s === 'partial') return 'partial';
  if (s === 'suspended') return 'down';
  return 'unknown';
}

function toBadgeLabel(s: Status) {
  if (s === 'operational') return '✓ Operational';
  if (s === 'partial') return '⚠ Partial';
  if (s === 'suspended') return '✕ Suspended';
  return '? Monitoring';
}

export default function CarrierCard({ carrierKey, data }: CarrierCardProps) {
  const meta = CARRIER_META[carrierKey] ?? { name: carrierKey, sub: '' };
  const status = data ? overallStatus(data) : 'unknown';
  const cardClass = toCardClass(status);

  return (
    <div className={`carrier-card ${cardClass}`}>
      <div className="carrier-name">
        {meta.name}
        {data?.stale && <span className="stale-badge">stale</span>}
      </div>
      <div className="carrier-sub">{meta.sub}</div>
      <div>
        <span className={`carrier-badge badge-${cardClass}`}>{toBadgeLabel(status)}</span>
      </div>
    </div>
  );
}
