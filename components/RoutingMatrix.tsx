'use client';

import { useEffect, useState, useCallback } from 'react';
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

const STATUS_OPTIONS: Array<{ value: DotStatus | null; label: string; activeClass: string }> = [
  { value: null,   label: 'Auto (AI)',  activeClass: 'active-auto' },
  { value: 'ok',   label: '✓ Accepted', activeClass: 'active-ok'   },
  { value: 'warn', label: '⚠ Alert',    activeClass: 'active-warn' },
  { value: 'no',   label: '✕ Suspended',activeClass: 'active-no'   },
];

interface MatrixData {
  cells: Record<string, DotStatus>;
  notes: Record<string, string>;
}

function FlagIcon({ name }: { name: string }) {
  const flagStyle = {
    display: 'inline-block' as const,
    verticalAlign: 'middle' as const,
    borderRadius: 2,
    border: '0.5px solid rgba(0,0,0,0.12)',
  };
  const globeStyle = { display: 'inline-block' as const, verticalAlign: 'middle' as const };

  if (name === 'USA / Canada') {
    return (
      <svg width="22" height="15" viewBox="0 0 22 15" style={flagStyle}>
        <rect width="22" height="15" fill="#B22234" />
        {[1,3,5,7,9,11].map(n => (
          <rect key={n} y={n * 15/13} width="22" height={15/13} fill="white" />
        ))}
        <rect width="8.8" height={7 * 15/13} fill="#3C3B6E" />
      </svg>
    );
  }
  if (name === 'Europe') {
    return (
      <svg width="22" height="15" viewBox="0 0 22 15" style={flagStyle}>
        <rect width="22" height="15" fill="#003399" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 - 90) * Math.PI / 180;
          return (
            <circle key={i}
              cx={11 + 4.5 * Math.cos(a)}
              cy={7.5 + 4.5 * Math.sin(a)}
              r={0.85}
              fill="#FFD700"
            />
          );
        })}
      </svg>
    );
  }
  if (name === 'Russia / Belarus') {
    return (
      <svg width="22" height="15" viewBox="0 0 22 15" style={flagStyle}>
        <rect width="22" height="5" fill="white" />
        <rect y="5" width="22" height="5" fill="#0039A6" />
        <rect y="10" width="22" height="5" fill="#D52B1E" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={globeStyle}>
      <circle cx="10" cy="10" r="9.5" fill="#4a90d9" />
      <ellipse cx="10" cy="10" rx="4" ry="9.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
      <ellipse cx="10" cy="10" rx="9.5" ry="3.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />
      <circle cx="10" cy="10" r="9.5" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="0.5" />
    </svg>
  );
}

function getOverall(data: ParsedStatus): string {
  if (data.usDestinationStatus === 'suspended' || data.japanOriginStatus === 'suspended') return 'suspended';
  if (data.usDestinationStatus === 'partial' || data.japanOriginStatus === 'partial') return 'partial';
  if (data.usDestinationStatus === 'operational' && data.japanOriginStatus === 'operational') return 'operational';
  return 'unknown';
}

function getAIDot(
  data: CarrierData,
  keywords: string[],
  isUSA: boolean,
): { status: DotStatus; tooltip: string } {
  if (!data) return { status: 'unk', tooltip: 'No data available' };

  const overall = getOverall(data);

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

  if (overall === 'suspended') return { status: 'no', tooltip: 'Service suspended' };

  for (const alert of data.activeAlerts ?? []) {
    const text = (alert.title + ' ' + alert.description).toLowerCase();
    if (keywords.some(k => text.includes(k))) {
      const isSuspended =
        text.includes('suspend') || text.includes('halted') ||
        text.includes('do not') || text.includes('fully suspend');
      if (isSuspended || alert.severity === 'critical') {
        return { status: 'no', tooltip: alert.title };
      }
      return { status: 'warn', tooltip: alert.title };
    }
  }

  if (overall === 'operational') return { status: 'ok', tooltip: 'Operational' };
  if (overall === 'partial') return { status: 'warn', tooltip: 'Partial — check alerts' };
  return { status: 'unk', tooltip: 'Monitoring — limited data' };
}

