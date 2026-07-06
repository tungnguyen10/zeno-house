## Context

Building expenses are per-building financial records already surfaced in the operations report. Owners with multiple buildings incur costs that span buildings and currently must be split manually and entered separately for each building each period. The scope model uses `user_building_assignments`, and owners are limited to their assigned buildings. This change introduces an owner-level shared expense that fans out into normal per-building expenses through an explicit allocate action, so downstream reporting, void, audit, and export behavior is unchanged.

## Goals / Non-Goals

**Goals:**

- Define a shared expense once at the owner level and select which of the owner's buildings it applies to.
- Allocate the shared amount evenly and generate one building expense per selected building for a chosen period.
- Keep each building's report accurate by reusing the existing `building_expenses` pipeline.
- Restrict the whole feature to admin/owner; managers never see shared expenses.

**Non-Goals:**

- Manual percentage or usage/revenue-based allocation (equal split only in this change).
- Automatic recurring allocation without an explicit owner action.
- Cross-owner sharing or sharing across buildings the owner does not control.
- A new per-building expense type; allocation reuses `building_expenses`.

## Decisions

### Data model

`shared_expenses`: `id`, `owner_id`, `name`, `category` (expense category enum), `amount`, `note`, `is_active`, `created_by`, timestamps. `shared_expense_buildings`: `id`, `shared_expense_id`, `building_id`, unique on (`shared_expense_id`, `building_id`). Membership is the set of buildings the shared expense applies to; equal share = `amount / count` computed at allocation time.

Alternatives considered:

- Persist a stored percentage per building: rejected for this change since only equal split is supported; the share is derived from membership count.
- Add a frequency/anchor like recurring: deferred; allocation is an explicit owner action here to avoid a scheduler and keep control with the owner.

### Allocation

`POST /api/shared-expenses/[id]/allocate` accepts a target `period_year`/`period_month`. The service verifies the owner controls every member building, computes the equal share (absorbing any rounding remainder into the last building so the sum equals `amount`), and creates one `building_expenses` row per member building for that period. Each generated row uses the shared expense's category and a note identifying its shared origin, and is a normal expense thereafter (voidable, reportable, exportable).

Idempotency: re-allocating the same shared expense for the same period is guarded so a second call does not silently double-generate; the service detects prior generation for that shared expense + period and rejects or reports it rather than duplicating.

Alternatives considered:

- Aggregate shared costs on the fly in the report (like prepaid): rejected because operators want the split materialized per building so it appears in that building's normal expense list and audit trail.

### Scope and permissions

Add `shared-expenses.read`, `shared-expenses.write`, and `shared-expenses.allocate` to owner (admin inherits). Managers receive none. All reads/writes are limited to shared expenses owned by the acting owner, and allocation additionally re-checks building scope for every member building.

### Placement

Shared expenses are not per-building, so they live on a dedicated `/shared-expenses` page rather than inside a single building's settings or the operations report.

## Risks / Trade-offs

- Double allocation for one period could double-count -> guard allocation by detecting existing generated rows for the shared expense + period and rejecting duplicates.
- Generated expenses are indistinguishable from manual ones in a building's list -> tag them with a clear shared-origin note so operators understand the source.
- Rounding across buildings could drift from the total -> absorb the remainder in the last building and assert the invariant in tests.
- Changing membership after allocation does not retro-edit prior periods -> acceptable; prior generated expenses remain as historical records and can be voided if needed.

## Migration Plan

1. Add migration for `shared_expenses` and `shared_expense_buildings` with indexes and RLS safety policies; regenerate types.
2. Add DTOs, mappers, and Zod validators.
3. Add repositories and services with owner scope checks and equal-split allocation with rounding invariant and idempotency guard.
4. Add API routes for CRUD and allocate.
5. Add the `/shared-expenses` page and composable with an allocation preview.
6. Update docs; run typecheck, focused tests, and `openspec validate --specs`.
