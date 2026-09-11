# OpsBoard — Business Operations Dashboard

A data-rich operations dashboard for managers who need answers in seconds, not
spreadsheets: KPI cards with period deltas, charts, deep data grids, live-mode
simulation, auto-generated insight sentences and a one-click report builder
that prints to PDF.

It ships with a deterministic synthetic business — a mid-market industrial
distributor (4 regions × 4 channels × 5 warehouses, two years of history,
~1,300 sampled orders, ~600 support tickets, 48 SKUs, 240 accounts) — so every
number, chart and table is meaningful out of the box. Swap one file to point it
at real data.

## Features

**Overview (executive read)**
- 8 KPI cards — revenue, plan attainment, gross margin, orders, on-time
  delivery, fulfillment cost/order, support backlog, SLA attainment — each with
  a delta vs the prior period, health dot and SVG sparkline.
- Revenue vs blended cost trend with a dashed "previous period" overlay and a
  plan reference line; bucketing adapts to the selected range (day → week →
  month).
- Channel mix donut with momentum, on-time delivery by region against target,
  a fulfillment funnel (captured → on time), a weekday × hour ticket-volume
  heatmap, and an activity/alerts feed.
- **"What needs attention"** — rule-based insight writer that turns the period's
  numbers into short English sentences (revenue movers, plan gap, delivery
  pressure with top delay cause, inventory risk, concentration) sorted by
  severity and clickable through to the relevant page.

**Orders & Fulfillment** — searchable, sortable order book (TanStack Table)
with status/SLA badges, promise-date math, per-row timeline drawer (items,
carrier, customer context) and filtered CSV export.

**Inventory** — days-of-cover vs supplier lead time per SKU, out-of-stock and
critical flags, replenishment queue with suggested PO quantities, value by
category, warehouse snapshot, stockout trend.

**Support & SLA** — urgent-first ticket desk (needs-reply default, SLA-clock
ordering), attainment gauge by priority, agent leaderboard, arrival heatmap,
full ticket timeline drawer, CSV export.

**Customers & Reps** — account book ranked by window revenue, churn-risk flags,
health scores, segment mix, concentration warning, sales-rep quota
attainment.

**Reports** — four one-page templates (Executive summary, Fulfillment
deep-dive, Growth review, Support health); toggle sections, add a manager's
note; export the *same* document as print/PDF (dedicated print stylesheet),
Markdown, plain-text-to-clipboard or CSV.

**Across the app**
- Global range presets (7D…All) + custom dates, region & channel filters,
  compare-to-previous toggle — one sticky filter bar drives every page.
- ⌘K / Ctrl+K command palette: jump to pages, orders, SKUs, tickets, accounts.
- **Live mode**: streams simulated events every few seconds and patches
  today's aggregates — KPIs, charts and feed all react.
- Light/dark theme (persisted, no flash on load), responsive down to mobile,
  tabular numerals, empty/zero states, error boundary, toasts.
- Deterministic seeded data: the same seed always renders the same business.

## Tech

- React 19 + TypeScript (strict) + Vite
- Tailwind CSS v4 (custom utilities, dark variant, print stylesheet)
- Recharts for composed trend/donut/bar charts; dependency-free SVG
  sparklines, CSS heatmap and conic-gradient gauge elsewhere
- TanStack Table v8 for the grids, Zustand (+persist) for app state, dayjs
- Vitest + Testing Library (36 tests: KPI math, bucketing, insights, generator
  invariants, smoke render of every page), ESLint flat config

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle
npm run preview    # serve the built app
npm test           # vitest run
npm run lint
```

## Architecture

```
src/
  lib/          rng, dates/range math, formatters, csv/clipboard — pure utils
  data/
    model.ts    domain types (DailyRow, OrderRecord, TicketRecord, Sku…)
    generate.ts seeded business simulation (the only file you'd replace)
    dataset.ts  lazy singleton accessor
    selectors.ts React hooks composing store + metrics
  metrics/
    kpis.ts     aggregation, bucketing, KPI defs (format/direction/status)
    insights.ts rule-based narrative writer
    report.ts   report section model + markdown/plaintext renderers
  state/store.ts    zustand: filters, theme, live overlay, toasts, palette
  components/       ui primitives, charts, layout, shared widgets
  pages/            one file per route
```

Design decisions worth knowing:

- **KPI definitions are data** (`KPI_DEFS`): label, formatter, "is up good",
  delta mode (percent vs percentage-points), status thresholds and sparkline
  extractor. New KPI = one entry; cards, tooltips, CSV and reports pick it up.
- **All metric math is pure and unit-tested** — pages only format results.
  Bucketing aggregates sum fields and averages snapshot fields (inventory
  value) correctly.
- The **live overlay** is applied only to today's rows at selector level, so
  pausing live mode restores the deterministic baseline exactly.
- Reports render from the same section builders the UI uses — export and view
  can't drift apart.

### Plugging in real data

Implement `getDataset()` to return the same shapes (`src/data/model.ts`) from
your API/warehouse — e.g. a server rollup for `daily`, order/ticket detail for
the tables. Nothing else needs to change.

## License

MIT
