# Japan Shipping Status Dashboard — Agent Handoff

This document gives a complete picture of the project so you can make changes confidently without rediscovering anything from scratch.

---

## What This Is

A real-time shipping status dashboard for a warehouse operations team. It monitors four international carriers (Japan Post, FedEx, UPS, DHL) for service disruptions affecting shipments from Japan. Designed to be displayed on a large TV screen — shipping agents glance at it to know which carriers and destinations are safe to use.

**Live URL:** https://japan-shipping-dashboard.vercel.app  
**GitHub:** https://github.com/stephendotjp/japan-shipping-dashboard  
**Vercel project:** `japan-shipping-dashboard` under account `shaolinmonkuk-7580s-projects`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Scraping | Firecrawl API (REST, no SDK) |
| AI parsing | Anthropic SDK — `claude-sonnet-4-20250514` |
| Database | Vercel KV (Upstash Redis REST) via `@vercel/kv` |
| Scheduling | Vercel Cron Jobs (free tier, 2 jobs) |
| Fonts | IBM Plex Sans + IBM Plex Mono (Google Fonts via `next/font`) |
| Deployment | Vercel (free tier) |

> Note: `@vercel/kv` is deprecated (Vercel moved to direct Upstash integration) but still works. Migration to `@upstash/redis` is a drop-in if needed.

> Note: `Globe.tsx` still exists in the repo but is **not rendered** in the current dashboard. It can be deleted safely.

---

## Repository Layout

```
/
├── app/
│   ├── layout.tsx              # IBM Plex font loading, metadata
│   ├── globals.css             # Full CSS design system — vars, component classes, modal
│   ├── page.tsx                # Server component — fetches KV data, renders ClientDashboard
│   ├── ClientDashboard.tsx     # Client component — layout, polling, clock, alerts
│   ├── admin/
│   │   └── page.tsx            # Debug panel (no auth) — scrape history, trigger button
│   └── api/
│       ├── status/route.ts     # GET — all carrier statuses + stale detection
│       ├── matrix/route.ts     # GET/POST — manager matrix overrides (KV key: matrix:overrides)
│       ├── scrape/route.ts     # POST/GET — cron-triggered scrape (auth required)
│       ├── health/route.ts     # GET — uptime + per-carrier last success
│       └── admin/
│           ├── history/route.ts  # GET ?carrier=X — scrape history for admin panel
│           └── trigger/route.ts  # POST — unauthenticated admin scrape trigger
├── lib/
│   ├── db.ts                   # All Vercel KV read/write helpers + TypeScript types
│   ├── parser.ts               # Claude AI parsing (markdown → structured JSON)
│   └── scrapers/
│       ├── index.ts            # Orchestrator: runs all 4, bot-block detection
│       ├── japanpost.ts
│       ├── fedex.ts
│       ├── ups.ts
│       └── dhl.ts
├── components/
│   ├── CarrierCard.tsx         # Compact carrier status card (strip format)
│   ├── RoutingMatrix.tsx       # Per-destination × per-carrier status table (editable)
│   └── Globe.tsx               # Flat D3 SVG world map — NOT currently rendered
└── vercel.json                 # Cron schedule config
```

---

## Environment Variables

Set in Vercel Dashboard → Settings → Environment Variables (Production).

| Variable | Value / Source |
|---|---|
| `FIRECRAWL_API_KEY` | fc-b8c61ed0af3f463299bd24ba5d049837 |
| `ANTHROPIC_API_KEY` | sk-ant-api03-... (console.anthropic.com) |
| `CRON_SECRET` | 9cdf698b619b1d818fe1b453d881498d1c78342942a9ae4f71b78114d01090ac |
| `NEXT_PUBLIC_APP_URL` | https://japan-shipping-dashboard.vercel.app |
| `KV_REST_API_URL` | https://smiling-bedbug-106606.upstash.io |
| `KV_REST_API_TOKEN` | gQAAAAAAAaBuAAIg... (Upstash dashboard) |

For local dev, create `.env.local` with these values and run `npm run dev`.

---

## How the Data Pipeline Works

```
Vercel Cron (2×/day)
        │
        ▼
POST /api/scrape  ─── auth check (x-vercel-cron header OR CRON_SECRET)
        │
        ├── Firecrawl API ──► japanpost.jp  (markdown)
        ├── Firecrawl API ──► fedex.com     (markdown)
        ├── Firecrawl API ──► ups.com       (markdown)   } Promise.allSettled
        └── Firecrawl API ──► dhl.com       (markdown)
                │
                ▼ (per carrier, in parallel)
        Bot-block detection
        (checks for: "captcha", "cloudflare", "access denied", "403", "enable javascript")
                │
                ▼ (if clean)
        Claude AI parsing
        (lib/parser.ts → claude-sonnet-4-20250514 → structured JSON)
                │
                ▼
        Vercel KV write
        ├── status:{carrier}         ← only written on SUCCESS
        └── scrape:history:{carrier} ← always written (success or failure)
        + scrape:lastRun / scrape:nextRun
```

