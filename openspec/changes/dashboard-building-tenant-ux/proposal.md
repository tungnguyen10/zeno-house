## Why

The current operational screens expose core data, but several high-frequency workflows still require extra navigation or show technical identifiers instead of user-facing context. Dashboard, buildings, and tenants should better support daily operations: scan capacity, contract status, billing risk, building services, and tenant assignment state without drilling through multiple pages.

## What Changes

- Expand the dashboard into an operational overview with room status KPIs, contract KPIs, current-month invoice/payment debt KPIs, occupancy-by-building chart, monthly revenue/debt chart, and an action table for pending operational work.
- Introduce an operational URL identifier strategy: use persisted slugs or business codes for user-facing operational entities, while keeping UUID/id compatibility and avoiding name slugs for sensitive person records.
- Change building navigation from UUID-only detail URLs to stable name-based slugs, while preserving compatibility for existing id-based lookups during migration.
- Extend slug/code-aware routing to building-scoped rooms, building-scoped billing workspaces, contracts, and invoices where stable non-PII identifiers exist.
- Show building service summaries on list/detail surfaces, make service management more discoverable, and support fast active/inactive toggles for building-level services.
- Remove the redundant month-specific operation button from building detail when the building page already links to clearer service and billing workflows elsewhere.
- Add tenant contract-state filtering, tenant list badges for "Co HD" / "Chua co HD", and active room/building context when a tenant currently has an active contract.

## Capabilities

### New Capabilities

- `operational-url-identifiers`: global URL identifier rules for slugs, scoped slugs, business codes, UUID fallback, and PII-sensitive entities.

### Modified Capabilities

- `dashboard-ui`: dashboard requirements expand from basic summary cards to professional operational KPIs, charts, and work queue.
- `dashboard-api`: summary endpoint must return richer aggregate analytics for room status, contracts, billing, charts, and pending actions.
- `buildings-ui`: building list/detail must use slug-aware navigation, show service summaries, expose service actions, and remove redundant month operation CTA.
- `buildings-client`: building DTOs/composables must include slug and service-summary data needed by building UI.
- `buildings-api`: building endpoints must support lookup by slug as well as id and return slug/service summary data.
- `buildings-database`: building records must persist unique slugs for stable user-facing URLs.
- `rooms-client`: room links and building-scoped room views must support building slug + room slug URLs.
- `rooms-api`: room endpoints must support id lookup and scoped building/room slug lookup where applicable.
- `contracts-client`: contract links must prefer stable contract codes/slugs when available.
- `contracts-api`: contract endpoints must support id lookup and stable contract-code lookup where applicable.
- `billing-client`: billing period links must prefer building slug + period route parameters.
- `billing-api`: billing endpoints must accept building id or building slug for period/workspace operations.
- `tenants-client`: tenant list must support contract-state filters, contract badges, and active room/building context.
- `tenants-api`: tenant list responses and filters must expose active-contract state and active assignment context.

## Impact

- Frontend pages/components: `/`, `/buildings`, `/buildings/[id]`, `/rooms`, `/rooms/[id]`, `/contracts`, `/contracts/[id]`, `/billing`, `/billing/[building]/[period]`, building cards/detail actions, `/tenants`, tenant list rows, dashboard visual sections.
- Composables/types/mappers: dashboard summary types, building DTOs and list/detail composables, room URL helpers, billing workspace route helpers, contract DTO/code helpers, tenant DTOs and list composable.
- Server API/services/repositories: dashboard aggregates, building id/slug lookup, building list service summaries, room scoped slug lookup, billing building id/slug resolution, contract code lookup, tenant contract-status filters and active-assignment enrichment.
- Database: add and backfill `buildings.slug`, enforce uniqueness, plan scoped room slugs and stable business-code identifiers for contracts/invoices where missing, and keep identifiers stable across reads.
- Tests should cover slug lookup, tenant contract-state filtering, dashboard aggregate shape, and UI behavior for service summaries and action states.
