'use client';

import { useState, useEffect, useRef } from 'react';

type CarrierStatus = 'ok' | 'warn' | 'no' | 'q';

interface Carrier { name: string; s: CarrierStatus; note: string; }
interface DestData { flag: string; name: string; region: string; carriers: Carrier[]; rules: string[]; notes: string; }

const SC: Record<CarrierStatus, { wrapCls: string; label: string; badgeCls: string; pillCls: string; pillLabel: string }> = {
  ok:   { wrapCls: 's-ok',   label: 'OK',        badgeCls: 'badge-ok',   pillCls: 'op-ok',   pillLabel: 'Operational' },
  warn: { wrapCls: 's-warn', label: 'Caution',    badgeCls: 'badge-warn', pillCls: 'op-warn', pillLabel: 'Check before booking' },
  no:   { wrapCls: 's-no',   label: 'Suspended',  badgeCls: 'badge-no',   pillCls: 'op-no',   pillLabel: 'Do not ship' },
  q:    { wrapCls: 's-q',    label: 'Monitor',    badgeCls: 'badge-q',    pillCls: 'op-warn', pillLabel: 'Monitor' },
};

const REGIONS: Array<{ label: string; ids: string[] }> = [
  { label: 'North America', ids: ['usa', 'canada', 'mexico'] },
  { label: 'Europe',        ids: ['uk', 'germany', 'france', 'spain', 'italy', 'benelux', 'sweden', 'norway', 'denmark', 'finland'] },
  { label: 'Latin America', ids: ['brazil', 'latam'] },
  { label: 'Asia Pacific',  ids: ['australia', 'china', 'korea', 'taiwan', 'singapore', 'apac'] },
  { label: 'Suspended',     ids: ['mideast', 'russia'] },
];