**Important rules:**
- On a failed scrape → history is updated, but `status:{carrier}` is NOT overwritten. Old data persists.
- On bot block → `bot_blocked: true` in history, status preserved.
- Claude responses are trimmed to 8000 chars, JSON fences stripped, wrapped in try/catch. Parse failures write `{ error: "parse_failed" }` to history but preserve the last good status.

---

## Cron Schedule

Defined in `vercel.json`:

```json
{ "path": "/api/scrape", "schedule": "0 21 * * *" }  // 06:00 JST
{ "path": "/api/scrape", "schedule": "0 9 * * *" }   // 18:00 JST
```

Vercel cron sends a **GET** request (not POST) so `/api/scrape` handles both GET and POST by routing GET → POST handler. Auth check passes when the `x-vercel-cron: 1` header is present.

---

## Vercel KV Schema

| Key | Type | Notes |
|---|---|---|
| `status:japanpost` | ParsedStatus JSON | Only written on successful parse |
| `status:fedex` | ParsedStatus JSON | Same |
| `status:ups` | ParsedStatus JSON | Same |
| `status:dhl` | ParsedStatus JSON | Same |
| `scrape:history:japanpost` | HistoryEntry[] (max 10) | Prepended on every run |
| `scrape:history:fedex` | HistoryEntry[] | Same |
| `scrape:history:ups` | HistoryEntry[] | Same |
| `scrape:history:dhl` | HistoryEntry[] | Same |
| `scrape:lastRun` | ISO timestamp string | Updated after each full scrape |
| `scrape:nextRun` | ISO timestamp string | Set to next 09:00 or 21:00 UTC |
| `matrix:overrides` | `{ cells: Record<string, DotStatus>, notes: Record<string, string> }` | Manager overrides for the routing matrix |

### `matrix:overrides` structure

```json
{
  "cells": {
    "japanpost:Middle East": "no",
    "fedex:Russia / Belarus": "no",
    "ups:USA / Canada": "ok"
  },
  "notes": {
    "Middle East": "Cleared by ops team — resume DHL only",
    "Russia / Belarus": "All carriers suspended per compliance"
  }
}
```

Cell keys are `"{carrier}:{regionName}"`. A missing cell key means "Auto (AI-derived)" for that cell. Notes keys are region names and apply to the whole row regardless of carrier.

---

## ParsedStatus Shape

This is the structure Claude returns and what gets stored in KV:

```typescript
{
  carrier: string,
  usDestinationStatus: "operational" | "partial" | "suspended" | "unknown",
  japanOriginStatus:   "operational" | "partial" | "suspended" | "unknown",
  allClear: boolean,
  activeAlerts: [{ title: string, description: string, severity: "info"|"warning"|"critical" }],
  rawSummary: string,
  confidence: "high" | "medium" | "low",
  scrapedContentLength: number,
  updatedAt: string  // ISO UTC, added by lib/parser.ts after Claude returns
}
```

---

## Scrape Targets

| Carrier | URL |
|---|---|
| Japan Post | https://www.post.japanpost.jp/int/information/index_en.html |
| FedEx | https://www.fedex.com/en-us/service-alerts.html |
| UPS | https://www.ups.com/us/en/service-alerts.page |
| DHL | https://www.dhl.com/us-en/home/our-divisions/parcel/business-customers/shipping/service-updates.html |

Firecrawl free tier = 500 credits/month. 4 carriers × 2 runs/day × 30 days = ~240 credits/month. Headroom exists for manual triggers.

If Firecrawl returns a 429, switch `lib/scrapers/index.ts` from `Promise.allSettled` to sequential with a 1-second delay between each call.

---

## API Routes Reference

### `GET /api/status`
Returns all carrier data for the dashboard. Marks data as `stale: true` if older than 13 hours.

```json
{
  "lastUpdated": "ISO",
  "nextUpdate": "ISO",
  "carriers": {
    "japanpost": { ...ParsedStatus, "stale": false, "staleSince": null },
    "fedex": null
  }
}
```

### `GET /api/matrix`
Returns the manager's routing matrix overrides from KV. Returns `{ cells: {}, notes: {} }` if nothing has been saved yet.

### `POST /api/matrix`
Saves the full `{ cells, notes }` object to KV. The client always sends the complete object (not a patch) — no merge logic on the server. Body must be `Content-Type: application/json`.

### `POST /api/scrape` (also `GET`)
Protected — requires `x-vercel-cron: 1` header (Vercel) or `Authorization: Bearer {CRON_SECRET}`.  
Runs all 4 scrapers in parallel, parses with Claude, writes to KV.  
`export const maxDuration = 60` is set on this route.

