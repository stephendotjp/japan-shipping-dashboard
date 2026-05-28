'use client';

import { useState, useEffect, useRef } from 'react';

type Lang = 'en' | 'ja' | 'fr';
type CarrierStatus = 'ok' | 'warn' | 'no' | 'q';

interface Carrier { name: string; s: CarrierStatus; note: string; }
interface DestData { flagCode: string | null; name: string; region: string; carriers: Carrier[]; rules: string[]; notes: string; }

// ── Translations ──────────────────────────────────────────────────

interface Translation {
  title: string; subtitle: string; updated: string;
  carrierStatus: string; clickToChange: string;
  countryRules: string; clickToEdit: string;
  notes: string; clickNotesToEdit: string;
  addRule: string; notesPlaceholder: string; selectDest: string;
  back: string;
  search: string; filterAll: string; filterIssues: string; noResults: string;
  regions: Record<string, string>;
  sc: Record<CarrierStatus, { label: string; pillLabel: string }>;
  options: Record<CarrierStatus, string>;
}

const TRANSLATIONS: Record<Lang, Translation> = {
  en: {
    title: 'Japan shipping ops', subtitle: 'Carrier & destination guide',
    updated: 'Updated May 27, 2026',
    carrierStatus: 'Carrier status', clickToChange: 'Click status to change',
    countryRules: 'Country rules', clickToEdit: 'Click any rule to edit',
    notes: 'Notes', clickNotesToEdit: 'Click to edit',
    addRule: 'Add rule', notesPlaceholder: 'Add notes for this destination…',
    selectDest: 'Select a destination', back: '← Back',
    search: 'Search destinations…', filterAll: 'All', filterIssues: 'Issues only', noResults: 'No destinations match',
    regions: { 'North America': 'North America', 'Europe': 'Europe', 'Latin America': 'Latin America', 'Asia Pacific': 'Asia Pacific', 'Middle East': 'Middle East', 'Suspended': 'Suspended' },
    sc: {
      ok:   { label: 'OK',        pillLabel: 'Operational' },
      warn: { label: 'Caution',   pillLabel: 'Check before booking' },
      no:   { label: 'Suspended', pillLabel: 'Do not ship' },
      q:    { label: 'Monitor',   pillLabel: 'Monitor' },
    },
    options: { ok: 'OK', warn: 'Caution', no: 'Suspended', q: 'Monitor' },
  },
  ja: {
    title: '日本発送オペレーション', subtitle: '配送業者・配送先ガイド',
    updated: '2026年5月27日 更新',
    carrierStatus: '配送業者ステータス', clickToChange: 'クリックして変更',
    countryRules: '国別ルール', clickToEdit: 'クリックして編集',
    notes: 'メモ', clickNotesToEdit: 'クリックして編集',
    addRule: 'ルールを追加', notesPlaceholder: 'このあて先のメモを追加…',
    selectDest: '配送先を選択', back: '← 戻る',
    search: '配送先を検索…', filterAll: 'すべて', filterIssues: '問題あり', noResults: '一致する配送先なし',
    regions: { 'North America': '北米', 'Europe': 'ヨーロッパ', 'Latin America': 'ラテンアメリカ', 'Asia Pacific': 'アジア太平洋', 'Middle East': '中東', 'Suspended': '停止中' },
    sc: {
      ok:   { label: '正常',   pillLabel: '正常稼働' },
      warn: { label: '要注意', pillLabel: '要確認' },
      no:   { label: '停止',   pillLabel: '出荷不可' },
      q:    { label: '監視中', pillLabel: '監視中' },
    },
    options: { ok: '正常', warn: '要注意', no: '停止', q: '監視中' },
  },
  fr: {
    title: 'Ops expédition Japon', subtitle: 'Guide transporteur & destination',
    updated: 'Mis à jour le 27 mai 2026',
    carrierStatus: 'Statut transporteur', clickToChange: 'Cliquer pour modifier',
    countryRules: 'Règles par pays', clickToEdit: 'Cliquer pour modifier',
    notes: 'Notes', clickNotesToEdit: 'Cliquer pour modifier',
    addRule: 'Ajouter une règle', notesPlaceholder: 'Ajouter des notes pour cette destination…',
    selectDest: 'Sélectionner une destination', back: '← Retour',
    search: 'Rechercher…', filterAll: 'Tous', filterIssues: 'Problèmes', noResults: 'Aucune destination',
    regions: { 'North America': 'Amérique du Nord', 'Europe': 'Europe', 'Latin America': 'Amérique latine', 'Asia Pacific': 'Asie-Pacifique', 'Middle East': 'Moyen-Orient', 'Suspended': 'Suspendu' },
    sc: {
      ok:   { label: 'OK',        pillLabel: 'Opérationnel' },
      warn: { label: 'Attention', pillLabel: 'À vérifier avant' },
      no:   { label: 'Suspendu',  pillLabel: 'Ne pas expédier' },
      q:    { label: 'Surveiller', pillLabel: 'Surveiller' },
    },
    options: { ok: 'OK', warn: 'Attention', no: 'Suspendu', q: 'Surveiller' },
  },
};

