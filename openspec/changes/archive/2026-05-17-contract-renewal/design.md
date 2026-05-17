## Context

v0.2 contracts have a fixed `end_date` and status `active | expired | terminated`. There is no concept of renewal — when a contract expires and the tenant stays, the landlord has no structured way to extend it. Creating a new contract disconnects pricing history; overwriting end_date loses the original term.

## Goals / Non-Goals

**Goals:**
- Support simple renewal: extend `end_date` in-place, log the renewal event, increment `renewal_count`
- Support full renewal: create a new contract linked via `previous_contract_id`, mark old contract `renewed`
- Preserve `original_end_date` so audit trail shows the original agreed term
- `contract_renewals` log table records each renewal with old/new terms and reason
- UI: renewal action on contract detail, history section showing chain

**Non-Goals:**
- Auto-renewal or scheduled renewal jobs (v0.3+)
- Renewal notifications or reminders
- Tenant-initiated renewal requests (tenant portal, later)

## Decisions

### 1. Two renewal modes: extend vs. new contract

**Decision**: Support both modes via a single `POST /api/contracts/:id/renew` endpoint with a `mode` field (`extend` | `new_contract`).

**Rationale**: Simple cases (same tenant, same room, similar terms) don't need a new contract. Only significant changes (rent change, tenant change, major term change) warrant a new contract in the chain.

**Alternative considered**: Always create new contract. Rejected — too heavy for simple date extensions; clutters contract list.

### 2. `renewed` is a terminal status

**Decision**: When a contract is superseded by a new contract via full renewal, its status becomes `renewed`. It can no longer be edited or have payments added.

**Rationale**: Keeps the contract chain unambiguous — exactly one contract is `active` for any room at any time.

### 3. `renewal_count` is incremented on both modes

**Decision**: Both simple extension and full renewal increment `renewal_count` on the relevant contract (the active one after renewal).

**Rationale**: Provides a quick indicator of how many times a lease relationship has been renewed regardless of mode.

### 4. `contract_renewals` log is append-only

**Decision**: One row per renewal event; no editing. Stores `old_end_date`, `new_end_date`, `old_monthly_rent`, `new_monthly_rent`, `mode`, `reason`, `created_by`.

**Rationale**: Renewal history is audit data. Immutability is appropriate.

## Risks / Trade-offs

- Two modes add API complexity → mitigated by single endpoint with `mode` discriminator
- `previous_contract_id` forms a chain that must be traversed to show full history → acceptable; chains are typically short (< 10 renewals per tenant relationship)
- Simple extend overwrites `end_date` directly → original term preserved in `original_end_date` and `contract_renewals` log