### `GET /api/health`
Uptime (seconds since cold start), last scrape timestamp, per-carrier last success.

### `GET /api/admin/history?carrier=X`
Returns the last 10 scrape history entries for carrier X. Used by admin panel.

### `POST /api/admin/trigger`
No authentication. Runs the same scrape logic as `/api/scrape`. This is the button in the admin panel. Safe to expose because the admin page has no auth by design (beta).

---

## UI Design System

**Philosophy:** Compact industrial ops monitor. Clean, minimal, professional. Readable at a distance on a large TV screen.

### CSS Custom Properties (`app/globals.css`)

```css
--font-sans: 'IBM Plex Sans', system-ui, sans-serif;
--font-mono: 'IBM Plex Mono', monospace;
--color-background-primary: #ffffff;
--color-background-secondary: #f4f4f5;
--color-border-secondary: #e4e4e7;
--color-border-tertiary: rgba(0, 0, 0, 0.07);
--color-text-primary: #18181b;
--color-text-secondary: #71717a;
--color-text-tertiary: #a1a1aa;
--border-radius-md: 8px;
```

Body background: `#e8e8ea`. Max content width: 1500px centered.

### Status Colors

| Status | Background | Text | Usage |
|---|---|---|---|
| ok / operational | `#dcfce7` | `#15803d` | Green |
| partial / warn | `#fef3c7` | `#92400e` | Amber |
| no / suspended | `#fee2e2` | `#991b1b` | Red |
| unknown | `#f1f5f9` | `#475569` | Slate |

### Font Sizes (TV-optimised)

| Element | Size | Weight |
|---|---|---|
| Top bar title | 16px | 600 |
| Carrier name | 17px | 600 |
| Carrier sub | 13px | 400 |
| Matrix header | 12px | 500 |
| Matrix cell | 14px | — |
| Dot symbol | 14px in 32×32px circle | 700 |
| Alert head | 14px | 600 |
| Alert body | 13px | 400 |
| Section label | 12px | 500, uppercase |
| Legend | 12px | 400 |
| Footer / clock | 12–16px | 500 (mono) |

### Layout (top to bottom)

1. **Top bar** — live pulse dot, title, subtitle; right side: Admin link + live local clock (HH:MM:SS mono)
2. **Section label** — "Carrier overview"
3. **Carrier strip** — 4-column grid of `CarrierCard` components
4. **Section label** — "Can we ship there right now?"
5. **RoutingMatrix** — destination × carrier table with click-to-edit
6. **Section label** — "Active alerts (N)"
7. **Alerts grid** — 2-column grid of alert cards
8. **Legend** — ✓ ⚠ ✕ ? symbol key
9. **Footer bar** — data source note + countdown to next scrape

---

## Component Reference

### `CarrierCard` (`components/CarrierCard.tsx`)

Compact strip card. Shows:
- Carrier name + sub-label
- "stale" badge if data is >13h old
- Status badge: `✓ Operational` / `⚠ Partial` / `✕ Suspended` / `? Monitoring`
- Colored top accent bar via `::before` pseudo-element (green/amber/red/slate)

`overallStatus()` takes the worst of `usDestinationStatus` and `japanOriginStatus`.

### `RoutingMatrix` (`components/RoutingMatrix.tsx`)

The main operational widget. Shows 6 destination regions × 4 carriers.

**Read path (AI-derived):**
- `getAIDot(data, keywords, isUSA)` — keyword-scans `activeAlerts` for region mentions, falls back to overall carrier status
- `getAINote(carriers, keywords)` — finds most severe region-matching alert across all carriers

**Regions and keywords:**

| Region | Flag | Keywords (sample) |
|---|---|---|
| USA / Canada | 🇺🇸 | `usa`, `united states`, `canada`, `north america` |
| Europe | 🇪🇺 | `europe`, `united kingdom`, `france`, `germany` |
| Middle East | 🌍 | `middle east`, `israel`, `iran`, `saudi`, `uae` |
| Russia / Belarus | 🇷🇺 | `russia`, `belarus` |
| Asia Pacific | 🌏 | `china`, `korea`, `australia`, `singapore` |
| Latin America | 🌎 | `brazil`, `mexico`, `argentina` |

**Edit path (manager overrides):**
- On mount: `GET /api/matrix` → loads `{ cells, notes }` into component state
- Each table row has `onClick` → opens modal for that region
- Modal: per-carrier toggles (Auto / ✓ Accepted / ⚠ Alert / ✕ Suspended) + shared note textarea
- "Save" → merges edits into state, `POST /api/matrix` with full object
- "Clear overrides" → removes all overrides for that row, POSTs updated object
- "Cancel" → closes modal, no save

