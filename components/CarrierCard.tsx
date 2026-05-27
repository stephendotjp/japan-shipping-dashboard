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

function JapanPostLogo() {
  return (
    <svg width="38" height="26" viewBox="0 0 38 26" fill="none">
      <rect width="38" height="26" rx="4" fill="#E60026" />
      <text x="19" y="20" fontSize="17" textAnchor="middle" fill="white"
        fontFamily="system-ui, sans-serif" fontWeight="600">〒</text>
    </svg>
  );
}

function FedExLogo() {
  return (
    <svg width="60" height="22" viewBox="0 0 60 22" fill="none">
      <text x="0" y="18" fontSize="19" fontWeight="900"
        fontFamily="Arial Black, Arial, sans-serif" fill="#4D148C">Fed</text>
      <text x="37" y="18" fontSize="19" fontWeight="900"
        fontFamily="Arial Black, Arial, sans-serif" fill="#FF6600">Ex</text>
    </svg>
  );
}

function UPSLogo() {
  return (
    <svg width="30" height="36" viewBox="0 0 30 36" fill="none">
      <path d="M15 1.5 L28 7 L28 21 Q28 31 15 35 Q2 31 2 21 L2 7 Z" fill="#351C15" />
      <text x="15" y="23" fontSize="9" fontWeight="700" textAnchor="middle"
        fill="#FFB500" fontFamily="Arial, sans-serif">UPS</text>
    </svg>
  );
}

function DHLLogo() {
  return (
    <svg width="52" height="24" viewBox="0 0 52 24" fill="none">
      <rect width="52" height="24" rx="3" fill="#FFCC00" />
      <text x="26" y="18" fontSize="15" fontWeight="900" textAnchor="middle"
        fill="#D40511" fontFamily="Arial Black, Arial, sans-serif">DHL</text>
    </svg>
  );
}

const CARRIER_LOGOS: Record<string, (() => JSX.Element) | undefined> = {
  japanpost: JapanPostLogo,
  fedex:     FedExLogo,
  ups:       UPSLogo,
  dhl:       DHLLogo,
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
  const Logo = CARRIER_LOGOS[carrierKey];

  return (
    <div className={`carrier-card ${cardClass}`}>
      {Logo && <div style={{ marginBottom: 10 }}><Logo /></div>}
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
