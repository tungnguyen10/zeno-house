## Why

`buildings.status` already carries `'active' | 'inactive'` and `softArchive()` writes `'inactive'`, but no list, dashboard, billing, contract, room, or tenant query filters on it. An operator who stops running a building therefore keeps seeing its rooms, contracts, invoices, and revenue mixed into every aggregate, with no way to clear the noise short of deleting data.

Zeno House needs an explicit, admin-controlled visibility switch that removes a building's data from browsing and aggregation without destroying history or breaking direct links to records that already exist.

## What Changes

- Add a `buildings.is_hidden` flag that is independent of the existing `status` column; `status` semantics are unchanged.
- Exclude hidden buildings from every list and aggregate surface: buildings, rooms, contracts, tenants, meter readings, invoices and billing queries, the dashboard summary, and AI building resolution.
- Keep direct detail access working: `assertBuildingScope` stays unaware of visibility, so an existing link to a building, room, contract, or invoice still resolves.
- Gate the switch behind a new admin-only capability; owners keep `buildings.update` but cannot change visibility.
- Add a dedicated `PATCH /api/buildings/:id/visibility` endpoint that records a durable audit event.
- Add an admin-only `include_hidden` list flag so administrative surfaces can still enumerate hidden buildings.
- Add an admin settings tab that lists every building with a visibility toggle.
- Never apply visibility filtering to the tenant portal; a tenant always reaches their own contract and invoices.

## Capabilities

### New Capabilities
- `building-visibility`: The hidden flag, its permission model, the visibility endpoint, audit trail, and the admin settings surface.

### Modified Capabilities
- `buildings-api`: Building responses expose `isHidden`; the list endpoint hides hidden buildings and accepts an admin-only `include_hidden` flag.
- `manager-building-scope`: Server scope resolution separates permission scope from visibility scope, so lists and aggregates narrow while detail reads do not.
- `dashboard-ui`: Dashboard totals exclude hidden buildings, and the summary cache key accounts for the hidden set.

## Impact

- Adds a Supabase migration and a generated database-type refresh.
- Adds a scope helper alongside `getAssignedBuildingIds` and switches eight list/aggregate call sites to it; detail and write call sites are deliberately untouched.
- Adds one capability, one audit action, one validator, one endpoint, one settings page, and one navigation entry.
- Requires cloud migration application and generated-type regeneration before the server changes compile.