const INITIAL_DATA: Record<string, DestData> = {
  usa: {
    flag: '🇺🇸', name: 'USA', region: 'North America',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Limited resumption April 2026 — verify per item type.' },
      { name: 'FedEx',      s: 'warn', note: 'DDP only — confirm terms before booking.' },
      { name: 'UPS',        s: 'ok',   note: 'Operational.' },
      { name: 'DHL',        s: 'ok',   note: 'Operational.' },
    ],
    rules: [
      'FedEx USA: DDP required — never ship DAP',
      'Declare full value — undervalue is auto-flagged',
      'Japan Post: confirm acceptance per item type before booking',
    ],
    notes: 'Japan Post availability to the US is inconsistent. Default to UPS or DHL unless JP is confirmed.',
  },
  canada: {
    flag: '🇨🇦', name: 'Canada', region: 'North America',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Declare full value on all shipments',
      'Goods over CAD $20 subject to duties and taxes',
    ],
    notes: '',
  },
  mexico: {
    flag: '🇲🇽', name: 'Mexico', region: 'North America',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — RFC or CURP required.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational — RFC or CURP required.' },
      { name: 'UPS',        s: 'ok', note: 'Operational — RFC or CURP required.' },
      { name: 'DHL',        s: 'ok', note: 'Operational — RFC or CURP required.' },
    ],
    rules: [
      'RFC required for business recipients (13 chars)',
      'CURP required for individual recipients (18 chars)',
      'Missing tax ID causes customs hold — collect at checkout',
      'All four carriers require tax ID — no exceptions',
    ],
    notes: 'Mexico is a high-volume destination. Collect RFC or CURP at checkout to avoid delays.',
  },
  uk: {
    flag: '🇬🇧', name: 'UK', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Full value declaration required.' },
    ],
    rules: [
      'Post-Brexit: all shipments require HS commodity codes',
      'DHL: full declared value mandatory',
      'IOSS number required for B2C orders under £135',
    ],
    notes: '',
  },
  germany: {
    flag: '🇩🇪', name: 'Germany', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Full declared value required on all carriers',
      'IOSS number required for B2C orders under €150',
      'Electronics: WEEE registration may be required',
    ],
    notes: '',
  },
  france: {
    flag: '🇫🇷', name: 'France', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'IOSS number required for B2C orders under €150',
      'Full declared value on all shipments',
    ],
    notes: '',
  },
  spain: {
    flag: '🇪🇸', name: 'Spain', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Check JP advisory — suspensions have applied.' },
      { name: 'FedEx',      s: 'ok',   note: 'Operational.' },
      { name: 'UPS',        s: 'ok',   note: 'Operational.' },
      { name: 'DHL',        s: 'ok',   note: 'Operational.' },
    ],
    rules: [
      'Verify Japan Post acceptance before booking',
      'IOSS number required for B2C orders under €150',
    ],
    notes: 'Spain has periodically appeared on JP suspension lists. Always confirm JP on day of booking.',
  },
  italy: {
    flag: '🇮🇹', name: 'Italy', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Check JP advisory — suspensions have applied.' },
      { name: 'FedEx',      s: 'ok',   note: 'Operational.' },
      { name: 'UPS',        s: 'ok',   note: 'Operational.' },
      { name: 'DHL',        s: 'ok',   note: 'Operational.' },
    ],
    rules: [
      'Verify Japan Post acceptance before booking',
      'Codice Fiscale may be required for some shipments',
      'IOSS number required for B2C orders under €150',
    ],
    notes: 'Italy has periodically appeared on JP suspension lists. Always confirm JP on day of booking.',
  },
  benelux: {
    flag: '🇧🇪', name: 'Belgium / Netherlands', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'IOSS number required for B2C orders under €150',
      'Full declared value on all shipments',
    ],
    notes: '',
  },
  sweden: {
    flag: '🇸🇪', name: 'Sweden', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'IOSS number required for B2C orders under €150',
      'Declare full value — undervalue flagged at customs',
    ],
    notes: '',
  },
  norway: {
    flag: '🇳🇴', name: 'Norway', region: 'Europe — non-EU',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Norway is outside the EU — IOSS does not apply',
      'All goods subject to Norwegian customs and VAT',
      'Shipments over NOK 350 subject to import duties',
    ],
    notes: 'Norway processes customs independently. Do not apply EU IOSS to Norwegian orders.',
  },
  denmark: {
    flag: '🇩🇰', name: 'Denmark', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'IOSS number required for B2C orders under €150',
      'Full declared value on all shipments',
    ],
    notes: '',
  },
  finland: {
    flag: '🇫🇮', name: 'Finland', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'IOSS number required for B2C orders under €150',
      'Full declared value on all shipments',
    ],
    notes: '',
  },
  brazil: {
    flag: '🇧🇷', name: 'Brazil', region: 'Latin America',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — CPF or CNPJ required.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational — CPF or CNPJ required.' },
      { name: 'UPS',        s: 'ok', note: 'Operational — CPF or CNPJ required.' },
      { name: 'DHL',        s: 'ok', note: 'Operational — CPF or CNPJ required.' },
    ],
    rules: [
      'CPF required for individual recipients (11 digits)',
      'CNPJ required for company recipients (14 digits)',
      'Missing tax ID causes customs hold or return — collect at order time',
    ],
    notes: 'Validate CPF/CNPJ format before submitting. Invalid numbers cause automatic rejection.',
  },
  latam: {
    flag: '🌎', name: 'Latin America (other)', region: 'Latin America — excl. Brazil & Mexico',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — verify per country.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Check Japan Post advisory per country before booking',
      'Some countries may require importer tax ID — confirm with carrier',
    ],
    notes: 'Brazil and Mexico are listed separately due to mandatory tax ID requirements.',
  },
  australia: {
    flag: '🇦🇺', name: 'Australia', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Goods over AUD 1,000 subject to import duties and GST',
      'Strict biosecurity — never ship food, plants, or animal products',
    ],
    notes: '',
  },
  china: {
    flag: '🇨🇳', name: 'China', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Check advisory — periodic delays and restrictions.' },
      { name: 'FedEx',      s: 'ok',   note: 'Operational.' },
      { name: 'UPS',        s: 'ok',   note: 'Operational.' },
      { name: 'DHL',        s: 'ok',   note: 'Operational.' },
    ],
    rules: [
      'Recipient ID number required for customs clearance',
      'Restricted categories: cosmetics, supplements, electronics — verify before shipping',
      'JP delays common — use courier for time-sensitive orders',
    ],
    notes: 'China customs regulations change frequently. Confirm current requirements per shipment category.',
  },
  korea: {
    flag: '🇰🇷', name: 'South Korea', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Personal customs clearance ID (PCCC) required for B2C shipments',
      'Goods over KRW 150,000 subject to duties',
    ],
    notes: '',
  },
  taiwan: {
    flag: '🇹🇼', name: 'Taiwan', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'Declare full value — customs checks declared vs. market value',
      'Goods over TWD 2,000 may be subject to duties',
    ],
    notes: '',
  },
  singapore: {
    flag: '🇸🇬', name: 'Singapore', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: [
      'All imports over SGD 400 subject to GST',
      'Chewing gum and certain goods prohibited — check restricted items list',
    ],
    notes: '',
  },
  apac: {
    flag: '🌏', name: 'Asia Pacific (other)', region: 'Asia Pacific — excl. listed',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Partial — check JP advisory per country.' },
      { name: 'FedEx',      s: 'q',    note: 'Monitoring — verify before booking.' },
      { name: 'UPS',        s: 'q',    note: 'Monitoring — verify before booking.' },
      { name: 'DHL',        s: 'q',    note: 'Monitoring — verify before booking.' },
    ],
    rules: [
      'Always verify JP acceptance per country before booking',
      'Carrier service levels vary significantly across this region',
    ],
    notes: 'Status changes frequently. Check carrier advisory pages before booking.',
  },
  mideast: {
    flag: '🌍', name: 'Middle East', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'no', note: 'Service suspended.' },
      { name: 'FedEx',      s: 'no', note: 'Suspended — actively adjusting to situation.' },
      { name: 'UPS',        s: 'no', note: 'Service impacts — do not book.' },
      { name: 'DHL',        s: 'no', note: 'Status page unavailable — do not book.' },
    ],
    rules: [
      'Do not accept new orders destined for this region',
      'If already in transit — contact carrier ops immediately',
    ],
    notes: 'All four carriers suspended or significantly impacted. No exceptions without ops manager approval.',
  },
  russia: {
    flag: '🇷🇺', name: 'Russia / Belarus', region: 'Eastern Europe',
    carriers: [
      { name: 'Japan Post', s: 'no', note: 'Service suspended.' },
      { name: 'FedEx',      s: 'no', note: 'Suspended indefinitely.' },
      { name: 'UPS',        s: 'no', note: 'Service suspended.' },
      { name: 'DHL',        s: 'no', note: 'Service suspended.' },
    ],
    rules: [
      'All carriers suspended — no exceptions',
      'Refund any orders received from these destinations',
    ],
    notes: 'FedEx suspension is indefinite. Do not accept or hold orders for Russia or Belarus.',
  },
};

