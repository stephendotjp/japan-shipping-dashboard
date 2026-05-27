'use client';

import { useState } from 'react';

type ChipTone = 'ok' | 'warn' | 'danger' | 'gray';
type RuleTone = 'ok' | 'warn' | 'danger' | 'neutral';

interface CarrierChip { abbr: string; tone: ChipTone; }
interface RuleRow { key: string; value: string; tone?: RuleTone; }
interface RuleBlock {
  label: string;
  rows: RuleRow[];
  fullWidth?: boolean;
  blockStyle?: 'danger-bar' | 'info-bar';
}
interface Destination {
  id: string;
  name: string;
  subtitle: string;
  chips: CarrierChip[];
  blocks: RuleBlock[];
}

const DESTINATIONS: Destination[] = [
  {
    id: 'usa',
    name: 'USA / Canada',
    subtitle: 'No Japan Post · DDP check required',
    chips: [
      { abbr: 'JP', tone: 'danger' },
      { abbr: 'FedEx', tone: 'warn' },
      { abbr: 'DHL', tone: 'gray' },
    ],
    blocks: [
      {
        label: 'Carriers & services',
        rows: [
          { key: 'Allowed', value: 'FedEx or DHL only (Japan Post NOT available)', tone: 'neutral' },
          { key: 'Undervalue', value: 'NEVER', tone: 'danger' },
          { key: 'FedEx services', value: "Int'l Economy or Int'l Priority only", tone: 'neutral' },
          { key: 'FedEx Connect Plus', value: 'DO NOT USE', tone: 'danger' },
          { key: 'FedEx DDP', value: 'Confirm customer paid before shipping', tone: 'warn' },
        ],
      },
      {
        label: 'Label requirement',
        rows: [
          { key: 'Description prefix', value: 'Must start with "U.S" (e.g. "U.S - Figure")', tone: 'warn' },
        ],
      },
      {
        label: 'DHL → FedEx switch',
        fullWidth: true,
        rows: [
          { key: 'When', value: 'DHL rate too high', tone: 'neutral' },
          { key: 'Service', value: 'FedEx DDU only', tone: 'neutral' },
          { key: 'Delivered Duty Paid', value: 'DO NOT tick', tone: 'danger' },
          { key: 'After shipping', value: 'Send "DHL switched to FedEx DDU" message with tracking', tone: 'neutral' },
        ],
      },
    ],
  },
  {
    id: 'germany',
    name: 'Germany',
    subtitle: 'Full value always',
    chips: [
      { abbr: 'JP', tone: 'warn' },
      { abbr: 'FedEx', tone: 'ok' },
      { abbr: 'DHL', tone: 'ok' },
    ],
    blocks: [
      {
        label: 'Carriers & rules',
        rows: [
          { key: 'Carriers', value: 'FedEx / DHL / Japan Post', tone: 'neutral' },
          { key: 'Undervalue', value: 'NEVER — declare full real value', tone: 'danger' },
        ],
      },
    ],
  },
  {
    id: 'uk',
    name: 'UK',
    subtitle: 'DHL: full value always',
    chips: [
      { abbr: 'JP', tone: 'warn' },
      { abbr: 'FedEx', tone: 'ok' },
      { abbr: 'DHL', tone: 'ok' },
    ],
    blocks: [
      {
        label: 'Carriers & rules',
        rows: [
          { key: 'Carriers', value: 'DHL / FedEx / Japan Post', tone: 'neutral' },
          { key: 'DHL undervalue', value: 'NEVER — full value always', tone: 'danger' },
          { key: 'FedEx / Japan Post', value: 'Normal rules apply', tone: 'neutral' },
        ],
      },
    ],
  },
  {
    id: 'brazil',
    name: 'Brazil',
    subtitle: 'Tax ID all carriers',
    chips: [
      { abbr: 'JP', tone: 'warn' },
      { abbr: 'FedEx', tone: 'ok' },
      { abbr: 'DHL', tone: 'ok' },
    ],
    blocks: [
      {
        label: 'Carriers & rules',
        rows: [
          { key: 'Carriers', value: 'FedEx / DHL / Japan Post', tone: 'neutral' },
          { key: 'Undervalue', value: 'NEVER', tone: 'danger' },
          { key: 'Tax ID', value: 'Required for ALL carriers before shipping', tone: 'warn' },
        ],
      },
    ],
  },
  {
    id: 'mexico',
    name: 'Mexico',
    subtitle: 'JP Post OK · couriers need Tax ID',
    chips: [
      { abbr: 'JP', tone: 'ok' },
      { abbr: 'FedEx', tone: 'warn' },
      { abbr: 'UPS', tone: 'warn' },
      { abbr: 'DHL', tone: 'warn' },
    ],
    blocks: [
      {
        label: 'Japan Post',
        rows: [
          { key: 'Tax ID', value: 'Not needed', tone: 'ok' },
          { key: 'Ship', value: 'As normal', tone: 'ok' },
        ],
      },
      {
        label: 'FedEx / UPS / DHL',
        rows: [
          { key: 'Tax ID', value: 'RFC or CURP required', tone: 'warn' },
          { key: 'Undervalue', value: 'YES — auto applied', tone: 'ok' },
        ],
      },
      {
        label: 'Workflow',
        fullWidth: true,
        rows: [
          { key: 'PrestaShop', value: "Set ‘Mexico’ status → emails customer + alerts CS", tone: 'neutral' },
          { key: 'Parcel', value: 'Place in Room 502 while waiting for Tax ID', tone: 'neutral' },
        ],
      },
    ],
  },
  {
    id: 'eu',
    name: 'France / Italy / Spain / BE / NL / Scandinavia',
    subtitle: 'Undervalue auto-applied',
    chips: [
      { abbr: 'JP', tone: 'warn' },
      { abbr: 'FedEx', tone: 'ok' },
      { abbr: 'DHL', tone: 'ok' },
    ],
    blocks: [
      {
        label: 'Carriers',
        rows: [
          { key: 'Carriers', value: 'FedEx / DHL / Japan Post', tone: 'neutral' },
          { key: 'Undervalue', value: 'YES — auto applied unless customer requests otherwise', tone: 'ok' },
        ],
      },
      {
        label: 'Undervalue tiers',
        rows: [
          { key: '¥100 – ¥6,000', value: 'Declare full (no undervalue)', tone: 'neutral' },
          { key: '¥6,000 – ¥20,000', value: 'Declare 30% less (e.g. ¥10k → ¥7k)', tone: 'neutral' },
          { key: 'Above ¥20,000', value: 'Declare 50% less (e.g. ¥50k → ¥25k)', tone: 'neutral' },
        ],
      },
      {
        label: 'Important',
        fullWidth: true,
        blockStyle: 'info-bar',
        rows: [
          { key: '', value: "Always check customer’s private note first — follow their request if given. Declared value = product value only, never include shipping costs.", tone: 'warn' },
        ],
      },
    ],
  },
  {
    id: 'middleeast',
    name: 'Middle East',
    subtitle: 'Multiple suspensions — check per country',
    chips: [
      { abbr: 'JP', tone: 'danger' },
      { abbr: 'FedEx', tone: 'danger' },
      { abbr: 'UPS', tone: 'warn' },
      { abbr: 'DHL', tone: 'danger' },
    ],
    blocks: [
      {
        label: 'FedEx — suspended countries',
        rows: [
          { key: 'Suspended', value: 'Bahrain, Kuwait, Iraq, Qatar, UAE, Israel', tone: 'danger' },
          { key: 'Also at risk', value: 'Other ME/Africa destinations via Dubai', tone: 'warn' },
        ],
      },
      {
        label: 'DHL — suspended countries',
        rows: [
          { key: 'Suspended', value: 'UAE, Bahrain, Iran, Jordan, Kuwait, Lebanon, Pakistan, Qatar, Saudi Arabia', tone: 'danger' },
        ],
      },
      {
        label: 'Japan Post — likely returned',
        rows: [
          { key: 'Likely returned', value: 'UAE, Israel, Iraq, Iran, Egypt, Oman, Qatar, Kuwait, Saudi Arabia, Turkey, Bahrain, Jordan, Lebanon', tone: 'warn' },
        ],
      },
      {
        label: 'Rule',
        fullWidth: true,
        rows: [
          { key: 'Before shipping', value: 'Always verify current status — do not create any label without checking', tone: 'warn' },
        ],
      },
    ],
  },
  {
    id: 'russia',
    name: 'Russia / Belarus',
    subtitle: 'FedEx suspended',
    chips: [
      { abbr: 'JP', tone: 'warn' },
      { abbr: 'FedEx', tone: 'danger' },
      { abbr: 'UPS', tone: 'gray' },
    ],
    blocks: [
      {
        label: 'FedEx',
        fullWidth: true,
        blockStyle: 'danger-bar',
        rows: [
          { key: 'Status', value: 'All FedEx International services SUSPENDED until further notice', tone: 'danger' },
        ],
      },
      {
        label: 'Alternatives',
        rows: [
          { key: 'Options', value: 'Japan Post (with caution) or UPS — verify status before shipping', tone: 'warn' },
        ],
      },
    ],
  },
];

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7 1.5L2.5 3.5v3c0 3 1.9 4.9 4.5 5.7C9.6 11.4 11.5 9.5 11.5 6.5v-3L7 1.5z" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5" />
      <line x1="3.5" y1="10.5" x2="10.5" y2="3.5" />
    </svg>
  );
}

