## Context

Contracts already carry `building_id` and `GET /api/contracts` already accepts a `building_id` query parameter. The contracts list UI and composable do not expose that filter yet.

Tenants are intentionally stored as global people records. A tenant's building context is derived from contracts: either as the primary `contracts.tenant_id` or as a room occupant through `contract_occupants.tenant_id`. The tenants list currently supports search and availability filtering, but not building filtering.

## Goals / Non-Goals

**Goals:**

- Add optional building filters to the tenants and contracts list pages.
- Keep default list behavior global when no building is selected.
- Include both primary tenants and occupants when filtering tenants by building.
- Preserve pagination and existing search/status filters.

**Non-Goals:**

- Add `building_id` to the `tenants` table.
- Build a full building management workspace.
- Add manager-to-building assignment or building-scoped authorization.
- Change contract creation, tenant creation, or occupancy business rules.

## Decisions

### D1 - Tenant building scope is derived, not stored

Tenant filtering by building will query relationships instead of adding a `building_id` column to `tenants`.

Rationale: a tenant is a person, while building residency is time-bound and contract-bound. Storing `building_id` directly on the tenant would become stale when they move.

Alternative considered: add `tenants.building_id`. Rejected because it breaks the existing domain boundary and cannot represent historical or multi-contract relationships.

### D2 - Include primary tenants and occupants

When `building_id` is supplied, the tenant repository will include tenant ids from:

- contracts in the building via `contracts.tenant_id`
- contract occupants attached to contracts in the building via `contract_occupants.tenant_id`

Rationale: operationally, "khach thue cua toa" means everyone connected to rooms in that building, not only the person standing on the contract.

### D3 - Empty building relationship means empty tenant result

If a selected building has no matching primary tenants or occupants, the tenant list returns an empty page with correct pagination metadata.

Rationale: this is clearer than falling back to all tenants and accidentally losing the user's selected scope.

### D4 - Reuse existing building list data for filters

Both pages can use `useBuildingList()` to populate a building select. The filter value remains optional; clearing it returns to all buildings.

Rationale: this keeps the implementation small and avoids introducing a new lookup endpoint for this change.

## Risks / Trade-offs

- Tenant building filtering requires extra queries before the paginated tenant query -> Keep the query simple and deduplicate ids before applying the tenant filter.
- Building select uses the paginated building list -> Acceptable for current scale; searchable building lookup can be introduced later if building count grows.
- Historical occupants/contracts may appear if no status restriction is applied -> For this change, the filter means "related to this building", not only currently active, matching the user's requested lightweight filter.