**Visual indicators:**
- Overridden cells: `dot-override` class (indigo ring: `box-shadow: 0 0 0 2px #6366f1`)
- Rows with any override: `edited-badge` in the Note column (purple `#ede9fe / #6d28d9`)
- Note column shows manager note if set, otherwise AI-derived note
- Rows where all carriers are warn/no: `matrix-row-warn` class (amber `#fffbeb` background)

**DotStatus type:** `'ok' | 'warn' | 'no' | 'unk'`

**Cell key format:** `"{carrierKey}:{regionName}"` e.g. `"fedex:Middle East"`

### `Globe.tsx`

Still in repo, not rendered. Was a D3 Natural Earth flat world map with animated arcs from Japan to 5 destination cities. Safe to delete if cleaning up. The `@keyframes dashFlow` in `globals.css` was for its arc animation and can also be removed.

---

## Admin Panel (`/admin`)

No authentication (intentional for beta). Shows:
- Per-carrier scrape history (last 10 runs) — timestamp, success/fail, confidence, content length
- Per-carrier parsed JSON (collapsible)
- "Trigger Scrape Now" button — calls `POST /api/admin/trigger`
- Last run + next run timestamps

Use the admin panel to:
- Verify Claude is parsing correctly after a scrape
- Manually trigger a scrape after deployment
- Diagnose bot-blocking issues (look for `bot_blocked` in history)
- Check confidence scores (low confidence may need prompt tuning)

---

## Known Risks & Gotchas

| Risk | Symptom | Fix |
|---|---|---|
| FedEx/UPS bot blocking | `bot_blocked: true` in admin history | Add Firecrawl `headers` with a realistic User-Agent in the scraper |
| Firecrawl returns generic page | Content length very short (< 500 chars), low confidence | Check raw markdown in admin — may need a different URL |
| Claude misparses sparse content | `confidence: "low"` in history | Tune the system prompt in `lib/parser.ts` |
| Firecrawl 429 (rate limit) | Multiple scrapers failing simultaneously | Switch `Promise.allSettled` to sequential in `lib/scrapers/index.ts` |
| KV cold start (no data) | Cards show "? Monitoring" everywhere | Go to `/admin` → Trigger Scrape Now |
| `@vercel/kv` deprecation warning | npm warn on install | Non-blocking. Switch to `@upstash/redis` if needed — it's a near drop-in |
| Matrix overrides lost | Manager edits vanish on refresh | Check KV key `matrix:overrides` exists in Upstash dashboard |

---

## Local Development

```bash
cd japan-shipping-dashboard

# Copy env vars
cp .env.example .env.local
# Fill in FIRECRAWL_API_KEY, ANTHROPIC_API_KEY, CRON_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN

npm install
npm run dev
# → http://localhost:3000
```

To test scraping locally, visit `http://localhost:3000/admin` and click "Trigger Scrape Now". This hits `POST /api/admin/trigger` which runs the full pipeline.

Vercel KV works locally as long as `KV_REST_API_URL` and `KV_REST_API_TOKEN` are in `.env.local` — it connects directly to the Upstash REST API over HTTPS.

---

## Deployment

The GitHub repo (`stephendotjp/japan-shipping-dashboard`) is connected to Vercel — pushes to `master` trigger automatic production deploys.

```bash
# Manual production deploy (if needed)
vercel deploy --prod
```

After any deployment that changes scraping or parsing logic, manually trigger a scrape from `/admin` to verify the pipeline works end-to-end.

---

## Decisions Made & Why

- **No Playwright / headless browser** — Firecrawl handles JS-rendered pages so there's nothing to run locally or in a serverless function.
- **`/api/admin/trigger` has no auth** — The original `/api/scrape` required `CRON_SECRET`. The admin panel runs in the browser (client-side), and passing secrets to the browser is wrong. A dedicated unauthed trigger route is simpler and safe enough for beta.
- **`Promise.allSettled` not `Promise.all`** — One failing carrier should never block the others. Each result is independent.
- **Status is never overwritten on failure** — Stale but accurate data is better than no data. The `stale: true` flag surfaces this in the UI.
- **`export const dynamic = 'force-dynamic'`** on all API routes using KV — Without this, Next.js tries to prerender them at build time, which fails because KV env vars aren't available during the build.
- **Matrix overrides: full object POST, no server-side merge** — The client holds the full state, so patching adds complexity for no benefit. The full object is small (handful of keys) so replacing it entirely is safe.
- **Manager notes are per-region, not per-cell** — The shipping manager writes one context note for a destination (e.g. "suspended by compliance"). Per-carrier notes would multiply the UI complexity with little operational benefit.
- **`@vercel/kv` over direct Upstash SDK** — The original spec called for Vercel KV. It was deprecated after the project started. The package still works against Upstash; migration to `@upstash/redis` is a drop-in if needed.
