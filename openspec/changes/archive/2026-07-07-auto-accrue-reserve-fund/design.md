## Context

Reserve funds currently use `reserve_funds` as a per-building container and `reserve_fund_transactions` as a manual cash ledger. The current accepted spec supports manual deposits, manual withdrawals, non-negative balance checks, and reserve-funded expenses that create linked withdrawal transactions.

The target behavior is an automatic operations-accounting model:

- each building configures an effective reserve rate by month
- closing a billing period records the month accrual as a reserve transaction
- reserve-funded expenses create deduction transactions
- fund balances may become negative

This change should avoid parallel data models. `reserve_funds` remains the building container and `reserve_fund_transactions` remains the ledger; the ledger gains enough metadata to distinguish automatic accrual rows from expense deduction rows.

## Goals / Non-Goals

**Goals:**

- Reuse existing reserve tables instead of adding a separate monthly snapshot table.
- Add period-based reserve rate history for each building.
- Record monthly accruals from billing issued revenue when a period is closed.
- Record reserve-funded expense deductions without blocking negative balances.
- Surface monthly and cumulative reserve figures in operations report.
- Remove manual reserve deposit/withdraw UI behavior from the operations report.

**Non-Goals:**

- Do not add reserve fund as an invoice charge or tenant-facing billing line.
- Do not make shared expenses reserve-funded by default.
- Do not rewrite billing issue/payment behavior beyond close-period accrual.
- Do not delete historical `reserve_funds` or `reserve_fund_transactions` tables.

## Decisions

### Reuse `reserve_fund_transactions` as the source of truth

The ledger already represents increases and decreases to a building fund. Instead of creating `reserve_fund_monthly_snapshots`, extend transaction rows with:

- `source`: `monthly_accrual` or `expense_deduction`
- `period_year`, `period_month`
- `billing_period_id`
- `reserve_rate_percent`
- `issued_revenue`
- `voided_at`, `voided_by`, `void_reason`

Rationale: a monthly accrual is naturally a deposit-like ledger entry, and expense deductions are withdrawal-like entries. This keeps all balance math in one table and avoids reconciling snapshots against transactions.

Alternative considered: add a dedicated monthly snapshot table. Rejected because it duplicates balance state and still needs deduction data from expenses/transactions.

### Add `building_reserve_fund_rates` for period-based rate history

Reserve rates require effective-month history so changing the rate later does not change old closed periods. This mirrors the existing fixed-cost pattern: rows have `effective_from_period_*` and optional `effective_to_period_*`.

The service should reject overlapping ranges for the same building, and building settings should manage the history.

### Treat billing close as the accrual trigger

Billing owns the close-period moment, and issued revenue is stable enough at close to snapshot the accrual. Closing a billing period should upsert exactly one `monthly_accrual` transaction for that building/month using non-void invoice totals and the effective rate.

If a closed period is reopened and later closed again, the close flow should refresh the same accrual row rather than creating a duplicate.

### Keep reserve deductions tied to expenses

Creating an expense with `funded_by = reserve_fund` should create a linked `expense_deduction` transaction for the same amount and period. Updating the expense amount, period, date, or funding source should sync or void the linked deduction. Voiding the expense should void the linked deduction.

The expense remains a normal operating expense and still contributes to operations report total expenses.

### Allow negative reserve balances

The fund is an accounting tracker, not a hard cash account. No service should reject reserve-funded expenses because of insufficient balance.

## Risks / Trade-offs

- Existing manual transaction rows may not have period/source metadata. → Treat legacy rows conservatively in migration/reporting, and avoid exposing manual controls going forward.
- Close-period accrual becomes a cross-domain side effect. → Keep billing responsible only for triggering/upserting accrual; reserve math and report display remain in operations-report/reserve services.
- Expense update sync can drift if only create is handled. → Include update and void paths in service tasks and tests.
- Rate overlap checks can race under concurrent writes. → Add DB constraints/indexes where practical and keep service overlap validation.

## Migration Plan

1. Add `building_reserve_fund_rates`.
2. Extend `reserve_fund_transactions` with period/source/accrual metadata and void fields.
3. Add unique indexes for one monthly accrual per fund/month and one active expense deduction per linked expense.
4. Keep existing manual transaction rows for history; new UI/API flows stop creating manual deposits/withdrawals.
5. Update database types after migration.
6. Update docs/specs to describe auto accrual instead of manual movement.
