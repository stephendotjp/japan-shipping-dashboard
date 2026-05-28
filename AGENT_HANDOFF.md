# Japan Shipping Dashboard — Agent Handoff

This document gives a complete picture of the project so you can make changes confidently without rediscovering anything from scratch.

---

## What This Is

A shipping operations reference dashboard for a warehouse team that ships internationally from Japan. Operators use it to check carrier availability, country-specific rules, surcharges, and restrictions before booking shipments.

**Live URL:** https://japan-shipping-dashboard.vercel.app  
**GitHub:** https://github.com/stephendotjp/japan-shipping-dashboard  
**Vercel project:** `japan-shipping-dashboard` under account `shaolinmonkuk-7580s-projects`

### Important: Architecture Changed

The project was originally an AI-scraped live status monitor (Firecrawl + Claude + Vercel KV). That system was intentionally dropped. The current dashboard is a **fully static, manually-maintained carrier guide** — no backend, no scraping, no database. All data lives in `ClientDashboard.tsx` as `INITIAL_DATA`. API routes and lib files from the old system remain in the repo but are not wired into the current UI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Plain CSS with custom properties — no Tailwind, no CSS modules |
| Fonts | IBM Plex Sans + IBM Plex Mono via `next/font/google` |
| Deployment | Vercel (auto-deploy from `master` push to GitHub) |

---

## Repository Layout

```
/
├── app/
│   ├── layout.tsx              # Root layout — IBM Plex fonts, viewport meta export
│   ├── globals.css             # All styles — design tokens, layout, components
│   ├── page.tsx                # Entry point — just renders <ClientDashboard />
│   └── ClientDashboard.tsx     # ★ The entire dashboard — all data, logic, and UI
├── AGENT_HANDOFF.md            # This file
├── Middle East Shipping Surcharge List (DHL & FedEx) V1.pdf
│                               # Source PDF used to populate Middle East surcharge data
└── [legacy — not wired into current UI]
    ├── app/admin/              # Old admin panel (scrape trigger, history)
    ├── app/api/                # Old API routes (status, matrix, scrape, health)
    ├── lib/                    # Old scraping + AI parsing + KV helpers
    └── components/
        ├── CarrierCard.tsx     # Old compact carrier card (not rendered)
        ├── RoutingMatrix.tsx   # Old AI-derived routing matrix (not rendered)
        └── Globe.tsx           # D3 world map, never rendered — safe to delete
```

---

## The Dashboard: ClientDashboard.tsx

Everything lives in `app/ClientDashboard.tsx`. It is a single `'use client'` React component with no external data fetching.

### Data Model

```typescript
type CarrierStatus = 'ok' | 'warn' | 'no' | 'q'

interface Carrier {
  name: string        // 'Japan Post' | 'FedEx' | 'UPS' | 'DHL'
  s: CarrierStatus
  note: string        // operator-facing note about this carrier for this country
}

interface DestData {
  flagCode: string | null   // ISO 3166-1 alpha-2 (e.g. 'us', 'gb') — null for catch-alls
  name: string
  region: string
  carriers: Carrier[]       // always 4 carriers in order: Japan Post, FedEx, UPS, DHL
  rules: string[]           // country-specific shipping rules (editable inline)
  notes: string             // general notes for this destination (editable inline)
}
```

All destination data is in the `INITIAL_DATA` constant (~600 lines). All edits in the UI are in-memory only — refreshing the page resets everything. There is no persistence layer.

### Regions and Countries

| Region | Country IDs |
|---|---|
| North America | `usa`, `canada`, `mexico` |
| Europe | `uk`, `germany`, `france`, `spain`, `italy`, `benelux`, `sweden`, `norway`, `denmark`, `finland` |
| Latin America | `brazil`, `latam` (catch-all) |
| Asia Pacific | `australia`, `newzealand`, `china`, `hongkong`, `korea`, `taiwan`, `singapore`, `malaysia`, `thailand`, `vietnam`, `philippines`, `indonesia`, `india`, `apac` (catch-all) |
| Middle East | `israel`, `uae`, `saudi`, `qatar`, `kuwait`, `jordan`, `oman`, `bahrain`, `lebanon`, `iraq`, `yemen`, `syria` |
| Suspended | `russia` |

`benelux` covers Belgium + Netherlands (flagCode: `be`).  
`latam` and `apac` are catch-all entries with `flagCode: null`.

