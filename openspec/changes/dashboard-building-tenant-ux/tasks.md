## 1. Building Slugs and Data Model

- [ ] 1.1 Add a Supabase migration for `buildings.slug`, backfill existing rows, and enforce uniqueness.
- [ ] 1.2 Update generated/local database types for the new `buildings.slug` column.
- [ ] 1.3 Add slug generation/collision handling for create and update building flows.
- [ ] 1.4 Extend building mapper and DTO types with `slug`.
- [ ] 1.5 Add repository/service support for id-or-slug building lookup.

## 2. Building Services UX

- [ ] 2.1 Extend building list/detail API responses with active service summary data.
- [ ] 2.2 Update `useBuildingList` and `useBuildingDetail` to expose slug and service summary data.
- [ ] 2.3 Update building cards and detail navigation to prefer `/buildings/<slug>` links.
- [ ] 2.4 Add building service summary display to building list cards and building detail.
- [ ] 2.5 Add admin-only fast active/inactive service toggles on building detail.
- [ ] 2.6 Remove the redundant month-specific operation CTA from building detail.

## 3. Tenant Contract State

- [ ] 3.1 Extend tenant API filters with `contract_state=with_contract|without_contract`.
- [ ] 3.2 Enrich tenant list DTOs with `hasActiveContract` and active room/building summary.
- [ ] 3.3 Update tenant mapper/types/composable to carry contract-state and active assignment data.
- [ ] 3.4 Add the contract-state filter control to `/tenants` and reset pagination on changes.
- [ ] 3.5 Add tenant list badges for "Co HD" and "Chua co HD".
- [ ] 3.6 Show current room/building context on tenant list rows when available.

## 4. Dashboard API

- [ ] 4.1 Expand dashboard summary types with contract, billing, trend, and pending operation sections.
- [ ] 4.2 Aggregate room status and occupancy-by-building with building slugs.
- [ ] 4.3 Aggregate active contracts and expiring-soon contracts.
- [ ] 4.4 Aggregate current-month invoice total, paid amount, outstanding amount, and overdue amount.
- [ ] 4.5 Aggregate recent monthly paid/outstanding billing trend data.
- [ ] 4.6 Build pending operation items for missing readings, unissued invoices, and overdue invoices.

## 5. Dashboard UI

- [ ] 5.1 Replace the basic dashboard card layout with room, contract, and billing KPI groups.
- [ ] 5.2 Add occupancy-by-building chart using existing operational UI primitives.
- [ ] 5.3 Add revenue/debt-by-month chart using existing operational UI primitives.
- [ ] 5.4 Add pending operations table with severity, counts, and workflow links.
- [ ] 5.5 Add loading and empty states for each dashboard section.
- [ ] 5.6 Ensure dashboard layout remains dense, readable, and responsive on mobile and desktop.

## 6. Verification

- [ ] 6.1 Add or update tests for building slug generation and id-or-slug lookup.
- [ ] 6.2 Add or update tests for tenant contract-state filtering and active assignment enrichment.
- [ ] 6.3 Add or update tests for dashboard summary aggregate shape and empty-state behavior.
- [ ] 6.4 Run typecheck and relevant test suites.
- [ ] 6.5 Manually verify `/`, `/buildings`, building detail slug URLs, and `/tenants` in the browser.