// ── Static SC (CSS classes only — labels come from translations) ──

const SC_CSS: Record<CarrierStatus, { wrapCls: string; badgeCls: string; pillCls: string }> = {
  ok:   { wrapCls: 's-ok',   badgeCls: 'badge-ok',   pillCls: 'op-ok' },
  warn: { wrapCls: 's-warn', badgeCls: 'badge-warn', pillCls: 'op-warn' },
  no:   { wrapCls: 's-no',   badgeCls: 'badge-no',   pillCls: 'op-no' },
  q:    { wrapCls: 's-q',    badgeCls: 'badge-q',    pillCls: 'op-warn' },
};

const REGIONS: Array<{ label: string; ids: string[] }> = [
  { label: 'North America', ids: ['usa', 'canada', 'mexico'] },
  { label: 'Europe',        ids: ['uk', 'germany', 'france', 'spain', 'italy', 'benelux', 'sweden', 'norway', 'denmark', 'finland'] },
  { label: 'Latin America', ids: ['brazil', 'latam'] },
  { label: 'Asia Pacific',  ids: ['australia', 'newzealand', 'china', 'hongkong', 'korea', 'taiwan', 'singapore', 'malaysia', 'thailand', 'vietnam', 'philippines', 'indonesia', 'india', 'apac'] },
  { label: 'Middle East',   ids: ['israel', 'uae', 'saudi', 'qatar', 'kuwait', 'jordan', 'oman', 'bahrain', 'lebanon', 'iraq', 'yemen', 'syria'] },
  { label: 'Suspended',     ids: ['russia'] },
];

