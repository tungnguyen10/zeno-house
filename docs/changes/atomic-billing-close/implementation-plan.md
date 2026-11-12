---
type: Implementation Plan
title: "2026-11-05-atomic-billing-close"
status: draft
change_state: implementation-review
tags: [superpowers, change, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/plans/2026-11-05-atomic-billing-close.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Migrated P0 design/execution artifact. Validate actual source, migrations, tests, and rollout state before treating checked tasks as delivered. Canonical accepted requirements live in `docs/capabilities/**`.

# Atomic Billing Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete PR3a (read-only reconciliation) and PR3 / ZH-BIL-01 (atomic billing close and reopen with one shared reserve-accrual formula) from the design spec.

**Architecture:** One pure formula module is shared by the reconciliation script, operations report and billing close. Two `security invoker` Postgres RPCs (`close_billing_period_atomic`, `reopen_billing_period_atomic`, service_role only) do status change, accrual upsert and audit in one transaction. A `for share` period lock in `record_bulk_payments` plus a `billing_period_closed_guard` trigger make closed periods immutable for payments and money columns. The TypeScript service only checks capability and scope, computes accrual inputs and calls the repository.

**Tech Stack:** Nuxt, Vue, TypeScript, Zod, Vitest, Supabase PostgreSQL (cloud Dashboard SQL, no local DB), Node `.mjs` script.

**Spec:** `docs/changes/atomic-billing-close/design.md`

## Global Constraints

- PR3a ships first and is read-only; the repair script `supabase/sql-editor/repair-billing-close.sql` is NOT written until the reconciliation report is approved (spec "PR3a").
- Services own permissions and business rules; repositories only query/persist; client business data goes through `server/api/**`.
- RPCs: `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.
- Lock order for every billing RPC: `billing_periods` -> `invoices` -> `invoice_payments`.
- Advisory lock key is exactly `format('operations-report:%s:%s:%s', building, year, month)` hashed with `pg_catalog.hashtextextended(..., 0)`, as in `close_operations_report_with_audit`.
- Billing audit rows go to `public.billing_audit_events` (columns `billing_period_id, actor_id, action, entity_type, entity_id, correlation_id, before_data, after_data, metadata`), the same table `BillingAuditService.append` writes.
- Never hand-edit `app/types/database.types.ts`; regenerate only after the migration is applied to staging. Until then call the new RPCs through an `as never` cast as `operations_report_snapshot` already does. Do not start local DB or install dependencies; SQL is for the cloud Dashboard.
- Vietnamese copy must have diacritics. UI uses existing primitives only (toast / `UiAlert`).
- Every user-visible UI change follows `.agents/skills/zeno-house/references/ui-polish-workflow.md` (`frontend-design` + `hallmark`).
- Out of scope: auto-close billing, operations report lifecycle/permission changes, auto refresh of accrual when the report is closed, full financial snapshot.

## Review Focus

- Retry after a failed first close (period `closed` but no audit/accrual) must raise `PERIOD_CLOSED_INCONSISTENT`, never silently return success.
- A period closed by the OLD TypeScript flow wrote `after_data` with camelCase keys (`closedAt`); replay detection must accept both `closed_at` and `closedAt`.
- Operations report already closed for the month: close keeps accrual untouched and returns `accrual_status = 'skipped_report_closed'`.
- Reopen then close again with changed numbers keeps exactly one accrual row with the new value and audit has before/after.
- Two concurrent closes: one commits, the other gets `replayed`; close racing `record_bulk_payments` never deadlocks (period lock is taken first everywhere).
- Negative profit gives accrual 0; reserve-fund-funded expenses never reduce profit; a missing rate gives rate 0.

---

## File Structure

- Create `server/utils/billing/accrual-formula.ts`: pure formula (no imports, so the `.mjs` script can import it).
- Create `supabase/verification/billing_close_integrity.sql` (read-only) and `scripts/reconcile-reserve-accruals.mjs` (read-only CSV).
- Create `supabase/migrations/20261105140000_atomic_billing_close.sql`, `supabase/verification/atomic_billing_close.sql`.
- Create `server/services/operations-report/accrual.ts` (`computeAccrualInputs`).
- Modify `server/services/operations-report/report.ts`, `server/services/operations-report/reserve-funds.ts`, `server/services/billing/periods.ts`, `server/repositories/billing/periods.ts`, `server/utils/errors.ts`, `server/api/billing/periods/[id]/close.post.ts`.
- Modify `app/types/billing.ts`, `app/composables/billing/useBillingPeriodWorkspace.ts`, `app/pages/dashboard/billing/[building]/[period].vue`; create `app/utils/billing/close-feedback.ts`.
- Docs: `docs/features/billing.md`, `docs/features/operations-report.md`, `docs/architecture/database.md`, `docs/capabilities/billing-period-close.md`.
- Tests: `tests/server/billing/accrual-formula.test.ts`, `billing-close-integrity.test.ts`, `atomic-billing-close-migration.test.ts`, `close-service.test.ts`, `close-errors.test.ts`, `accrual-inputs.test.ts`, `tests/scripts/reconcile-reserve-accruals.test.ts`, `tests/utils/billing-close-feedback.test.ts`; update `period-service.test.ts`, `tests/server/operations-report/report-service.test.ts`, `reserve-fund-service.test.ts`.

Branches: PR3a on `feat/billing-close-reconciliation` (Tasks 1-2), PR3 stacked on `feat/atomic-billing-close` (Tasks 3-8).

---

### Task 1: Shared accrual formula (PR3a)

**Files:**
- Create: `server/utils/billing/accrual-formula.ts`
- Test: `tests/server/billing/accrual-formula.test.ts`

**Interfaces:**
- Produces:
```ts
export interface AccrualFixedCost { amount: number; effectiveFromPeriodYear: number; effectiveFromPeriodMonth: number; effectiveToPeriodYear: number | null; effectiveToPeriodMonth: number | null }
export interface AccrualExpense { amount: number; fundedBy: string | null }
export interface AccrualFormulaInput { periodYear: number; periodMonth: number; invoiceTotals: number[]; fixedCosts: AccrualFixedCost[]; expenses: AccrualExpense[]; prepaidMonthlyAmounts: number[]; reserveRatePercent: number }
export interface AccrualFormulaResult { issuedRevenue: number; fixedCostTotal: number; directMonthlyExpenseTotal: number; prepaidAllocationTotal: number; totalExpense: number; profitByRevenue: number; reserveRatePercent: number; accrualAmount: number }
export function fixedCostApplies(cost: AccrualFixedCost, periodYear: number, periodMonth: number): boolean
export function calculateAccrualAmount(profitByRevenue: number, reserveRatePercent: number): number
export function computeAccrualFormula(input: AccrualFormulaInput): AccrualFormulaResult
```
`invoiceTotals` are totals of non-void invoices (callers filter). `expenses` are non-voided. Only TypeScript erasable syntax (no enums, no imports).

- [ ] **Step 1: Write the failing test** `tests/server/billing/accrual-formula.test.ts` covering: (a) reserve-fund-funded expenses excluded from `directMonthlyExpenseTotal`; (b) fixed cost applies from its first month through its last month inclusive and open-ended; (c) prepaid amounts summed; (d) profit below zero gives `accrualAmount` 0; (e) rate 0 gives 0; (f) `calculateAccrualAmount(10, 5) === 1` (Math.round half up) and `calculateAccrualAmount(1_000_000, 10) === 100_000`; (g) empty inputs give all zeros.

```ts
import { describe, expect, it } from 'vitest'
import { calculateAccrualAmount, computeAccrualFormula, fixedCostApplies } from '../../../server/utils/billing/accrual-formula'

const base = { periodYear: 2026, periodMonth: 10, invoiceTotals: [], fixedCosts: [], expenses: [], prepaidMonthlyAmounts: [], reserveRatePercent: 0 }

describe('computeAccrualFormula', () => {
  it('excludes reserve-fund-funded expenses from profit', () => {
    const result = computeAccrualFormula({
      ...base, invoiceTotals: [1_000_000, 500_000], reserveRatePercent: 10,
      expenses: [{ amount: 200_000, fundedBy: 'direct' }, { amount: 900_000, fundedBy: 'reserve_fund' }],
    })
    expect(result.directMonthlyExpenseTotal).toBe(200_000)
    expect(result.profitByRevenue).toBe(1_300_000)
    expect(result.accrualAmount).toBe(130_000)
  })
  it('returns zero accrual for negative profit', () => {
    const result = computeAccrualFormula({ ...base, invoiceTotals: [100], expenses: [{ amount: 500, fundedBy: null }], reserveRatePercent: 50 })
    expect(result.profitByRevenue).toBe(-400)
    expect(result.accrualAmount).toBe(0)
  })
})
```
Add the remaining cases in the same style (fixed-cost range boundaries `2026-10` in `[2026-10, 2026-10]`, `[2026-11, null]` not applying, prepaid sum, empty input).

- [ ] **Step 2: Run** `npx vitest run tests/server/billing/accrual-formula.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the module: `fixedCostApplies` compares `year*12+month` ordinals (from <= period and (to null or period <= to)); `calculateAccrualAmount = Math.round((Math.max(profit, 0) * rate) / 100)`; `computeAccrualFormula` sums as defined by the interfaces and spec formulas.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** `git add server/utils/billing tests/server/billing/accrual-formula.test.ts && git commit -m "feat(billing): add shared reserve accrual formula (ZH-BIL-01)"`

---

### Task 2: PR3a read-only reconciliation (SQL verification + CSV script)

**Files:**
- Create: `supabase/verification/billing_close_integrity.sql`, `scripts/reconcile-reserve-accruals.mjs`
- Test: `tests/server/billing/billing-close-integrity.test.ts`, `tests/scripts/reconcile-reserve-accruals.test.ts`

**Interfaces:**
- Consumes: `computeAccrualFormula` from Task 1 (script imports `../server/utils/billing/accrual-formula.ts` via Node type stripping), RPC `public.operations_report_snapshot(uuid, integer, integer)` (service_role).
- Produces (script exports): `buildReconciliationRow(args)`, `reconciliationToCsv(rows)`, `RECONCILIATION_COLUMNS`. CSV columns: `building_code,building_name,period,billing_period_id,operations_report_status,stored_amount,recomputed_amount,difference,stored_rate_percent,effective_rate_percent,status`. `status` is `match`, `mismatch` or `missing_accrual`.

- [ ] **Step 1: Write failing tests.**
  - SQL test reads the file, strips `--` comments, asserts it contains the aliases `closed_periods_without_close_audit`, `closed_periods_without_accrual_rate_positive`, `closed_periods_without_accrual_rate_zero`, `accruals_linked_to_non_closed_period`, `payments_written_after_close`, `invoices_written_after_close`, `billing_rpc_grants`, and contains none of `\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b` after comment stripping (`has_function_privilege` is allowed).
  - Script test: `buildReconciliationRow` with stored 100 and recomputed 100 gives `match`; stored 90 gives `mismatch` with `difference = -10`... define `difference = recomputed - stored`; stored `null` gives `missing_accrual` with empty stored columns; `reconciliationToCsv` emits the header, quotes a field containing a comma and escapes quotes; the script source contains no `.insert(`, `.update(`, `.upsert(`, `.delete(` and its only `.rpc(` target is `operations_report_snapshot`.
- [ ] **Step 2: Run** `npx vitest run tests/server/billing/billing-close-integrity.test.ts tests/scripts/reconcile-reserve-accruals.test.ts` — Expected: FAIL (files missing).
- [ ] **Step 3: Implement.**
  - SQL file: header comment "read-only, safe before PR3 deployment"; one query per alias; `payments_written_after_close` / `invoices_written_after_close` compare `created_at`/`updated_at` to `billing_periods.closed_at` for periods currently `closed` (counts, plus a `limit 50` detail query each); accrual queries join `public.reserve_funds`/`public.reserve_fund_transactions` (`source = 'monthly_accrual'`, `voided_at is null`) by building and `period_year/period_month`; the rate split uses `public.building_reserve_fund_rates` covering the period with `reserve_rate_percent > 0`; audit check uses `public.billing_audit_events` with `action = 'period.closed'`; grants query uses `to_regprocedure` + `has_function_privilege` for `anon`/`authenticated`/`service_role` over `issue_period_invoices(uuid,uuid,timestamptz,uuid[],jsonb,uuid)`, `record_bulk_payments(uuid,jsonb,uuid)`, `issue_and_pay(uuid,uuid,uuid,date,integer,timestamptz,date,text,text,jsonb,uuid)` and the two new RPCs (null before deployment).
  - Script: env `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (exit 1 with a message when missing), optional `--out file.csv` (default stdout); `@supabase/supabase-js` `createClient`; select `billing_periods` with `status = 'closed'` joined to `buildings(code,name)`; for each call `rpc('operations_report_snapshot')`, map invoices (`total_amount`), fixed costs (snake_case to `AccrualFixedCost`), expenses (`funded_by`), prepaid (`monthly_amount`), effective rate (`snapshot.reserve_rate?.reserve_rate_percent ?? 0`), stored accrual (`reserve_transactions` where `source = 'monthly_accrual'`, matching year/month, `voided_at` null), then `computeAccrualFormula`. Main guarded by `import.meta.url === pathToFileURL(process.argv[1]).href` like `scripts/verify-ai-models.mjs`. Header comment states read-only and how to run.
- [ ] **Step 4: Run** the Step 2 command — Expected: PASS. Then `npx vitest run tests/scripts` — Expected: PASS.
- [ ] **Step 5: Commit** `git add supabase/verification/billing_close_integrity.sql scripts/reconcile-reserve-accruals.mjs tests && git commit -m "feat(billing): add read-only billing close reconciliation (ZH-BIL-01 PR3a)"`

---

### Task 3: Migration, SQL verification and migration text test (PR3)

**Files:**
- Create: `supabase/migrations/20261105140000_atomic_billing_close.sql`, `supabase/verification/atomic_billing_close.sql`
- Test: `tests/server/billing/atomic-billing-close-migration.test.ts`

**Interfaces:**
- Produces: `public.close_billing_period_atomic(p_period_id uuid, p_actor_id uuid, p_correlation_id uuid, p_expected_issued_revenue numeric, p_issued_profit numeric, p_reserve_rate_percent numeric, p_accrual_amount numeric) returns jsonb` -> `{ period, accrual_status, accrual, replayed }` where `period` is the `billing_periods` row (snake_case), `accrual_status` is `'recorded' | 'skipped_report_closed' | null`, `accrual` is the `reserve_fund_transactions` row or null.
- Produces: `public.reopen_billing_period_atomic(p_period_id uuid, p_actor_id uuid, p_reason text, p_correlation_id uuid) returns jsonb` -> `{ period }`.
- Produces error messages (exact `raise exception` text, SQLSTATE): `PERIOD_NOT_FOUND` P0002, `PERIOD_STATUS_INVALID` 23514, `PERIOD_HAS_OUTSTANDING` 23514 (`detail` = `{"outstanding_count": N}` JSON text), `PERIOD_SNAPSHOT_STALE` 40001, `PERIOD_CLOSED_INCONSISTENT` 23514, `PERIOD_NOT_CLOSED` 23514, `PERIOD_REOPEN_REASON_INVALID` 22023, `PERIOD_CLOSED_LOCKED` 23514.

- [ ] **Step 1: Write the failing migration text test** (reads the migration; asserts):
  - both functions exist with `security invoker` and `set search_path = ''`; `revoke all on function public.close_billing_period_atomic(...)  from public, anon, authenticated` and `grant execute ... to service_role` for both functions;
  - every error code string appears;
  - close takes `for update` on `public.billing_periods`, uses `pg_catalog.pg_advisory_xact_lock` with `operations-report:%s:%s:%s`, upserts `monthly_accrual` with `on conflict (fund_id, period_year, period_month) where source = 'monthly_accrual'`, inserts into `public.billing_audit_events` with action `period.closed`, and the replay check reads both `closed_at` and `closedAt`;
  - reopen sets `status = 'collecting'`, `closed_at = null`, writes `period.reopened`, and the migration never updates or deletes `reserve_fund_transactions` inside the reopen function body;
  - `record_bulk_payments(p_actor_id uuid, p_payments jsonb, p_correlation_id uuid default null)` is re-created and its `for share` period lock appears before the first `v_item` loop and the original `Kỳ đã chốt` check is preserved;
  - trigger function `billing_period_closed_guard` with triggers on `public.invoice_payments` (`before insert or update or delete`) and `public.invoices` (`before update`), using `for share`;
  - revokes (from `public, anon, authenticated`) and grants (to `service_role`) for the three signatures `issue_period_invoices(uuid, uuid, timestamptz, uuid[], jsonb, uuid)`, `record_bulk_payments(uuid, jsonb, uuid)`, `issue_and_pay(uuid, uuid, uuid, date, integer, timestamptz, date, text, text, jsonb, uuid)`.
- [ ] **Step 2: Run** `npx vitest run tests/server/billing/atomic-billing-close-migration.test.ts` — Expected: FAIL (ENOENT).
- [ ] **Step 3: Write the migration** (`begin; ... commit;`) following spec "Migration" section step by step. Rulings baked in: outstanding = invoices with `status <> 'void'` and `balance_amount > 0` (same as `InvoiceRepository.listOutstandingByPeriod`); audit goes to `billing_audit_events` (not `audit_events`); `record_bulk_payments` keeps its existing body, only the period `for share` lock is added before the loop (periods derived from `p_payments` invoice ids, `order by id`); trigger guard compares `status`, `subtotal_amount`, `discount_amount`, `surcharge_amount`, `total_amount`, `paid_amount`, `balance_amount` with `is distinct from`.
- [ ] **Step 4: Write `supabase/verification/atomic_billing_close.sql`**: header with staging instructions and the two-session concurrency exercise from the spec; helper `pg_temp` fixture function (building, room, tenant, contract, period, invoices, existing auth user like `atomic_contract_renewal.sql`); one scenario per spec Test bullet (close commits status+accrual+audit; outstanding; stale; replay; report closed -> skipped; reopen/close again; payments blocked on closed period via `record_bulk_payments` and direct `invoice_payments` insert; grants for anon/authenticated); each scenario asserts and the file ends with `rollback;`.
- [ ] **Step 5: Run** the Step 2 command — Expected: PASS.
- [ ] **Step 6: Commit** `git add supabase tests/server/billing/atomic-billing-close-migration.test.ts && git commit -m "feat(billing): add atomic billing close and reopen RPCs (ZH-BIL-01)"`

---

### Task 4: `computeAccrualInputs` and shared use in operations report

**Files:**
- Create: `server/services/operations-report/accrual.ts`
- Modify: `server/services/operations-report/report.ts`, `server/services/operations-report/reserve-funds.ts`
- Test: `tests/server/billing/accrual-inputs.test.ts`; update `tests/server/operations-report/report-service.test.ts`, `reserve-fund-service.test.ts`

**Interfaces:**
- Consumes: Task 1 formula; `OperationsReportRepository.fetchSnapshot`, `ReserveFundService.findEffectiveRate`.
- Produces: `computeAccrualInputs(event: H3Event, buildingId: string, periodYear: number, periodMonth: number): Promise<AccrualInputs>` with `AccrualInputs = { billingPeriodId: string | null; issuedRevenue: number; profitByRevenue: number; reserveRatePercent: number; accrualAmount: number }`.

- [ ] **Step 1: Write failing tests** `accrual-inputs.test.ts` (mock `OperationsReportRepository.fetchSnapshot` and `ReserveFundService.findEffectiveRate`): reserve-funded expenses excluded; fixed cost outside its effective range excluded; prepaid allocation subtracted; negative profit gives 0; no effective rate gives `reserveRatePercent 0`; `billingPeriodId` comes from `snapshot.billing.periodId`. Update the report-service tests: `closeWithAccrualAndAudit` still receives the same `accrualAmount` (behavior unchanged); `refreshReserveAccrual` passes rate and amount from the shared formula; `ReserveFundService.recordMonthlyAccrual` is no longer exported (delete its three tests in `reserve-fund-service.test.ts`).
- [ ] **Step 2: Run** `npx vitest run tests/server/billing/accrual-inputs.test.ts tests/server/operations-report` — Expected: FAIL on the new tests.
- [ ] **Step 3: Implement.** `computeAccrualInputs` fetches the snapshot and the effective rate, maps to `computeAccrualFormula` input (invoice totals from `snapshot.billing.invoices`, prepaid from `prepaidItems.monthlyAmount`). In `report.ts` remove the local `fixedCostApplies`-based duplication of totals in `buildReportSnapshot`/`closeReportPeriod`/`refreshReserveAccrual` by calling `computeAccrualInputs`; `buildReserveSummary` and `getReport` keep their breakdown maps but use `calculateAccrualAmount` and `fixedCostApplies` from the formula module. Refactor `ReserveFundService.refreshAccrualWithAudit` to accept `{ reserveRatePercent, amount }` instead of recomputing. Delete `ReserveFundService.recordMonthlyAccrual` and `ReserveFundRepository.upsertMonthlyAccrual` if `grep -rn "upsertMonthlyAccrual\|recordMonthlyAccrual" server app tests` shows no remaining caller.
- [ ] **Step 4: Run** the Step 2 command, then `npx vitest run tests/server` — Expected: PASS (billing `period-service.test.ts` close tests may fail until Task 5; if so they are rewritten there).
- [ ] **Step 5: Commit** `git add server tests && git commit -m "refactor(operations-report): share one accrual formula (ZH-BIL-01)"`

---

### Task 5: Repository, errors, service and API for atomic close/reopen

**Files:**
- Modify: `server/repositories/billing/periods.ts`, `server/utils/errors.ts`, `server/services/billing/periods.ts`, `server/api/billing/periods/[id]/close.post.ts`, `app/types/billing.ts`
- Test: `tests/server/billing/close-errors.test.ts`, `tests/server/billing/close-service.test.ts`; rewrite close/reopen cases in `tests/server/billing/period-service.test.ts`

**Interfaces:**
- Consumes: RPCs (Task 3), `computeAccrualInputs` (Task 4).
- Produces in `app/types/billing.ts`: `export type BillingAccrualStatus = 'recorded' | 'skipped_report_closed'` and `export interface BillingPeriodCloseResult { period: BillingPeriod; accrualStatus: BillingAccrualStatus | null }`.
- Produces repository: `BillingPeriodRepository.closeAtomic(event, args: { periodId; actorId; correlationId; expectedIssuedRevenue; issuedProfit; reserveRatePercent; accrualAmount }): Promise<{ period: BillingPeriod; accrualStatus: BillingAccrualStatus | null; replayed: boolean }>` and `reopenAtomic(event, args: { periodId; actorId; reason; correlationId }): Promise<BillingPeriod>`.
- Produces service: `BillingPeriodService.close(event, user, id): Promise<BillingPeriodCloseResult>`; `reopen(...)` unchanged signature returning `BillingPeriod`.
- Produces API: `POST /api/billing/periods/:id/close` returns `{ data: period, meta: { accrualStatus } }`.
- `throwDbError` maps the spec error table: 404 `NOT_FOUND`, 409 `CONFLICT` with `{ reason }` (`PERIOD_HAS_OUTSTANDING` message interpolates `outstanding_count` parsed from error `details`, fallback "Còn hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ."), 422 `VALIDATION_ERROR` for `PERIOD_REOPEN_REASON_INVALID`; SQLSTATE 40001 with `PERIOD_SNAPSHOT_STALE` maps to 409.

- [ ] **Step 1: Write failing tests.**
  - `close-errors.test.ts`: for each code in the spec table call `throwDbError({ message: code }, 'x')`; assert status and exact Vietnamese message; `PERIOD_HAS_OUTSTANDING` with `details: '{"outstanding_count":3}'` yields "Còn 3 hoá đơn chưa thanh toán đủ. Cần xử lý trước khi chốt kỳ."; existing `CHECKOUT_` and renewal codes still map.
  - `close-service.test.ts` (mock repositories, `computeAccrualInputs`, `assertBuildingScope`): no `billing.close` -> 403 and no RPC; scope failure -> no compute and no RPC; happy path passes `computeAccrualInputs` values (`expectedIssuedRevenue = issuedRevenue`, `issuedProfit = profitByRevenue`) and a UUID `correlationId`, returns `{ period, accrualStatus }`; `PERIOD_SNAPSHOT_STALE` (409 with `reason`) triggers exactly one recompute+retry, a second stale error propagates; replay returns `accrualStatus: null`; cache invalidated for the building after success (`invalidateOperationsReport`); `BillingAuditService.append` is not called on close or reopen; reopen: no `billing.reopen` -> 403, reason shorter than 10 -> 422, passes reason to `reopenAtomic`, invalidates cache.
- [ ] **Step 2: Run** `npx vitest run tests/server/billing/close-errors.test.ts tests/server/billing/close-service.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** repository methods (`client.rpc('close_billing_period_atomic' as never, {...} as never)`, map result with `mapBillingPeriod`, `throwDbError(error, 'billing.periods.closeAtomic')`), errors map, service, API handler, types. Remove from `periods.ts` the now-unused imports and helpers (`BuildingFixedCostRepository`, `BuildingExpenseRepository`, `PrepaidExpenseService`, `ReserveFundService`, `fixedCostApplies`, `ordinal`) and the `PERIOD_CLOSED`/`PERIOD_REOPENED` audit usage for these two flows.
- [ ] **Step 4: Update** `period-service.test.ts` close/reopen cases to the new mocks (keep scope/permission cases); run `npx vitest run tests/server/billing` — Expected: PASS.
- [ ] **Step 5: Invoice mutation guards.** Add to `tests/server/billing/invoice-service.test.ts` (or `adjustments.test.ts`) failing-first cases proving `voidInvoice`, `reissueInvoice` and `addAdjustment` on a `closed` period each throw 409 before calling any RPC; they already do in code (Ruling: spec text "không kiểm" is stale), so if these pass immediately only the closed-period assertion is added and the DB trigger is the new layer.
- [ ] **Step 6: Commit** `git add server app/types tests && git commit -m "feat(billing): close and reopen periods atomically (ZH-BIL-01)"`

---

### Task 6: UI feedback for skipped accrual

**Files:**
- Create: `app/utils/billing/close-feedback.ts`
- Modify: `app/composables/billing/useBillingPeriodWorkspace.ts`, `app/pages/dashboard/billing/[building]/[period].vue`
- Test: `tests/utils/billing-close-feedback.test.ts`

**Interfaces:**
- Consumes: `BillingPeriodCloseResult`, `BillingAccrualStatus` (Task 5).
- Produces: `closePeriodFeedback(accrualStatus: BillingAccrualStatus | null): { kind: 'success' | 'warning'; message: string }` — `skipped_report_closed` -> warning "Báo cáo vận hành tháng này đã chốt. Quỹ dự phòng chưa được cập nhật theo kỳ billing; Admin cần làm mới quỹ."; everything else -> success "Đã chốt kỳ vận hành".
- Composable `close(): Promise<BillingPeriodCloseResult>` reading `resp.meta?.accrualStatus ?? null`.

- [ ] **Step 1: Read** `ui-polish-workflow.md`, `frontend-design` and `hallmark` skills (per AGENTS.md); polish direction: narrow behavior change, reuse the existing toast; no new primitive.
- [ ] **Step 2: Write failing test** for `closePeriodFeedback` (3 cases: `recorded`, `null`, `skipped_report_closed`). Run `npx vitest run tests/utils/billing-close-feedback.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** helper, composable and page (`closePeriodFromModal` shows `toast.warning` or `toast.success` from the helper; errors keep `getApiErrorMessage` so 409/422 API messages are shown; verify `toast.warning` exists in the toast composable).
- [ ] **Step 4: Run** the test — Expected: PASS; then `npx vitest run tests/components/billing tests/pages` for regressions.
- [ ] **Step 5: Commit** `git add app tests && git commit -m "feat(billing): warn when close skips reserve accrual (ZH-BIL-01)"`

---

### Task 7: Docs and OKF

**Files:**
- Modify: `docs/features/billing.md`, `docs/features/operations-report.md`, `docs/architecture/database.md`
- Update: `docs/capabilities/billing-period-close.md` (format of `docs/capabilities/contract-renewal.md`)

- [ ] **Step 1:** Document close/reopen atomicity, accrual ownership by operations report, one formula, `skipped_report_closed`, the closed-period locks (share lock in `record_bulk_payments`, `billing_period_closed_guard`), lock order, new RPC grants and revoked `authenticated` execute on the three billing RPCs, and the PR3a reconciliation workflow (run `billing_close_integrity.sql` and `node scripts/reconcile-reserve-accruals.mjs --out report.csv` before deploying PR3; repair script comes only after approval).
- [ ] **Step 2:** Write the OKF requirements and scenarios (atomic close, replay and inconsistent detection, report-closed skip, reopen keeps accrual, closed-period write lock, grants).
- [ ] **Step 3: Run** `npm run knowledge:check` — Expected: valid.
- [ ] **Step 4: Commit** `git add docs knowledge && git commit -m "docs(billing): document atomic billing close (ZH-BIL-01)"`

---

### Task 8: Full verification and final review

- [ ] **Step 1:** `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`, `read docs/changes/index.md`; every failure is named in the final report, fixed if caused by this work.
- [ ] **Step 2:** `grep -rn "recordMonthlyAccrual\|upsertMonthlyAccrual" server app tests` returns nothing; `git diff --stat origin/develop...HEAD` contains no `app/types/database.types.ts` change.
- [ ] **Step 3:** Final whole-branch review by a fresh code-review agent against this plan and the spec; fix Critical/Important findings test-first in one pass.

---

## Self-Review

- Spec coverage: formula (T1, T4), PR3a verification + script (T2), RPCs/locks/trigger/grants/error table (T3), service/API/cache/types (T5), void/correct guards (T5 step 5), UI (T6), docs (T7), verification commands (T8). Not written by design: repair script (spec), `database.types.ts` regeneration (needs staging).
- Type consistency: `computeAccrualInputs` fields feed `closeAtomic` args (`issuedRevenue` -> `expectedIssuedRevenue`, `profitByRevenue` -> `issuedProfit`); `BillingAccrualStatus` is the same in repository, service, API meta, helper.