function overallStatus(carriers: Carrier[]): CarrierStatus {
  const ss = carriers.map(c => c.s);
  if (ss.some(s => s === 'no'))                return 'no';
  if (ss.some(s => s === 'warn' || s === 'q')) return 'warn';
  return 'ok';
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ── Detail panel ──────────────────────────────────────────────────

interface DetailProps {
  dest: DestData;
  onCarrierStatus: (ci: number, val: CarrierStatus) => void;
  onCarrierNote:   (ci: number, val: string) => void;
  onRuleChange:    (ri: number, val: string) => void;
  onAddRule:       () => void;
  onDeleteRule:    (ri: number) => void;
  onNotesChange:   (val: string) => void;
}

function DestDetail({ dest, onCarrierStatus, onCarrierNote, onRuleChange, onAddRule, onDeleteRule, onNotesChange }: DetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(autoResize);
  }, []);

  const ov = overallStatus(dest.carriers);
  const sc = SC[ov];

  return (
    <div className="dp" ref={containerRef}>
      <div className="dest-heading">
        <span className="dest-flag-lg">{dest.flag}</span>
        <div>
          <div className="dest-name">{dest.name}</div>
          <div className="dest-region-sub">{dest.region}</div>
        </div>
        <span className={`overall-pill ${sc.pillCls}`}>{sc.pillLabel}</span>
      </div>

      <div className="sec-block">
        <div className="sec-head">
          <span>Carrier status</span>
          <span className="edit-hint">Click status to change</span>
        </div>
        <table className="carrier-table">
          <tbody>
            {dest.carriers.map((c, ci) => (
              <tr key={ci}>
                <td className="ct-name">{c.name}</td>
                <td className="ct-note">
                  <textarea
                    className="rule-text"
                    rows={1}
                    style={{ width: '100%', padding: 0 }}
                    value={c.note}
                    onChange={e => { onCarrierNote(ci, e.target.value); autoResize(e.target); }}
                  />
                </td>
                <td className="ct-status">
                  <div className={`status-select-wrap ${SC[c.s].wrapCls}`}>
                    <div className="status-dot" />
                    <select
                      className="status-select"
                      value={c.s}
                      onChange={e => onCarrierStatus(ci, e.target.value as CarrierStatus)}
                    >
                      <option value="ok">OK</option>
                      <option value="warn">Caution</option>
                      <option value="no">Suspended</option>
                      <option value="q">Monitor</option>
                    </select>
                    <i className="ti ti-chevron-down chevron-icon" aria-hidden="true" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sep" />

      <div className="sec-block">
        <div className="sec-head">
          <span>Country rules</span>
          <span className="edit-hint">Click any rule to edit</span>
        </div>
        <div className="rules-list">
          {dest.rules.map((r, ri) => (
            <div key={ri} className="rule-item">
              <i className="ti ti-point-filled rule-icon" aria-hidden="true" />
              <textarea
                className="rule-text"
                rows={1}
                value={r}
                onChange={e => { onRuleChange(ri, e.target.value); autoResize(e.target); }}
              />
              <button className="rule-del" onClick={() => onDeleteRule(ri)} aria-label="Delete rule">
                <i className="ti ti-x" />
              </button>
            </div>
          ))}
        </div>
        <button className="add-rule-btn" onClick={onAddRule}>
          <i className="ti ti-plus" style={{ fontSize: 12 }} aria-hidden="true" />
          Add rule
        </button>
      </div>

      <div className="sep" />

      <div className="sec-block">
        <div className="sec-head">
          <span>Notes</span>
          <span className="edit-hint">Click to edit</span>
        </div>
        <textarea
          className="notes-area"
          placeholder="Add notes for this destination…"
          value={dest.notes}
          onChange={e => { onNotesChange(e.target.value); autoResize(e.target); }}
        />
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<Record<string, DestData>>(INITIAL_DATA);
  const [currentId, setCurrentId] = useState<string | null>(null);

  function patch(id: string, fn: (d: DestData) => DestData) {
    setData(prev => ({ ...prev, [id]: fn(prev[id]) }));
  }

  function handleCarrierStatus(id: string, ci: number, val: CarrierStatus) {
    patch(id, d => ({ ...d, carriers: d.carriers.map((c, i) => i === ci ? { ...c, s: val } : c) }));
  }

  function handleCarrierNote(id: string, ci: number, val: string) {
    patch(id, d => ({ ...d, carriers: d.carriers.map((c, i) => i === ci ? { ...c, note: val } : c) }));
  }

  function handleRuleChange(id: string, ri: number, val: string) {
    patch(id, d => ({ ...d, rules: d.rules.map((r, i) => i === ri ? val : r) }));
  }

  function handleAddRule(id: string) {
    patch(id, d => ({ ...d, rules: [...d.rules, 'New rule — click to edit'] }));
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLTextAreaElement>('.rule-text');
      if (inputs.length) { inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
    }, 30);
  }

  function handleDeleteRule(id: string, ri: number) {
    patch(id, d => ({ ...d, rules: d.rules.filter((_, i) => i !== ri) }));
  }

  function handleNotesChange(id: string, val: string) {
    patch(id, d => ({ ...d, notes: val }));
  }

  return (
    <div className="dash">
      <h2 className="sr-only">Japan shipping ops — carrier &amp; destination guide</h2>

      <div className="hdr">
        <div>
          <div className="hdr-title">Japan shipping ops</div>
          <div className="hdr-sub">Carrier &amp; destination guide</div>
        </div>
        <div className="updated">Updated May 27, 2026</div>
      </div>

      <div className="notices">
        <div className="notice n-warn">
          <i className="ti ti-alert-triangle" style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          Insurance required on all orders ¥50,000+ — always use real declared value
        </div>
        <div className="notice n-danger">
          <i className="ti ti-ban" style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          Never use as goods description: cosmetics · medicine · food · drinks · toys
        </div>
      </div>

      <div className="body">
        <div className="sidebar">
          <div className="dest-list">
            {REGIONS.map(region => (
              <div key={region.label}>
                <div className="region-label">{region.label}</div>
                {region.ids.map(id => {
                  const d = data[id];
                  const ov = overallStatus(d.carriers);
                  const sc = SC[ov];
                  return (
                    <button
                      key={id}
                      className={`dest-btn${currentId === id ? ' active' : ''}`}
                      onClick={() => setCurrentId(id)}
                    >
                      <span className="dflag">{d.flag}</span>
                      <span className="dname">{d.name}</span>
                      <span className={`dbadge ${sc.badgeCls}`}>{sc.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="detail">
          {currentId ? (
            <DestDetail
              key={currentId}
              dest={data[currentId]}
              onCarrierStatus={(ci, val) => handleCarrierStatus(currentId, ci, val)}
              onCarrierNote={(ci, val) => handleCarrierNote(currentId, ci, val)}
              onRuleChange={(ri, val) => handleRuleChange(currentId, ri, val)}
              onAddRule={() => handleAddRule(currentId)}
              onDeleteRule={ri => handleDeleteRule(currentId, ri)}
              onNotesChange={val => handleNotesChange(currentId, val)}
            />
          ) : (
            <div className="placeholder">
              <i className="ti ti-map-2" aria-hidden="true" />
              <p>Select a destination</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
