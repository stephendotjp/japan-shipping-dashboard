# Japan Shipping Status Dashboard — Agent Handoff

This document gives a complete picture of the project so you can make changes confidently without rediscovering anything from scratch.

---

## What This Is

A real-time shipping status dashboard for a warehouse operations team. It monitors four international carriers (Japan Post, FedEx, UPS, DHL) for service disruptions affecting shipments from Japan. It is designed to be displayed on a large TV screen so shipping agents can glance at it to know which carriers are safe to use.

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
| Map | D3 v7 + TopoJSON + world-atlas CDN data |
| Fonts | IBM Plex Sans + IBM Plex Mono (Google Fonts via `next/font`) |
| Deployment | Vercel (free tier) |

---

## Repository Layout

```
/
├── app/
│   ├── layout.tsx              # IBM Plex font loading, metadata
│   ├── globals.css             # Reset, CSS vars, @keyframes dashFlow
│   ├── page.tsx                # Server component — fetches KV data, renders ClientDashboard
│   ├── ClientDashboard.tsx     # Client component — layout, polling, summary bar
│   ├── admin/
│   │   └── page.tsx            # Debug panel (no auth) — scrape history, trigger button
│   └── api/
│       ├── status/route.ts     # GET — all carrier statuses + stale detection
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
│   ├── Globe.tsx               # Flat SVG world map (D3 Natural Earth projection)
│   └── CarrierCard.tsx         # Individual carrier status card
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

The KV client is from `@vercel/kv`. Note: this package is deprecated (Vercel moved to direct Upstash integration) but still works. The underlying store is the Upstash Redis instance at `smiling-bedbug-106606.upstash.io`.

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

**Philosophy:** Industrial operations monitor. Clean, minimal, professional. Designed for a large warehouse TV screen — readable at a distance.

### Colors

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F5F3EF` | Page background |
| `--topbar` | `#1A1A18` | Top navigation bar |
| `--border` | `#D8D6D0` | All card/section borders, grid gaps |
| Ocean | `#1C2A3A` | World map ocean fill |
| Land | `#2E4034` | World map country fill |
| Japan amber | `#D4A017` | Japan origin dot, arc color, JPN label |

### Status Chip Colors

| Status | Background | Text | Border |
|---|---|---|---|
| operational | `#EAF4E5` | `#2D6B1A` | `#B4D9A2` |
| partial | `#FEF3CD` | `#7A5800` | `#F0D070` |
| suspended | `#FDECEA` | `#8B1A1A` | `#F0A0A0` |
| unknown | `#F0EEE8` | `#888888` | `#D8D6D0` |

### Typography

- **UI text:** IBM Plex Sans (`var(--font-sans)`) — carrier names (16px/500), labels (10–11px/500, uppercase, `letter-spacing: 0.1em`)
- **Data/numbers:** IBM Plex Mono (`var(--font-mono)`) — timers, counts, timestamps
- **Rule:** Nothing below 11px. Monospace only for data values, never for labels or descriptive text.

### Layout (top to bottom)

1. **Topbar** (54px, `#1A1A18`) — title + subtitle left, last-updated + countdown right
2. **World map** (220px SVG, white panel) — D3 flat map with animated arcs
3. **Carrier cards** (4 columns, 1px `#D8D6D0` gaps, white cells)
4. **Summary bar** (4 cells: Operational / Partial / Unknown / Active Alerts counts)
5. **Bottom bar** (36px, white) — data source note left, countdown + progress bar right

---

## World Map (components/Globe.tsx)

Despite the filename, this is a **flat SVG map** (not a globe). The filename was kept from an earlier iteration.

**How it works:**

1. On mount, dynamically imports `d3` and `topojson-client` (client-side only — avoids SSR issues)
2. Fetches `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json` (~100KB TopoJSON)
3. Creates a `d3.geoNaturalEarth1()` projection fitted to a `1400×220` viewBox
4. Generates SVG path strings (`d` attributes) for:
   - All country polygons (except Japan — ID `392`)
   - Japan separately, rendered with amber stroke
   - Great-circle arcs from Japan to 5 destinations (D3 automatically interpolates great circles for `LineString` features)
   - Graticule (lat/lng grid lines, very subtle)
