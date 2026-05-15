## Context

The system already tracks occupancy through `room_assignments` (operational: who is in which room right now) and has full CRUD for `buildings`, `rooms`, and `tenants`. The missing entity is `Contract` — the formal legal agreement between a landlord and a tenant for a room, recording agreed rent, deposit, and contract duration. Contracts and room assignments model different concerns and will coexist in v0.2.

## Goals / Non-Goals

**Goals:**
- Add a `contracts` table with full CRUD API following the established API → service → repository pattern.
- Detect overlapping active contracts for the same room at the service layer.
- Provide client UI pages and composables following the established list / detail / form composable split.
- Surface contract summaries on tenant detail and room detail pages (read-only).

**Non-Goals:**
- Automated PDF contract generation.
- Contract renewal or extension workflows.
- Invoice generation (planned for a later phase).
- Automated coupling between a contract and a room assignment (e.g., auto-creating an assignment when a contract is created). These two entities remain independently managed in this phase.
- Tenant-facing contract portal.

## Decisions

### 1. Contracts are a standalone entity — not a replacement for room_assignments

**Decision**: Keep `room_assignments` for operational occupancy tracking and introduce `contracts` as a separate legal record. No foreign key linking the two.

**Rationale**: They have different lifecycles — an assignment ends the day a tenant moves out; a contract may pre-date or outlast the actual occupancy. Coupling them would add accidental complexity. The same pattern exists in real property management software.

**Alternative considered**: Replace room_assignments with contracts. Rejected because contracts carry different data (deposit, formal dates, legal status) and creating a contract should not be required to change room occupancy status.

### 2. Status is a stored column, not computed

**Decision**: `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated'))` — persisted in the DB.

**Rationale**: Status needs to be filterable in queries without a computed expression. "expired" can be set by a future scheduled job; for now admin sets it manually. Avoids the complexity of a computed/virtual column approach.

**Alternative considered**: Derive status from `end_date < now()`. Rejected because "terminated" (early cancellation) cannot be expressed purely from dates, and filtering active vs. expired contracts would require function indexes.

### 3. Overlap detection at service layer with a DB-level partial unique index

**Decision**: The service SHALL reject a new `active` contract if the same room already has one. Back it with a partial unique index `UNIQUE (room_id) WHERE status = 'active'`.

**Rationale**: Belt-and-suspenders — service gives a friendly CONFLICT error; the DB index prevents race conditions. Mirrors the room_assignments pattern (`UNIQUE (room_id) WHERE end_date IS NULL`).

### 4. Follow existing patterns exactly

**Decision**: API layer uses `defineEventHandler` + `requireUserSession`, service handles business logic, repository handles Supabase queries. TypeScript types in `app/types/contracts.ts`. Zod schemas in `app/utils/validators/`.

**Rationale**: Consistency with buildings, rooms, tenants, and room-assignments. No new patterns introduced.

## Risks / Trade-offs

- **Data inconsistency between contracts and room_assignments**: A room may have an active contract but no room_assignment (or vice versa). → Accepted in this phase; the two entities are managed independently. A future "smart assign" feature could reconcile them.
- **Manual status management**: Admin must manually mark contracts as `expired` or `terminated`. → Acceptable for v0.2 scope. A scheduled job can automate this later.
- **No contract number / reference**: Contracts have no human-readable identifier in this phase. → Acceptable; UUID is sufficient for CRUD. A `contract_number` column can be added later.

## Migration Plan

1. Apply Supabase migration creating the `contracts` table.
2. Regenerate `database.types.ts` using `supabase gen types typescript`.
3. Deploy server API and client UI.
4. No rollback risk — no existing data or endpoints are modified.

## Open Questions

- Should `end_date` be required? (Current decision: required, since a formal contract always has a defined end date.)
- Should `deposit` default to 0 or be required? (Current decision: NOT NULL DEFAULT 0, matching `monthly_rent` pattern from rooms.)
