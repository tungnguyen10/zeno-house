# Contract Return Optimization Implementation Plan

> **For agentic workers:** Apply one checklist task at a time; verify each before starting the next.

**Goal:** Make physical return atomic and auditable, keep final-month billing available, and pilot source-linked settlement without duplicate charges.

**Architecture:** Use one `contract_checkouts` record for every return, with a frozen return snapshot and `standard` or `settlement` financial mode. The return RPC changes occupancy; final-bill and settlement RPCs consume a deterministic server-owned charge preview and post only missing invoice lines.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Zod, Supabase PostgreSQL, Vitest.

## Global Constraints

- Preserve the signed contract `end_date`; `actual_return_date` is separate.
- Client business data goes through `server/api` → service → repository → Supabase.
- Metered electricity/water require a physical final reading and a reconciled baseline; no estimate-only return.
- Default unbilled recurring charges to inclusive-day proration; allow full month or waived with a reason per item.
- Issued/paid invoice lines are immutable during return; apply approved credits and deposit to oldest debt first in pilot settlement.
- The checkout migration is unapplied; cloud staging identification and SQL verification precede enablement.

---

### Task 1: Atomic return and lifecycle guards

**Files:** checkout migration, SQL regression, checkout service/repository, contract service, validators.

- [ ] Add a SQL regression showing return requires meter readings/baselines, terminates contract, moves out occupants, releases a non-maintenance room, and rolls back on failure.
- [ ] Verify the regression fails against current source assumptions.
- [x] Change the pending checkout migration to support return for all buildings, store financial mode, and update room/occupants/audit in the return RPC; block direct active → terminated/expired PATCH and bulk bypass.
- [ ] Add server tests for auth, scope, status, and operation replay; make them pass.

### Task 2: Final-month quote and posting

**Files:** checkout migration, SQL regression, checkout validators/types/mappers, billing services.

- [ ] Add failing tests for prorated/full/waived rent and each recurring service, metered and fixed utilities, incidental charges, issued-line dedupe, and prior debt.
- [x] Persist the frozen return pricing snapshot and optimistic-versioned selections; calculate preview from that snapshot and current invoice balances.
- [x] Add an atomic standard final-bill posting RPC; expand pilot confirmation to post the same missing lines before allocating approved credit and deposit.
- [x] Keep returned standard contracts in the final-month billing queue until their final bill is posted.

### Task 3: Operator flow

**Files:** contract detail/list pages, checkout section/composable, bulk action bar, focused component tests.

- [ ] Add failing UI tests for return data, meter blockers, per-line charge choices, pending final bill, settlement, and partial action errors.
- [x] Make the contract detail section follow Bàn giao → Bảng tính cuối → Quyết toán → Hoàn tiền using existing primitives and semantic tokens.
- [x] Turn bulk termination into a per-contract work list; each item opens its contract return flow.
- [ ] Check mobile/desktop, light/dark, keyboard focus, loading, empty, error, success, and disabled states.

### Task 4: Documentation and verification

**Files:** accepted contract/checkout/billing specs, feature/API/database docs, staging verification instructions.

- [x] Update accepted behavior and API/rollout documentation to match code.
- [x] Run narrow tests, then typecheck, full tests, lint, OpenSpec validation, and a diff review.
- [ ] Identify authorized cloud staging, execute the SQL regression there, regenerate database types, and test the pilot with its flag off before enabling one building.