const INITIAL_DATA: Record<string, DestData> = {
  usa: {
    flagCode: 'us', name: 'USA', region: 'North America',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Limited resumption April 2026 — verify per item type.' },
      { name: 'FedEx',      s: 'warn', note: 'DDP only — confirm terms before booking.' },
      { name: 'UPS',        s: 'ok',   note: 'Operational.' },
      { name: 'DHL',        s: 'ok',   note: 'Operational.' },
    ],
    rules: ['FedEx USA: DDP required — never ship DAP', 'Declare full value — undervalue is auto-flagged', 'Japan Post: confirm acceptance per item type before booking'],
    notes: 'Japan Post availability to the US is inconsistent. Default to UPS or DHL unless JP is confirmed.',
  },
  canada: {
    flagCode: 'ca', name: 'Canada', region: 'North America',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Declare full value on all shipments', 'Goods over CAD $20 subject to duties and taxes'],
    notes: '',
  },
  mexico: {
    flagCode: 'mx', name: 'Mexico', region: 'North America',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — RFC or CURP required.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational — RFC or CURP required.' },
      { name: 'UPS',        s: 'ok', note: 'Operational — RFC or CURP required.' },
      { name: 'DHL',        s: 'ok', note: 'Operational — RFC or CURP required.' },
    ],
    rules: ['RFC required for business recipients (13 chars)', 'CURP required for individual recipients (18 chars)', 'Missing tax ID causes customs hold — collect at checkout', 'All four carriers require tax ID — no exceptions'],
    notes: 'Mexico is a high-volume destination. Collect RFC or CURP at checkout to avoid delays.',
  },
  uk: {
    flagCode: 'gb', name: 'UK', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Full value declaration required.' },
    ],
    rules: ['Post-Brexit: all shipments require HS commodity codes', 'DHL: full declared value mandatory', 'IOSS number required for B2C orders under £135'],
    notes: '',
  },
  germany: {
    flagCode: 'de', name: 'Germany', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Full declared value required on all carriers', 'IOSS number required for B2C orders under €150', 'Electronics: WEEE registration may be required'],
    notes: '',
  },
  france: {
    flagCode: 'fr', name: 'France', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['IOSS number required for B2C orders under €150', 'Full declared value on all shipments'],
    notes: '',
  },
  spain: {
    flagCode: 'es', name: 'Spain', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['IOSS number required for B2C orders under €150'],
    notes: 'Japan Post confirmed operational as of April 2026. Previously appeared on suspension lists — monitor JP advisory for changes.',
  },
  italy: {
    flagCode: 'it', name: 'Italy', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Codice Fiscale may be required for some shipments', 'IOSS number required for B2C orders under €150'],
    notes: 'Japan Post confirmed operational as of April 2026. Previously appeared on suspension lists — monitor JP advisory for changes.',
  },
  benelux: {
    flagCode: 'be', name: 'Belgium / Netherlands', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['IOSS number required for B2C orders under €150', 'Full declared value on all shipments'],
    notes: '',
  },
  sweden: {
    flagCode: 'se', name: 'Sweden', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['IOSS number required for B2C orders under €150', 'Declare full value — undervalue flagged at customs'],
    notes: '',
  },
  norway: {
    flagCode: 'no', name: 'Norway', region: 'Europe — non-EU',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Norway is outside the EU — IOSS does not apply', 'All goods subject to Norwegian customs and VAT', 'Shipments over NOK 350 subject to import duties'],
    notes: 'Norway processes customs independently. Do not apply EU IOSS to Norwegian orders.',
  },
  denmark: {
    flagCode: 'dk', name: 'Denmark', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['IOSS number required for B2C orders under €150', 'Full declared value on all shipments'],
    notes: '',
  },
  finland: {
    flagCode: 'fi', name: 'Finland', region: 'Europe',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['IOSS number required for B2C orders under €150', 'Full declared value on all shipments'],
    notes: '',
  },
  brazil: {
    flagCode: 'br', name: 'Brazil', region: 'Latin America',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — CPF or CNPJ required.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational — CPF or CNPJ required.' },
      { name: 'UPS',        s: 'ok', note: 'Operational — CPF or CNPJ required.' },
      { name: 'DHL',        s: 'ok', note: 'Operational — CPF or CNPJ required.' },
    ],
    rules: ['CPF required for individual recipients (11 digits)', 'CNPJ required for company recipients (14 digits)', 'Missing tax ID causes customs hold or return — collect at order time'],
    notes: 'Validate CPF/CNPJ format before submitting. Invalid numbers cause automatic rejection.',
  },
  latam: {
    flagCode: null, name: 'Latin America (other)', region: 'Latin America — excl. Brazil & Mexico',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — verify per country.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Check Japan Post advisory per country before booking', 'Some countries may require importer tax ID — confirm with carrier'],
    notes: 'Brazil and Mexico are listed separately due to mandatory tax ID requirements.',
  },
  australia: {
    flagCode: 'au', name: 'Australia', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Goods over AUD 1,000 subject to import duties and GST', 'Strict biosecurity — never ship food, plants, or animal products'],
    notes: '',
  },
  china: {
    flagCode: 'cn', name: 'China', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — all services confirmed (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok',   note: 'Operational.' },
      { name: 'UPS',        s: 'ok',   note: 'Operational.' },
      { name: 'DHL',        s: 'ok',   note: 'Operational.' },
    ],
    rules: ['Recipient ID number required for customs clearance', 'Restricted categories: cosmetics, supplements, electronics — verify before shipping', 'JP delays common — use courier for time-sensitive orders'],
    notes: 'China customs regulations change frequently. Confirm current requirements per shipment category.',
  },
  korea: {
    flagCode: 'kr', name: 'South Korea', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Personal customs clearance ID (PCCC) required for B2C shipments', 'Goods over KRW 150,000 subject to duties'],
    notes: '',
  },
  taiwan: {
    flagCode: 'tw', name: 'Taiwan', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Declare full value — customs checks declared vs. market value', 'Goods over TWD 2,000 may be subject to duties'],
    notes: '',
  },
  singapore: {
    flagCode: 'sg', name: 'Singapore', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational.' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['All imports over SGD 400 subject to GST', 'Chewing gum and certain goods prohibited — check restricted items list'],
    notes: '',
  },
  newzealand: {
    flagCode: 'nz', name: 'New Zealand', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Strict biosecurity — do not ship food, plants, or animal products', 'Goods over NZD 1,000 subject to customs duty and GST', 'Declare full value on all shipments'],
    notes: '',
  },
  hongkong: {
    flagCode: 'hk', name: 'Hong Kong', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['No import duty on most goods — one of the most open customs regimes', 'Full declared value required', 'Some items require permits — check restricted goods list for electronics/cosmetics'],
    notes: '',
  },
  malaysia: {
    flagCode: 'my', name: 'Malaysia', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Declare full value on all shipments', 'Food items: halal certification required for import', 'Goods over MYR 500 subject to customs duty and SST'],
    notes: '',
  },
  thailand: {
    flagCode: 'th', name: 'Thailand', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Cosmetics, supplements, and food items require Thai FDA approval to import', 'Declare full value — Thai customs compares declared vs. market value', 'Goods subject to customs duty; rate varies by HS code'],
    notes: '',
  },
  vietnam: {
    flagCode: 'vn', name: 'Vietnam', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Detailed commercial invoice required for all shipments', 'Recipient tax ID (MST) required for B2B shipments', 'Cosmetics and health products require Ministry of Health import approval', 'Goods subject to import duty and VAT — rate varies by category'],
    notes: '',
  },
  philippines: {
    flagCode: 'ph', name: 'Philippines', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['De minimis threshold PHP 10,000 — goods above subject to customs duty and VAT', 'Food and regulated items require prior import clearance from relevant agencies', 'Declare full value — Bureau of Customs actively audits declared values'],
    notes: '',
  },
  indonesia: {
    flagCode: 'id', name: 'Indonesia', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Recipient tax ID (NPWP) required for shipments over USD 75', 'Many product categories require import permits — verify before shipping', 'Strict labelling requirements for food, cosmetics, and electronics', 'Declare full value — customs scrutiny is high'],
    notes: 'Indonesia customs is among the most complex in APAC. Confirm import permit requirements for the specific product category before shipping.',
  },
  india: {
    flagCode: 'in', name: 'India', region: 'Asia Pacific',
    carriers: [
      { name: 'Japan Post', s: 'ok', note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'ok', note: 'Operational.' },
      { name: 'UPS',        s: 'ok', note: 'Operational.' },
      { name: 'DHL',        s: 'ok', note: 'Operational.' },
    ],
    rules: ['Import duty applies to most goods — rate varies by HS code', 'Electronics, supplements, and cosmetics may require BIS or FSSAI import licence', 'Recipient PAN or IEC number required for commercial shipments', 'Declare full value — undervaluation is aggressively flagged by Indian customs'],
    notes: 'Indian customs compliance requirements are complex and product-category specific. Verify applicable import regulations with the carrier before booking.',
  },
  apac: {
    flagCode: null, name: 'Asia Pacific (other)', region: 'Asia Pacific — excl. listed',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Partial — check JP advisory per country.' },
      { name: 'FedEx',      s: 'q',    note: 'Monitoring — verify before booking.' },
      { name: 'UPS',        s: 'q',    note: 'Monitoring — verify before booking.' },
      { name: 'DHL',        s: 'q',    note: 'Monitoring — verify before booking.' },
    ],
    rules: ['Always verify JP acceptance per country before booking', 'Carrier service levels vary significantly across this region'],
    notes: 'Status changes frequently. Check carrier advisory pages before booking.',
  },
  israel: {
    flagCode: 'il', name: 'Israel', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'International Priority (IP) only. Demand surcharge: JPY 485/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill — charged at DHL facility processing',
      'FedEx: International Priority (IP) service only — standard and economy not accepted',
      'FedEx demand surcharge: JPY 485 per volumetric kg',
    ],
    notes: 'DHL and FedEx available with surcharges from March 2026. FedEx limited to International Priority only. UPS suspended.',
  },
  uae: {
    flagCode: 'ae', name: 'UAE', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays expected — Dubai airport hub currently unavailable',
      'FedEx demand surcharge: JPY 226 per volumetric kg — avoid FedEx for time-sensitive shipments',
    ],
    notes: 'DHL is the recommended carrier. FedEx technically available but experiencing extreme delays due to Dubai hub disruption. Japan Post and UPS suspended.',
  },
  saudi: {
    flagCode: 'sa', name: 'Saudi Arabia', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: 'DHL recommended. FedEx available but extreme delays due to Dubai hub. Japan Post and UPS suspended.',
  },
  qatar: {
    flagCode: 'qa', name: 'Qatar', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: '',
  },
  kuwait: {
    flagCode: 'kw', name: 'Kuwait', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: '',
  },
  jordan: {
    flagCode: 'jo', name: 'Jordan', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: '',
  },
  oman: {
    flagCode: 'om', name: 'Oman', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — all services available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: '',
  },
  bahrain: {
    flagCode: 'bh', name: 'Bahrain', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: '',
  },
  lebanon: {
    flagCode: 'lb', name: 'Lebanon', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'ok',   note: 'Operational — Air, EMS, Parcels available (confirmed Apr 2026).' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Avoid for urgent shipments. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'FedEx: extreme delays — Dubai hub unavailable, avoid for urgent shipments',
      'FedEx demand surcharge: JPY 226 per volumetric kg',
    ],
    notes: '',
  },
  iraq: {
    flagCode: 'iq', name: 'Iraq', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'Listed as operational on JP advisory (Apr 2026) — verify acceptance before booking.' },
      { name: 'FedEx',      s: 'warn', note: 'Extreme delays — Dubai hub offline. Demand surcharge: JPY 226/vol. kg (eff. Mar 5, 2026).' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational with restrictions. Surcharge: JPY 5,000 per waybill + Restricted Destination Fee.' },
    ],
    rules: [
      'DHL: JPY 5,000 surcharge + additional Restricted Destination Fee per waybill',
      'Confirm DHL restricted destination fee amount before booking',
      'FedEx: extreme delays — Dubai hub offline; demand surcharge JPY 226/vol. kg',
    ],
    notes: 'DHL operates with an additional Restricted Destination Fee on top of the standard surcharge. Verify total fees with DHL before booking.',
  },
  yemen: {
    flagCode: 'ye', name: 'Yemen', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'no', note: 'Service suspended.' },
      { name: 'FedEx',      s: 'no', note: 'Service unavailable / unconfirmed — do not book.' },
      { name: 'UPS',        s: 'no', note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational with restrictions. Surcharge: JPY 5,000 per waybill + Restricted Destination Fee.' },
    ],
    rules: [
      'FedEx: service unavailable — do not accept FedEx orders for Yemen',
      'DHL: JPY 5,000 surcharge + Restricted Destination Fee per waybill',
      'Confirm DHL acceptance and fee amount before creating shipment',
    ],
    notes: 'FedEx unavailable. DHL available with restricted destination surcharge — confirm explicitly before booking.',
  },
  syria: {
    flagCode: 'sy', name: 'Syria', region: 'Middle East',
    carriers: [
      { name: 'Japan Post', s: 'no', note: 'Service suspended.' },
      { name: 'FedEx',      s: 'no', note: 'Service unavailable / unconfirmed — do not book.' },
      { name: 'UPS',        s: 'no', note: 'Service suspended.' },
      { name: 'DHL',        s: 'warn', note: 'Operational. Surcharge: JPY 5,000 per waybill (eff. March 2026).' },
    ],
    rules: [
      'FedEx: service unavailable — do not accept FedEx orders for Syria',
      'DHL: JPY 5,000 fixed surcharge per waybill (effective March 2026)',
      'Verify DHL acceptance before booking',
    ],
    notes: 'FedEx unavailable. DHL available with standard Middle East surcharge.',
  },
  russia: {
    flagCode: 'ru', name: 'Russia / Belarus', region: 'Eastern Europe',
    carriers: [
      { name: 'Japan Post', s: 'warn', note: 'JP advisory lists service as available (Apr 2026) — verify export compliance and sanctions before booking.' },
      { name: 'FedEx',      s: 'no',   note: 'Suspended indefinitely.' },
      { name: 'UPS',        s: 'no',   note: 'Service suspended.' },
      { name: 'DHL',        s: 'no',   note: 'Service suspended.' },
    ],
    rules: ['FedEx, UPS, DHL: all suspended — no exceptions', 'Japan Post: listed as operational on JP advisory — confirm export compliance and sanctions before accepting', 'Refund any orders where carrier cannot be confirmed'],
    notes: 'FedEx, DHL, UPS remain suspended. Japan Post appears to have resumed service (confirmed on JP advisory Apr 2026) but export control and sanctions compliance must be verified before booking.',
  },
};