5. Renders everything as React SVG elements
6. Arc animation uses a CSS `@keyframes dashFlow` defined in `globals.css`:
   ```css
   @keyframes dashFlow {
     from { stroke-dashoffset: 0; }
     to   { stroke-dashoffset: -16; }
   }
   ```
   Each arc has `stroke-dasharray: "8 8"` and a different `animation-duration` + `animation-delay` for variety.

**Arc destinations:**

| City | Coords (lng, lat) | Duration | Delay |
|---|---|---|---|
| Los Angeles | [-118.2, 34.1] | 3.0s | 0s |
| London | [-0.1, 51.5] | 4.2s | 0.6s |
| Singapore | [103.8, 1.3] | 2.6s | 1.0s |
| Sydney | [151.2, -33.9] | 3.6s | 1.4s |
| Dubai | [55.3, 25.2] | 3.2s | 0.3s |

**Note on the Pacific arc (Japan → LA):** This great circle crosses the antimeridian (180° line). D3 splits the path at the antimeridian, so the arc renders as two segments — one heading east from Japan to the right edge of the map, and another from the left edge to LA. This is cartographically correct and visually acceptable with dashed animation.

**Japan country ID:** The TopoJSON `countries-110m` dataset uses ISO 3166-1 numeric codes as feature IDs. Japan = `392`. The code filters this out from the main country loop and renders it separately with amber styling.

---

## Carrier Cards (components/CarrierCard.tsx)

Each card displays:
- **Carrier name** (16px/500) + type description (10px label)
- **Overall status chip** (top-right) — derived as the worst of `usDestinationStatus` and `japanOriginStatus`
- **Route rows** — "INTL. SERVICES" and "JAPAN ORIGIN" (not carrier-specific route names) with individual status chips
- **Alert strip** — shows first active alert title, truncated. "NO ACTIVE ALERTS" if clean.
- **Footer** — "DATA STALE" warning if data is >13h old, SOURCE link

Route labels are intentionally generic ("INTL. SERVICES", "JAPAN ORIGIN") rather than "Japan → USA" because the carriers report global service status, not per-route.

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
| KV cold start (no data) | Cards show "Loading…" forever | Go to `/admin` → Trigger Scrape Now |
| `@vercel/kv` deprecation warning | npm warn on install | Non-blocking. Package still works. If migrating, switch to `@upstash/redis` directly and update `lib/db.ts` |
| World map not loading | "LOADING MAP DATA" stuck on page | CDN fetch may be blocked. Check browser console. Fallback: bundle the TopoJSON locally in `/public`. |

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

```bash
# Preview deploy
vercel deploy

# Production deploy
vercel deploy --prod
```

The project is linked to Vercel via `.vercel/project.json`. The GitHub repo (`stephendotjp/japan-shipping-dashboard`) is connected — pushes to `master` trigger automatic preview deploys but NOT production deploys (production requires `vercel deploy --prod` or manual promotion).

After any deployment that changes scraping or parsing logic, manually trigger a scrape from `/admin` to verify the pipeline works end-to-end.

---

## Decisions Made & Why

- **No Playwright / headless browser** — Firecrawl handles JS-rendered pages so there's nothing to run locally or in a serverless function.
- **`/api/admin/trigger` has no auth** — The original `/api/scrape` required `CRON_SECRET`. The admin panel runs in the browser (client-side), and passing secrets to the browser is wrong. A dedicated unauthed trigger route is simpler and safe enough for beta.
- **`Promise.allSettled` not `Promise.all`** — One failing carrier should never block the others. Each result is independent.
- **Status is never overwritten on failure** — Stale but accurate data is better than no data. The `stale: true` flag surfaces this in the UI.
- **`export const dynamic = 'force-dynamic'`** on API routes — Without this, Next.js tries to prerender them at build time, which fails because KV env vars aren't available during the build.
- **`Globe.tsx` filename** — This file was originally a 3D canvas globe. It was redesigned into a flat D3 SVG map but the filename was kept to avoid updating imports. The component exports `WorldMap` semantics despite the filename.
- **`@vercel/kv` over direct Upstash SDK** — The original spec called for Vercel KV. It was deprecated after the project started. The package still works against Upstash; migration to `@upstash/redis` is a drop-in if needed.
