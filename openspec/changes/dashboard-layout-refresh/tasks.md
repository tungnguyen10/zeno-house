## 1. Palette and chart

- [x] 1.1 Add theme-aware revenue category colors to `useChartTheme()` and drop the hard-coded `REVENUE_CATEGORY_COLOR`
- [x] 1.2 Switch `DashboardBillingTrendChart` to a stacked column chart with empty future months

## 2. Components

- [x] 2.1 Remove the category-share bar and fix label truncation in `DashboardRevenueOverview`
- [x] 2.2 Collection hero: `h2` title, delta caption outside the donut, no duplicate stacked bar
- [x] 2.3 Contracts card mirrors the rooms card anatomy
- [x] 2.4 Occupancy list semantic separator color; compact pending empty state

## 3. Page and verification

- [x] 3.1 Reorder `/dashboard`: KPI cards, pending + occupancy, revenue
- [x] 3.2 Update dashboard component tests; run typecheck, lint, tests, and `openspec validate --specs`
