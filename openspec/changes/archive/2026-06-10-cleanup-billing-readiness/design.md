## Context

The app is moving toward a Monthly Billing Workspace scoped by `building + period`. Existing source code already contains enough billing inputs to support this direction, but those inputs are scattered and some are not reliable:

- Building stores rates and operational schedule
- Contract stores rent, deposit, occupant count, discounts, surcharges, and optional payment day
- Contract services store monthly service charges
- Meter readings store monthly and handover readings by room and meter type
- Contract payments record deposit, prepaid rent, rent, and other payments, but are not tied to invoices

This cleanup aligns ownership before the workspace is built.

## Goals / Non-Goals

**Goals:**
- Make current billing inputs reliable and unambiguous
- Remove or de-emphasize room-centric monthly billing paths
- Align OpenSpec with the simplified meter model and current contract-as-assignment model
- Clarify contract-level payment semantics before invoice payments are introduced
- Prepare `/billing` to become the monthly operations entry point

**Non-Goals:**
- Creating invoices
- Persisting billing periods
- Calculating final monthly debt
- Payment allocation
- Tenant-facing portal
- Automation/reminders

## Decisions

### D0 — Database changes are manual and fully enumerated

Any database schema change in this change set must be written as explicit SQL intended for manual execution in the Supabase Dashboard SQL Editor. The implementation must not assume automatic migration application.

Each DB change must list:

- Table name
- Operation: `ADD`, `DROP`, `ALTER`, `CREATE INDEX`, `DROP INDEX`, `CREATE POLICY`, `DROP POLICY`, etc.
- Column/type/default/nullability/check constraint when relevant
- Data backfill or data-loss behavior
- Dependency/order requirements
- Verification query
- Rollback note where practical

For this specific cleanup proposal, the expected DB posture is conservative: prefer code/spec cleanup first. A schema migration should only be introduced if implementation discovers that the existing database cannot support the required behavior.

### D1 — Monthly billing remains workspace-scoped

Billing work belongs under `/billing`, scoped by building and period. Building detail may link users into the workspace, but it should not own the monthly task.

```
Building detail
  └── CTA: Open billing for current month
        └── /billing?building_id=...&period=YYYY-MM
```

### D2 — Room detail is not a billing workspace

Room detail remains an occupancy/master-data page. It may show a compact read-only meter summary if useful, but it must not be the place where users enter monthly readings or perform billing calculations.

### D3 — Handover readings stay with contract lifecycle

`handover_in` and `handover_out` readings are not monthly billing entry. They are onboarding/offboarding readings for a contract and can remain on contract detail or a future assignment flow.

### D4 — Contract `payment_day` is required billing input

`payment_day` is already in schema, validators, DTOs, and UI. The repository must persist it on create/update. `NULL` means inherit from building `payment_due_day`.

### D5 — Contract lifecycle must keep room status trustworthy

Billing workspace depends on active contracts and occupied rooms matching. Contract operations must keep room status aligned:

- Creating active contract sets room `occupied`
- Terminating/expiring active contract sets room `available` unless the room is `maintenance`
- Deleting active contract sets room `available` unless the room is `maintenance`
- Renewing via successor contract must preserve enough contract context for future billing

### D6 — Renewal successor carries billing-critical context

When renewal mode is `new_contract`, the successor should carry forward billing-critical context:

- Contract services
- Active occupants, preserving billing-counted state
- Payment day
- Commercial terms already copied by renewal service

Deposit and historical payments should not be copied automatically.

### D7 — Contract payments are not monthly invoice payments

Until invoices exist, contract payments may remain as a contract-level ledger. Their intended use should be narrowed:

- `deposit`: contract-level
- `prepaid_rent`: contract-level, may later be allocated to invoice periods
- `rent`: legacy/temporary, not the future source of truth for monthly invoice settlement
- `other`: legacy/temporary, must not replace itemized invoice charges

Future monthly collection should use invoice payment allocations.

## Risks / Trade-offs

- Removing room-centric meter reading UI may feel like a loss if users currently inspect history there. A compact read-only summary can preserve visibility without making it the workflow.
- Keeping `rent` in `contract_payments` avoids a breaking migration now, but the proposal must make clear it is not the future monthly payment model.
- Renewal carry-forward adds implementation complexity, but skipping it makes the first billing period after renewal unreliable.
