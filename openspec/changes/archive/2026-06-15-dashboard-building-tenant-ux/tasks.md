## 1. Building Slugs and Data Model

- [x] 1.1 Add a Supabase migration for `buildings.slug`, backfill existing rows, and enforce uniqueness.
- [x] 1.2 Update generated/local database types for the new `buildings.slug` column.
- [x] 1.3 Add slug generation/collision handling for create and update building flows.
- [x] 1.4 Extend building mapper and DTO types with `slug`.
- [x] 1.5 Add repository/service support for id-or-slug building lookup.

## 2. Operational URL Identifiers

- [x] 2.1 Add shared helpers for building paths, scoped room paths, billing workspace paths, and id/code fallback route params.
- [x] 2.2 Update building-scoped child links to use building slug where available.
- [x] 2.3 Add room scoped slug support for building room links while keeping UUID room detail routes working.
- [x] 2.4 Update billing workspace links to prefer `/billing/<buildingSlug>/<YYYY-MM>` and keep UUID building params supported.
- [x] 2.5 Update contract links to prefer stable contract code/slug when available and fall back to UUID.
- [x] 2.6 Document and enforce that tenant routes do not use name-derived slugs.

## 3. Building Services UX

- [x] 3.1 Extend building list/detail API responses with active service summary data.
- [x] 3.2 Update `useBuildingList` and `useBuildingDetail` to expose slug and service summary data.
- [x] 3.3 Update building cards and detail navigation to prefer `/buildings/<slug>` links.
- [x] 3.4 Add building service summary display to building list cards and building detail.
- [x] 3.5 Add admin-only fast active/inactive service toggles on building detail.
- [x] 3.6 Remove the redundant month-specific operation CTA from building detail.

## 4. Tenant Contract State

- [x] 4.1 Extend tenant API filters with `contract_state=with_contract|without_contract`.
- [x] 4.2 Enrich tenant list DTOs with `hasActiveContract` and active room/building summary.
- [x] 4.3 Update tenant mapper/types/composable to carry contract-state and active assignment data.
- [x] 4.4 Add the contract-state filter control to `/tenants` and reset pagination on changes.
- [x] 4.5 Add tenant list badges for "Có HĐ" and "Chưa có HĐ".
- [x] 4.6 Show current room/building context on tenant list rows when available.

## 5. Dashboard API

- [x] 5.1 Expand dashboard summary types with contract, billing, trend, and pending operation sections.
- [x] 5.2 Aggregate room status and occupancy-by-building with building slugs.
- [x] 5.3 Aggregate active contracts and expiring-soon contracts.
- [x] 5.4 Aggregate current-month invoice total, paid amount, outstanding amount, and overdue amount.
- [x] 5.5 Aggregate recent monthly paid/outstanding billing trend data.
- [x] 5.6 Build pending operation items for missing readings, unissued invoices, and overdue invoices.

## 6. Dashboard UI

- [x] 6.1 Replace the basic dashboard card layout with room, contract, and billing KPI groups.
- [x] 6.2 Add occupancy-by-building chart using existing operational UI primitives.
- [x] 6.3 Add revenue/debt-by-month chart using existing operational UI primitives.
- [x] 6.4 Add pending operations table with severity, counts, and workflow links.
- [x] 6.5 Add loading and empty states for each dashboard section.
- [x] 6.6 Ensure dashboard layout remains dense, readable, and responsive on mobile and desktop.

## 7. Verification

- [x] 7.1 Add or update tests for building slug generation and id-or-slug lookup.
- [x] 7.2 Add or update tests for operational URL helper behavior and UUID fallback links.
- [x] 7.3 Add or update tests for tenant contract-state filtering and active assignment enrichment.
- [x] 7.4 Add or update tests for dashboard summary aggregate shape and empty-state behavior.
- [x] 7.5 Run typecheck and relevant test suites.
- [x] 7.6 Manually verify `/`, `/buildings`, building detail slug URLs, building-scoped room links, billing workspace links, contract links, and `/tenants` in the browser.