export default function ShippingRules() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = DESTINATIONS.find(d => d.id === activeId) ?? null;

  function toggleCard(id: string) {
    setActiveId(prev => (prev === id ? null : id));
  }

  return (
    <div className="rules-section">

      {/* Global banners */}
      <div className="rules-banners">
        <div className="banner banner-warn">
          <ShieldIcon />
          <span>Insurance required on ALL orders ¥50,000+ — always use real value in Declared Value Coverage</span>
        </div>
        <div className="banner banner-danger">
          <BanIcon />
          <span>Never use these as goods description: <strong>cosmetics · medicine · food · drinks · toys</strong></span>
        </div>
      </div>

      {/* Section label */}
      <div className="section-label" style={{ marginTop: 18 }}>Select a destination</div>

      {/* Destination card grid */}
      <div className="dest-grid">
        {DESTINATIONS.map(dest => (
          <div
            key={dest.id}
            className={`dest-card${activeId === dest.id ? ' active' : ''}`}
            onClick={() => toggleCard(dest.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleCard(dest.id)}
          >
            <div className="dest-name">{dest.name}</div>
            <div className="dest-subtitle">{dest.subtitle}</div>
            <div className="dest-chips">
              {dest.chips.map((chip, i) => (
                <span key={i} className={`dest-chip chip-${chip.tone}`}>{chip.abbr}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Inline rules panel */}
      {active && (
        <div className="rules-panel">
          <div className="rules-panel-header">
            <span className="rules-panel-title">{active.name} — rules</span>
            <button className="rules-panel-close" onClick={() => setActiveId(null)} aria-label="Close rules panel">
              &#x2715;
            </button>
          </div>
          <div className="rules-block-grid">
            {active.blocks.map((block, bi) => (
              <div
                key={bi}
                className={[
                  'rule-block',
                  block.fullWidth ? 'full' : '',
                  block.blockStyle ?? '',
                ].filter(Boolean).join(' ')}
              >
                <div className="rule-block-label">{block.label}</div>
                {block.rows.map((row, ri) => (
                  <div key={ri} className="rule-row">
                    {row.key && <span className="rule-key">{row.key}</span>}
                    <span className={`rule-value${row.tone && row.tone !== 'neutral' ? ` rv-${row.tone}` : ''}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