### Carrier Status Values

| Value | Meaning | Badge colour |
|---|---|---|
| `ok` | Operational | Green |
| `warn` | Issues / surcharges / delays | Amber |
| `no` | Suspended | Red |
| `q` | Monitor — verify before booking | Amber |

### Overall Status Logic (`overallStatus()`)

Takes the worst of all 4 carrier statuses for a destination:
- Any `no` → `no`
- Any `warn` or `q` → `warn`
- All `ok` → `ok`

Used for sidebar badges and the detail panel pill.

### UI Layout

```
.dash (flex column, 100dvh on mobile / 100vh on desktop)
  ├── .hdr — title, subtitle, updated date (hidden on mobile), language toggle
  └── .body (flex row desktop / flex column mobile)
        ├── .sidebar — scrollable destination list with region labels + status badges
        └── .detail — selected destination detail panel
              ├── back button (mobile only, sticky)
              ├── dest-heading — flag, name, region, overall pill
              ├── carrier table — logo | editable note | status dropdown | external link
              ├── country rules — editable inline list
              └── notes — editable textarea
```

### Mobile Responsive Behaviour

- Breakpoint: `767px` (max-width)
- Mobile: only one panel visible at a time
- `mobileView` state: `'list' | 'detail'` (default `'list'`)
- Tapping a country sets `currentId` + `setMobileView('detail')` → adds `.body--detail` class on `.body`
- `.body--detail` hides `.sidebar` and shows `.detail` via CSS
- Back button (`← Back`) is sticky at top of `.detail` on mobile, hidden (`display: none`) on desktop
- Uses `100dvh` on mobile to handle browser address bar correctly
- Touch targets: `.dest-btn` has `min-height: 44px` on mobile

### Carrier External Link Buttons

Each carrier row has a small external link icon (↗) that opens the carrier's official country page in a new tab. Defined by `getCarrierUrl(carrierName, flagCode)`:

| Carrier | URL pattern |
|---|---|
| Japan Post | `https://www.post.japanpost.jp/service/send/oversea/information/overview.html` (same for all) |
| DHL | `https://www.dhl.com/{cc}-en/home/express/import.html` |
| FedEx | `https://www.fedex.com/en-{cc}/shipping/international.html` |
| UPS | `https://www.ups.com/{cc}/en/shipping/international.page` |

`{cc}` = `flagCode` (ISO 3166-1 alpha-2). Links only rendered when `flagCode` is non-null and carrier status is not `no`. Japan Post always shows a link (even for catch-alls) because its URL is a single global overview page.

### Language Toggle

