## Why

The tenants and contracts list pages are currently global lists, which makes day-to-day management noisy when an operator wants to work within one building. The system already stores building context for contracts and active occupancy, so the missing piece is a building filter while preserving the default all-buildings behavior.

## What Changes

- Add a building filter to `/contracts`; when unset, the page continues to list all contracts.
- Add a building filter to `/tenants`; when unset, the page continues to list all tenants.
- Extend `GET /api/tenants` with optional `building_id`.
- Tenant building filtering includes both primary contract tenants and contract occupants for contracts in the selected building.
- Preserve existing search, status filtering, pagination, permissions, and list row behavior.
- No database schema change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `contracts-api`: Document optional contract list filtering by `building_id`.
- `contracts-client`: Add building filter support to the contracts list page and composable.
- `tenants-api`: Add optional tenant list filtering by `building_id`, derived from contracts and occupants.
- `tenants-client`: Add building filter support to the tenants list page and composable.

## Impact

- Client:
  - `/contracts`
  - `/tenants`
  - `useContractList`
  - `useTenantList`
- Server:
  - `GET /api/tenants`
  - Tenant repository/service filter plumbing
  - Existing `GET /api/contracts` behavior is reused
- Specs:
  - Delta specs for contracts API/client and tenants API/client
