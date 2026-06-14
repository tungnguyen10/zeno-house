## Context

The current dashboard returns a small aggregate summary and the UI renders four cards plus a room breakdown list. Building pages use UUID route parameters, and service controls are only visible after entering the building settings page. Tenant list filtering can already narrow by building, but it does not expose contract state or active assignment context.

This change crosses UI, API, repository, and database boundaries. It also changes routing expectations for buildings, so the implementation needs a compatibility path for existing UUID links while introducing user-facing slugs.

## Goals / Non-Goals

**Goals:**
- Provide an operational dashboard for capacity, active/expiring contracts, current-month billing health, trend charts, and pending work.
- Add stable building slugs and use `/buildings/<slug>` as the preferred route.
- Keep existing UUID-based building links working during migration.
- Surface building service state on list/detail screens and allow fast active/inactive changes.
- Let operators filter tenants by active contract state and see current room/building context inline.

**Non-Goals:**
- Rebuild the monthly billing workspace.
- Add a new charting dependency unless existing CSS/HTML primitives are insufficient.
- Change contract lifecycle semantics beyond reading active and expiring states.
- Rename existing route file structure beyond what Nuxt needs to accept id or slug params.

## Decisions

### Use persisted unique slugs for buildings

`buildings.slug` will be added, backfilled from `name`, and enforced unique. Slugs remain user-facing identifiers for URLs and API lookup. When building names collide, generated slugs append a short stable suffix such as `-2`, `-3`, or another deterministic collision suffix.

Alternative considered: generate slugs only in the frontend from `name`. This would break when names change, collide, or contain characters that normalize to the same slug.

### Support id-or-slug lookup during migration

The existing `/api/buildings/:id` handler can keep its route name but treat the path segment as an identifier. If it matches UUID format, lookup by `id`; otherwise lookup by `slug`. Client code should prefer `building.slug` when generating links.

Alternative considered: create a separate `/api/buildings/by-slug/:slug` endpoint. That would avoid ambiguity but adds more API surface and duplicates detail behavior.

### Keep dashboard analytics in one summary endpoint

The dashboard should continue using `GET /api/dashboard/summary`, expanded with aggregate sections. This keeps first render simple and avoids several independent requests for a single overview screen.

Alternative considered: split dashboard into separate endpoints for capacity, billing, and tasks. That is more scalable later, but premature while the dashboard is still one page and all data is relational in Supabase.

### Define tenant contract state from active participation

Tenant contract status for list filtering is based on active contracts where the tenant is either the primary tenant or an active occupant. `with_contract` means at least one active participation; `without_contract` means none.

Alternative considered: any historical contract counts as "Co HD". That is less useful for operational assignment because former tenants would look occupied.

### Render charts with local UI primitives first

Occupancy and revenue/debt charts can be implemented with responsive bars/segments using existing components and CSS. A chart library should only be introduced if later requirements need tooltips, axes, drill-downs, or multiple chart types that are hard to maintain with local primitives.

## Risks / Trade-offs

- Slug collisions or renamed buildings can break expectations -> persist unique slugs and do not derive routes from raw names at render time.
- Expanding dashboard aggregates can make the endpoint heavier -> batch Supabase queries, select only needed columns, and keep repository aggregation explicit.
- Billing action counts depend on period semantics -> define current month by server date and billing period rows; show zero counts when a period does not exist.
- Tenant active context may duplicate contract joins -> batch contract and occupant lookups, then enrich tenant DTOs in memory.
- Fast service toggles can create partial UI updates -> reuse existing building-services API and refresh affected building summaries after mutation.

## Migration Plan

1. Add a migration for `buildings.slug`, backfill existing rows, and add a unique index.
2. Regenerate or update local database types.
3. Update building repository mapping and lookup methods to include slug and id-or-slug lookup.
4. Update generated links to prefer slug while accepting existing UUID URLs.
5. Expand dashboard API/types/UI.
6. Add service summaries and fast toggles to building surfaces.
7. Add tenant contract-state filters and active assignment enrichment.
8. Verify with unit tests for repositories/services and UI/component smoke checks where practical.

Rollback keeps UUID lookup working. If slug rollout fails, clients can keep using `id` links while the slug column remains unused.