Three languages: `en`, `ja`, `fr`. `TRANSLATIONS` object covers all UI strings including region names. Country names come from `INITIAL_DATA` and are not translated (they're proper nouns).

### Flag Images

`FlagImg` component fetches from `flagcdn.com/w{w}/{code}.png` with 2x srcSet. Key fix: no `height` attribute is set on the `<img>` — the browser renders at the natural aspect ratio. (Previously had `height={Math.round(w * 0.75)}` which distorted flags that aren't 4:3.)

---

## CSS Architecture (`globals.css`)

No framework. All styles in one file. Key structure:

```
:root { CSS custom properties }
reset
.dash, .hdr, .hdr-right, .body     — shell layout
.sidebar, .dest-list, .dest-btn     — country list
.detail, .placeholder, .dp          — detail panel
.dest-heading, .overall-pill        — destination header
.carrier-table, .ct-*               — carrier table columns
.status-select-wrap, .status-dot    — status dropdown pill
.carrier-link-btn                   — external link button
.rules-list, .rule-item, .rule-text — rules section
.notes-area                         — notes textarea
.lang-toggle, .lang-btn             — language switcher
.back-btn                           — mobile back button
@media (max-width: 767px) { ... }   — all mobile overrides
```

---

## Data Sources

### Japan Post
Official service availability: `https://www.post.japanpost.jp/service/send/oversea/information/overview.html`  
Last checked: **April 14, 2026**  
Use this URL to verify/update Japan Post statuses. The table uses ○ / △ / × symbols per service type (Air, EMS, Parcels, SAL, Sea).

### Middle East Surcharges
Source: **`Middle East Shipping Surcharge List (DHL & FedEx) V1.pdf`** (in project root)  
Effective: March 2026  
Key facts:
- DHL: JPY 5,000 fixed per waybill for all Middle East countries; Iraq + Yemen have additional Restricted Destination Fee
- FedEx: Demand surcharge per volumetric kg (JPY 485 for Israel, JPY 226 for all others)
- FedEx Dubai hub offline → extreme delays for UAE, Saudi, Qatar, Kuwait, Jordan, Oman, Bahrain, Lebanon, Iraq
- FedEx unavailable to Yemen and Syria
- UPS and Japan Post: see JP advisory above

---

## Country Notes by Region

### Middle East — key per-country status summary

| Country | Japan Post | DHL | FedEx | UPS |
|---|---|---|---|---|
| Israel | ok | warn (+surcharge) | warn (IP only, +surcharge) | no |
| UAE | ok | warn (+surcharge) | warn (delays + surcharge) | no |
| Saudi Arabia | ok | warn (+surcharge) | warn (delays + surcharge) | no |
| Qatar / Kuwait / Jordan / Oman / Bahrain / Lebanon | ok | warn (+surcharge) | warn (delays + surcharge) | no |
| Iraq | warn (verify first) | warn (+surcharge + restricted fee) | warn (delays + surcharge) | no |
| Yemen | no | warn (+surcharge + restricted fee) | no | no |
| Syria | no | warn (+surcharge) | no | no |

### Russia / Belarus
- Japan Post: `warn` — JP advisory lists service as available (Apr 2026) but **export compliance and sanctions must be verified** before booking. FedEx/DHL/UPS remain suspended indefinitely.

### Spain / Italy
- Japan Post previously appeared on suspension lists. Confirmed `ok` as of April 2026. Monitor JP advisory for changes.

### China
- Japan Post confirmed `ok` (all services) as of April 2026.

---

## Deployment

GitHub `master` → Vercel auto-deploys to production. No CI steps.

```bash
# deploy = just push
git add -A && git commit -m "..." && git push
```

No environment variables needed for the current static dashboard. The old env vars (Firecrawl, Anthropic, KV) in Vercel are remnants of the previous architecture and don't affect anything.

---

## Local Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

No `.env.local` needed. The current dashboard has no API calls or env dependencies.

---

## Things to Know / Watch Out For

- **All edits are in-memory.** Carrier status changes, rule edits, and note edits in the UI reset on page refresh. If you want persistence, a backend (KV or similar) needs to be wired back in.
- **Carrier link URLs may 404 for restricted/uncommon markets.** DHL/FedEx/UPS country sites don't exist for every destination (e.g. Yemen, Syria). Links are hidden for `no`-status carriers to reduce this. For `warn` countries in restricted regions, a 404 is possible but acceptable.
- **Jordan, Bahrain, Lebanon JP statuses** were set to `ok` based on JP website but the JP advisory page was truncated when checked. Worth re-verifying manually.
- **The `apac` and `latam` catch-all entries** remain for countries not individually listed. They have `flagCode: null` so DHL/FedEx/UPS links don't appear for them.
- **Middle East surcharge data from the PDF** is effective March 2026. FedEx Dubai hub situation should be rechecked periodically.
- **Russia JP status** was updated to `warn` because the JP website showed service available, but this is a sensitive area — always verify sanctions/export compliance before treating it as bookable.

---

## Recent Changes (May 2026)

| Commit | Change |
|---|---|
| `e72c558` | Fixed carrier links to point at shipping-TO pages (DHL import page, FedEx/UPS international pages in English) |
| `e2fb028` | Added carrier external link buttons (↗ icon) to each carrier table row |
| `e4c96d2` | Added 8 new APAC countries (HK, India, Thailand, Vietnam, Philippines, Malaysia, Indonesia, NZ); updated Jordan/Bahrain/Lebanon/Russia JP statuses |
| `de470ad` | Updated Japan Post statuses from official JP advisory: Spain/Italy/China → ok; Israel/UAE/Saudi/Qatar/Kuwait/Oman → ok; Iraq → warn |
| `613fca5` | Expanded Middle East from 1 catch-all to 12 individual countries (from DHL/FedEx surcharge PDF); fixed flag aspect ratios |
| `2ad9696` | Made dashboard fully mobile responsive (sidebar-only on mobile, tap country → full-screen detail, sticky back button, `100dvh`, 44px touch targets) |
