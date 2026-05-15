## Why

Room assignments track which tenant occupies which room operationally, but there is no formal contract record capturing agreed rent, deposit amount, and contract duration. Landlords need a `contracts` entity to document the legal rental agreement between a tenant and a room, separate from the day-to-day occupancy record.

## What Changes

- Introduce a `contracts` table to store rental contracts (tenant ↔ room, rent, deposit, date range, status).
- Provide full CRUD API for contracts following the existing API → service → repository pattern.
- Provide client UI: list page (per-building or global), detail page, create/edit pages.
- Contract status lifecycle: `active` | `expired` | `terminated`.
- When a contract is created for an active room assignment, it links to that assignment implicitly via shared tenant + room. No automated coupling with room status in this phase.

## Capabilities

### New Capabilities

- `contracts-database`: Supabase migration creating the `contracts` table with RLS policies matching existing patterns.
- `contracts-api`: Server API endpoints — list, get, create, update, delete — with Zod validation, auth guards, and conflict detection (overlapping active contracts for the same room).
- `contracts-client`: Client UI pages (`/contracts`, `/contracts/create`, `/contracts/:id`, `/contracts/:id/edit`) and associated composables (`useContractList`, `useContractDetail`, `useContractForm`).

### Modified Capabilities

- `tenants-client`: Tenant detail page gains a "Hợp đồng" section listing the tenant's contracts (read-only links).
- `rooms-client`: Room detail page gains a "Hợp đồng" section listing the room's contracts (read-only links).

## Impact

- **Database**: New `contracts` table; no schema changes to existing tables.
- **Server API**: New files under `server/api/contracts/`, `server/services/contracts/`, `server/repositories/contracts/`.
- **Client**: New pages under `app/pages/contracts/`; new composables under `app/composables/contracts/`; new component `app/components/contracts/ContractForm.vue`.
- **Types**: New `app/types/contracts.ts` type file; `database.types.ts` must be regenerated after migration.
- **Sidebar**: `AppSidebar` gains a "Hợp đồng" nav item.
- **No breaking changes** to existing endpoints or component APIs.