// ── Flag image ────────────────────────────────────────────────────

function FlagImg({ code, w = 20 }: { code: string | null; w?: number }) {
  if (!code) {
    return (
      <svg viewBox="0 0 20 15" width={w} height={Math.round(w * 0.75)} aria-hidden="true">
        <rect width="20" height="15" rx="2" fill="#94a3b8" />
        <circle cx="10" cy="7.5" r="4" fill="none" stroke="white" strokeWidth="1.2" />
        <line x1="10" y1="3.5" x2="10" y2="11.5" stroke="white" strokeWidth="0.9" />
        <ellipse cx="10" cy="7.5" rx="2.2" ry="4" fill="none" stroke="white" strokeWidth="0.9" />
        <line x1="6" y1="7.5" x2="14" y2="7.5" stroke="white" strokeWidth="0.9" />
      </svg>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/w${w}/${code}.png`}
      srcSet={`https://flagcdn.com/w${w * 2}/${code}.png 2x`}
      width={w}
      alt={code.toUpperCase()}
      style={{ display: 'block', borderRadius: 2, height: 'auto' }}
    />
  );
}

// ── Carrier SVG logos ─────────────────────────────────────────────

const CARRIER_LOGOS: Record<string, React.ReactNode> = {
  'Japan Post': (
    <svg viewBox="0 0 72 18" width="72" height="18" aria-hidden="true">
      <rect width="72" height="18" rx="2" fill="#E60012" />
      <text x="36" y="13" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700"
        fontFamily="system-ui, Arial, sans-serif" letterSpacing="0.6">JAPAN POST</text>
    </svg>
  ),
  'FedEx': (
    <svg viewBox="0 0 50 18" width="50" height="18" aria-hidden="true">
      <text x="1" y="14" fill="#4D148C" fontSize="15" fontWeight="800"
        fontFamily="system-ui, Arial, sans-serif">Fed</text>
      <text x="28" y="14" fill="#FF6600" fontSize="15" fontWeight="800"
        fontFamily="system-ui, Arial, sans-serif">Ex</text>
    </svg>
  ),
  'UPS': (
    <svg viewBox="0 0 36 18" width="36" height="18" aria-hidden="true">
      <rect width="36" height="18" rx="2" fill="#351C15" />
      <text x="18" y="13" textAnchor="middle" fill="#FFB500" fontSize="10" fontWeight="700"
        fontFamily="system-ui, Arial, sans-serif" letterSpacing="1.5">UPS</text>
    </svg>
  ),
  'DHL': (
    <svg viewBox="0 0 36 18" width="36" height="18" aria-hidden="true">
      <rect width="36" height="18" rx="2" fill="#FFCC00" />
      <text x="18" y="13" textAnchor="middle" fill="#D40511" fontSize="10" fontWeight="700"
        fontFamily="system-ui, Arial, sans-serif" letterSpacing="1.5">DHL</text>
    </svg>
  ),
};

// ── Carrier country URL lookup ────────────────────────────────────

function getCarrierUrl(carrierName: string, flagCode: string | null): string | null {
  if (carrierName === 'Japan Post') {
    // JP advisory page: sending FROM Japan to all destinations
    return 'https://www.post.japanpost.jp/service/send/oversea/information/overview.html';
  }
  if (!flagCode) return null;
  if (carrierName === 'DHL') {
    // Destination country's DHL Express import page (receiving DHL shipments into that country)
    return `https://www.dhl.com/${flagCode}-en/home/express/import.html`;
  }
  if (carrierName === 'FedEx') {
    // Destination country's FedEx international shipping page, English version
    return `https://www.fedex.com/en-${flagCode}/shipping/international.html`;
  }
  if (carrierName === 'UPS') {
    // Destination country's UPS international shipping page, English version
    return `https://www.ups.com/${flagCode}/en/shipping/international.page`;
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────

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
  t: Translation;
  onCarrierStatus: (ci: number, val: CarrierStatus) => void;
  onCarrierNote:   (ci: number, val: string) => void;
  onRuleChange:    (ri: number, val: string) => void;
  onAddRule:       () => void;
  onDeleteRule:    (ri: number) => void;
  onNotesChange:   (val: string) => void;
}

function DestDetail({ dest, t, onCarrierStatus, onCarrierNote, onRuleChange, onAddRule, onDeleteRule, onNotesChange }: DetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(autoResize);
  }, []);

  const ov = overallStatus(dest.carriers);

  return (
    <div className="dp" ref={containerRef}>
      <div className="dest-heading">
        <span className="dest-flag-lg">
          <FlagImg code={dest.flagCode} w={40} />
        </span>
        <div>
          <div className="dest-name">{dest.name}</div>
          <div className="dest-region-sub">{dest.region}</div>
        </div>
        <span className={`overall-pill ${SC_CSS[ov].pillCls}`}>{t.sc[ov].pillLabel}</span>
      </div>

      <div className="sec-block">
        <div className="sec-head">
          <span>{t.carrierStatus}</span>
          <span className="edit-hint">{t.clickToChange}</span>
        </div>
        <table className="carrier-table">
          <tbody>
            {dest.carriers.map((c, ci) => {
              const infoUrl = c.s !== 'no' ? getCarrierUrl(c.name, dest.flagCode) : null;
              return (
                <tr key={ci}>
                  <td className="ct-logo">
                    {CARRIER_LOGOS[c.name] ?? <span className="ct-name-fallback">{c.name}</span>}
                    <span className="sr-only">{c.name}</span>
                  </td>
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
                    <div className={`status-select-wrap ${SC_CSS[c.s].wrapCls}`}>
                      <div className="status-dot" />
                      <select
                        className="status-select"
                        value={c.s}
                        onChange={e => onCarrierStatus(ci, e.target.value as CarrierStatus)}
                      >
                        <option value="ok">{t.options.ok}</option>
                        <option value="warn">{t.options.warn}</option>
                        <option value="no">{t.options.no}</option>
                        <option value="q">{t.options.q}</option>
                      </select>
                      <span className="chevron-icon" aria-hidden="true">▾</span>
                    </div>
                  </td>
                  <td className="ct-link">
                    {infoUrl && (
                      <a href={infoUrl} target="_blank" rel="noopener noreferrer" className="carrier-link-btn" title={`${c.name} — ${dest.name}`}>
                        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4.5 2H1.5A.5.5 0 0 0 1 2.5v6A.5.5 0 0 0 1.5 9h6A.5.5 0 0 0 8 8.5V6" />
                          <polyline points="6.5,1 9,1 9,3.5" />
                          <line x1="9" y1="1" x2="5" y2="5" />
                        </svg>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sep" />

      <div className="sec-block">
        <div className="sec-head">
          <span>{t.countryRules}</span>
          <span className="edit-hint">{t.clickToEdit}</span>
        </div>
        <div className="rules-list">
          {dest.rules.map((r, ri) => (
            <div key={ri} className="rule-item">
              <span className="rule-icon" aria-hidden="true">•</span>
              <textarea
                className="rule-text"
                rows={1}
                value={r}
                onChange={e => { onRuleChange(ri, e.target.value); autoResize(e.target); }}
              />
              <button className="rule-del" onClick={() => onDeleteRule(ri)} aria-label="Delete rule">✕</button>
            </div>
          ))}
        </div>
        <button className="add-rule-btn" onClick={onAddRule}>
          <span aria-hidden="true">+</span>
          {t.addRule}
        </button>
      </div>

      <div className="sep" />

      <div className="sec-block">
        <div className="sec-head">
          <span>{t.notes}</span>
          <span className="edit-hint">{t.clickNotesToEdit}</span>
        </div>
        <textarea
          className="notes-area"
          placeholder={t.notesPlaceholder}
          value={dest.notes}
          onChange={e => { onNotesChange(e.target.value); autoResize(e.target); }}
        />
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<Record<string, DestData>>(() => {
    try {
      const saved = localStorage.getItem('japan-shipping-data');
      if (saved) return { ...INITIAL_DATA, ...JSON.parse(saved) };
    } catch {}
    return INITIAL_DATA;
  });

  useEffect(() => {
    try { localStorage.setItem('japan-shipping-data', JSON.stringify(data)); } catch {}
  }, [data]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [search, setSearch] = useState('');
  const [issuesOnly, setIssuesOnly] = useState(false);

  const t = TRANSLATIONS[lang];

  const searchLower = search.toLowerCase().trim();
  const visibleRegions = REGIONS.map(region => ({
    ...region,
    ids: region.ids.filter(id => {
      const d = data[id];
      const matchesSearch = !searchLower || d.name.toLowerCase().includes(searchLower);
      const matchesFilter = !issuesOnly || ['warn', 'no', 'q'].includes(overallStatus(d.carriers));
      return matchesSearch && matchesFilter;
    }),
  })).filter(region => region.ids.length > 0);

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
          <div className="hdr-title">{t.title}</div>
          <div className="hdr-sub">{t.subtitle}</div>
        </div>
        <div className="hdr-right">
          <div className="updated">{t.updated}</div>
          <div className="lang-toggle">
            {(['en', 'ja', 'fr'] as Lang[]).map(l => (
              <button
                key={l}
                className={`lang-btn${lang === l ? ' active' : ''}`}
                onClick={() => setLang(l)}
              >
                {l === 'en' ? 'EN' : l === 'ja' ? '日本語' : 'FR'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`body${mobileView === 'detail' ? ' body--detail' : ''}`}>
        <div className="sidebar">
          <div className="sidebar-search">
            <input
              className="search-input"
              type="search"
              placeholder={t.search}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="filter-row">
              <button
                className={`filter-btn${!issuesOnly ? ' active-all' : ''}`}
                onClick={() => setIssuesOnly(false)}
              >{t.filterAll}</button>
              <button
                className={`filter-btn${issuesOnly ? ' active-issues' : ''}`}
                onClick={() => setIssuesOnly(true)}
              >{t.filterIssues}</button>
            </div>
          </div>
          <div className="dest-list">
            {visibleRegions.length === 0 && (
              <div className="no-results">{t.noResults}</div>
            )}
            {visibleRegions.map(region => (
              <div key={region.label}>
                <div className="region-label">{t.regions[region.label] ?? region.label}</div>
                {region.ids.map(id => {
                  const d = data[id];
                  const ov = overallStatus(d.carriers);
                  return (
                    <button
                      key={id}
                      className={`dest-btn${currentId === id ? ' active' : ''}`}
                      onClick={() => { setCurrentId(id); setMobileView('detail'); }}
                    >
                      <span className="dflag"><FlagImg code={d.flagCode} w={20} /></span>
                      <span className="dname">{d.name}</span>
                      <span className={`dbadge ${SC_CSS[ov].badgeCls}`}>{t.sc[ov].label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="detail">
          <button className="back-btn" onClick={() => setMobileView('list')}>{t.back}</button>
          {currentId ? (
            <DestDetail
              key={currentId}
              dest={data[currentId]}
              t={t}
              onCarrierStatus={(ci, val) => handleCarrierStatus(currentId, ci, val)}
              onCarrierNote={(ci, val) => handleCarrierNote(currentId, ci, val)}
              onRuleChange={(ri, val) => handleRuleChange(currentId, ri, val)}
              onAddRule={() => handleAddRule(currentId)}
              onDeleteRule={ri => handleDeleteRule(currentId, ri)}
              onNotesChange={val => handleNotesChange(currentId, val)}
            />
          ) : (
            <div className="placeholder">
              <p>{t.selectDest}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