function getAINote(
  carriers: Record<string, CarrierData>,
  keywords: string[],
): { text: string; cls: string } {
  let bestText = '';
  let bestSeverity = 0;

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

function Dot({ status, tooltip, overridden }: { status: DotStatus; tooltip: string; overridden: boolean }) {
  const sym = status === 'ok' ? '✓' : status === 'warn' ? '⚠' : status === 'no' ? '✕' : '?';
  return (
    <span
      className={`dot dot-${status}${overridden ? ' dot-override' : ''}`}
      title={overridden ? `[Manual override] ${tooltip}` : tooltip}
    >
      {sym}
    </span>
  );
}

interface Props {
  carriers: Record<string, CarrierData>;
}

export default function RoutingMatrix({ carriers }: Props) {
  const [matrix, setMatrix] = useState<MatrixData>({ cells: {}, notes: {} });
  const [editing, setEditing] = useState<string | null>(null);
  const [editCells, setEditCells] = useState<Record<string, DotStatus | null>>({});
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/matrix')
      .then(r => r.json())
      .then((d: MatrixData) => setMatrix(d))
      .catch(() => {});
  }, []);

  const openEditor = useCallback((regionName: string) => {
    const cells: Record<string, DotStatus | null> = {};
    for (const c of CARRIERS) {
      const key = `${c}:${regionName}`;
      cells[c] = (matrix.cells[key] as DotStatus) ?? null;
    }
    setEditCells(cells);
    setEditNote(matrix.notes[regionName] ?? '');
    setEditing(regionName);
  }, [matrix]);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    setSaving(true);

    const newCells = { ...matrix.cells };
    const newNotes = { ...matrix.notes };

    for (const c of CARRIERS) {
      const key = `${c}:${editing}`;
      if (editCells[c] == null) {
        delete newCells[key];
      } else {
        newCells[key] = editCells[c]!;
      }
    }

    if (editNote.trim()) {
      newNotes[editing] = editNote.trim();
    } else {
      delete newNotes[editing];
    }

    const updated: MatrixData = { cells: newCells, notes: newNotes };

    try {
      await fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setMatrix(updated);
    } catch { /* retain current state */ }

    setSaving(false);
    setEditing(null);
  }, [editing, editCells, editNote, matrix]);

  const handleClear = useCallback(async () => {
    if (!editing) return;
    setSaving(true);

    const newCells = { ...matrix.cells };
    const newNotes = { ...matrix.notes };
    for (const c of CARRIERS) delete newCells[`${c}:${editing}`];
    delete newNotes[editing];

    const updated: MatrixData = { cells: newCells, notes: newNotes };
    try {
      await fetch('/api/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setMatrix(updated);
    } catch {}

    setSaving(false);
    setEditing(null);
  }, [editing, matrix]);

  const editingRegion = REGIONS.find(r => r.name === editing);

  return (
    <>
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
              const aiDots = CARRIERS.map(c =>
                getAIDot(carriers[c] ?? null, region.keywords, region.isUSA)
              );

              const effectiveDots = CARRIERS.map((c, ci) => {
                const key = `${c}:${region.name}`;
                const override = matrix.cells[key] as DotStatus | undefined;
                return {
                  status: override ?? aiDots[ci].status,
                  tooltip: override
                    ? (override === 'ok' ? 'Accepted' : override === 'warn' ? 'Alert' : 'Suspended')
                    : aiDots[ci].tooltip,
                  overridden: !!override,
                };
              });

              const aiNote = getAINote(carriers, region.keywords);
              const managerNote = matrix.notes[region.name];
              const hasOverride = CARRIERS.some(c => matrix.cells[`${c}:${region.name}`]);
              const allDisrupted = effectiveDots.every(d => d.status === 'warn' || d.status === 'no');

              return (
                <tr
                  key={region.name}
                  className={[
                    'matrix-row-clickable',
                    allDisrupted ? 'matrix-row-warn' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => openEditor(region.name)}
                >
                  <td>
                    <span className="region-flag"><FlagIcon name={region.name} /></span>
                    <span className="region-name">{region.name}</span>
                  </td>
                  {effectiveDots.map((dot, ci) => (
                    <td key={CARRIERS[ci]} style={{ textAlign: 'center' }}>
                      <Dot status={dot.status} tooltip={dot.tooltip} overridden={dot.overridden} />
                    </td>
                  ))}
                  <td>
                    <span className={`note-cell${aiNote.cls && !managerNote ? ' ' + aiNote.cls : ''}`}>
                      {managerNote || aiNote.text || '—'}
                    </span>
                    {hasOverride && (
                      <span className="edited-badge">edited</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && editingRegion && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal-box">
            <div className="modal-title">
              <span className="modal-flag"><FlagIcon name={editingRegion.name} /></span>
              {editingRegion.name}
            </div>

            <div className="modal-section-label">Carrier status overrides</div>

            {CARRIERS.map(c => (
              <div key={c} className="modal-carrier-row">
                <span className="modal-carrier-label">{CARRIER_LABELS[c]}</span>
                <div className="modal-status-btns">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={String(opt.value)}
                      className={`modal-status-btn${editCells[c] === opt.value ? ' ' + opt.activeClass : ''}`}
                      onClick={() => setEditCells(prev => ({ ...prev, [c]: opt.value }))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="modal-section-label" style={{ marginTop: 18 }}>Manager note</div>
            <textarea
              className="modal-textarea"
              rows={3}
              placeholder="Optional note for this destination (e.g. 'Cleared by ops — resume normal shipping')"
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
            />

            <div className="modal-actions">
              <button className="modal-btn" onClick={handleClear} disabled={saving}>
                Clear overrides
              </button>
              <button className="modal-btn" onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </button>
              <button className="modal-btn modal-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
