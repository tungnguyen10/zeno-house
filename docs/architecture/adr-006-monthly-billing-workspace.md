# ADR-006: Monthly Billing Is a Building-Level Bulk Workspace

**Status**: Accepted  
**Date**: 2026-06-01  
**Phase**: v0.3

## Context

After v0.2.5 completed Core Data alignment (buildings, rooms, tenants, contracts, meter readings, contract services, occupants), the next step is the monthly billing loop. The question is: where does billing work happen and how is it scoped?

## Decision

Monthly billing is processed as a **building-level bulk workspace** scoped to a single building and a single calendar period (year + month).

The workspace handles:
- Bulk meter reading input (electricity/water) for all active rooms
- Preview of calculated charges per contract
- Generation of an immutable billing snapshot (billing run + billing items + 3 snapshot tables)
- Payment tracking (mark paid/unpaid per item, bulk actions)
- Period lock (finalize/unlock)

## Consequences

### Billing entry point

- `/billing` — entry page, admin selects building + month/year, navigates to workspace
- `/buildings/[id]/billing?month=&year=` — the billing workspace for that building+period

### No billing from Room detail

Room detail pages are master data screens. Users never navigate to a Room page to perform billing work. Room detail may show a **read-only** billing history section linking back to the workspace.

### No proration in v0.3

Contracts that start or end mid-month are billed at full-month rent. Proration logic is explicitly deferred to a later phase. This is a business decision by the landlord; the system does not enforce it.

### Snapshot layer: 3 separate tables

The billing snapshot for each contract is persisted across 3 child tables (not a JSONB blob), enabling SQL aggregation for analytics:

| Table | Relationship | Purpose |
|---|---|---|
| `billing_contract_snapshots` | 1:1 per billing_item | Frozen rent/surcharge/discount/occupants |
| `billing_service_snapshots` | 1:many per billing_item | Frozen service pricing at generate time |
| `billing_utility_snapshots` | 1:many per billing_item | Frozen meter consumption + rate |

### Period status flow

```
draft → [generate] → draft (with run) → [finalize] → finalized
finalized → [unlock, admin only] → draft
```

- Meter readings editable while period = draft
- Payment tracking editable in both states
- Regenerate blocked if any billing_item has payment_status = 'paid'

## Alternatives Considered

**Room-centric billing** — billing initiated from Room detail pages. Rejected: breaks down for landlords processing 20+ rooms at once; does not match real operations.

**Single workspace page without tabs** — all billing in one scrollable page. Rejected: too long for 20+ rooms; tabs separate the concern (data input vs preview vs result).
