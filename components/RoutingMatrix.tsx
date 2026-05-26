'use client';

import { ParsedStatus } from '@/lib/db';

type CarrierData = (ParsedStatus & { stale: boolean; staleSince: string | null }) | null;
type DotStatus = 'ok' | 'warn' | 'no' | 'unk';

const CARRIERS = ['japanpost', 'fedex', 'ups', 'dhl'];
const CARRIER_LABELS: Record<string, string> = {
  japanpost: 'Japan Post', fedex: 'FedEx', ups: 'UPS', dhl: 'DHL',
};

const REGIONS = [
  {
    flag: '🇺🇸', name: 'USA / Canada', isUSA: true,
    keywords: ['usa', 'united states', 'u.s.', 'canada', 'north america', 'america'],
  },
  {
    flag: '🇪🇺', name: 'Europe', isUSA: false,
    keywords: ['europe', 'european', ' eu ', 'united kingdom', ' uk ', 'france', 'germany', 'italy', 'spain'],
  },
  {
    flag: '🌍', name: 'Middle East', isUSA: false,
    keywords: ['middle east', 'israel', 'gaza', 'iran', 'iraq', 'yemen', 'syria', 'lebanon', 'saudi', 'uae', 'emirates', 'oman', 'bahrain', 'kuwait'],
  },
  {
    flag: '🇷🇺', name: 'Russia / Belarus', isUSA: false,
    keywords: ['russia', 'russian', 'belarus'],
  },
  {
    flag: '🌏', name: 'Asia Pacific', isUSA: false,
    keywords: ['asia pacific', 'asia-pacific', 'southeast asia', 'china', 'korea', 'australia', 'new zealand', 'singapore', 'hong kong', 'asean'],
  },
  {
    flag: '🌎', name: 'Latin America', isUSA: false,
    keywords: ['latin america', 'south america', 'brazil', 'mexico', 'argentina', 'colombia', 'central america'],
  },
];

function getOverall(data: ParsedStatus): string {
  if (data.usDestinationStatus === 'suspended' || data.japanOriginStatus === 'suspended') return 'suspended';
  if (data.usDestinationStatus === 'partial' || data.japanOriginStatus === 'partial') return 'partial';
  if (data.usDestinationStatus === 'operational' && data.japanOriginStatus === 'operational') return 'operational';
  return 'unknown';
}

function getDot(
  data: CarrierData,
  keywords: string[],
  isUSA: boolean,
): { status: DotStatus; tooltip: string } {
  if (!data) return { status: 'unk', tooltip: 'No data available' };

  const overall = getOverall(data);

  // For the USA row use usDestinationStatus directly, still scan alerts for nuance
  if (isUSA) {
    const usAlert = (data.activeAlerts ?? []).find(a => {
      const t = (a.title + ' ' + a.description).toLowerCase();
      return keywords.some(k => t.includes(k));
    });
    if (data.usDestinationStatus === 'suspended') return { status: 'no', tooltip: 'US shipping suspended' };
    if (data.usDestinationStatus === 'operational') {
      if (usAlert) return { status: 'warn', tooltip: usAlert.title };
      return { status: 'ok', tooltip: 'Operational' };
    }
    if (data.usDestinationStatus === 'partial') {
      return { status: 'warn', tooltip: usAlert?.title ?? 'Partial — delays possible' };
    }
    return { status: 'unk', tooltip: 'Monitoring — limited data' };
  }

  // Global suspension applies to all regions
  if (overall === 'suspended') return { status: 'no', tooltip: 'Service suspended' };

  // Scan alerts for region-specific mentions
  for (const alert of data.activeAlerts ?? []) {
    const text = (alert.title + ' ' + alert.description).toLowerCase();
    if (keywords.some(k => text.includes(k))) {
      const isSuspended =
        text.includes('suspend') ||
        text.includes('halted') ||
        text.includes('do not') ||
        text.includes('fully suspend');
      if (isSuspended || alert.severity === 'critical') {
        return { status: 'no', tooltip: alert.title };
      }
      return { status: 'warn', tooltip: alert.title };
    }
  }

  // Fall back to overall carrier status
  if (overall === 'operational') return { status: 'ok', tooltip: 'Operational' };
  if (overall === 'partial') return { status: 'warn', tooltip: 'Partial — check alerts' };
  return { status: 'unk', tooltip: 'Monitoring — limited data' };
}

function getNote(
  carriers: Record<string, CarrierData>,
  keywords: string[],
): { text: string; cls: string } {
  let bestText = '';
  let bestSeverity = 0; // 0=none, 1=warn, 2=crit

  for (const data of Object.values(carriers)) {
    if (!data) continue;
    for (const alert of data.activeAlerts ?? []) {
      const text = (alert.title + ' ' + alert.description).toLowerCase();
      if (!keywords.some(k => text.includes(k))) continue;
      const sev = alert.severity === 'critical' ? 2 : alert.severity === 'warning' ? 1 : 0;
      if (sev > bestSeverity) {
        bestSeverity = sev;
        bestText = (alert.description || alert.title).slice(0, 110);
      }
    }
  }

  return {
    text: bestText,
    cls: bestSeverity === 2 ? 'crit' : bestSeverity === 1 ? 'warn' : '',
  };
}

function Dot({ status, tooltip }: { status: DotStatus; tooltip: string }) {
  const sym = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : status === 'no' ? '✕' : '?';
  return <span className={`dot dot-${status}`} title={tooltip}>{sym}</span>;
}

interface Props {
  carriers: Record<string, CarrierData>;
}

export default function RoutingMatrix({ carriers }: Props) {
  return (
    <div className="matrix-wrap">
      <table className="matrix-table">
        <thead>
          <tr>
            <th style={{ minWidth: 140 }}>Destination</th>
            {CARRIERS.map(c => (
              <th key={c} style={{ textAlign: 'center' }}>{CARRIER_LABELS[c]}</th>
            ))}
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {REGIONS.map(region => {
            const dots = CARRIERS.map(c =>
              getDot(carriers[c] ?? null, region.keywords, region.isUSA)
            );
            const note = getNote(carriers, region.keywords);
            const allDisrupted = dots.every(d => d.status === 'warn' || d.status === 'no');

            return (
              <tr key={region.name} className={allDisrupted ? 'matrix-row-warn' : undefined}>
                <td>
                  <span className="region-flag">{region.flag}</span>
                  <span className="region-name">{region.name}</span>
                </td>
                {dots.map((dot, ci) => (
                  <td key={CARRIERS[ci]} style={{ textAlign: 'center' }}>
                    <Dot status={dot.status} tooltip={dot.tooltip} />
                  </td>
                ))}
                <td>
                  <span className={`note-cell${note.cls ? ' ' + note.cls : ''}`}>
                    {note.text || '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
