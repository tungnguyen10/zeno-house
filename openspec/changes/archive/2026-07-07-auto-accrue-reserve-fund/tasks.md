## 1. Database And Types

- [x] 1.1 Add migration for `building_reserve_fund_rates` with period range fields, RLS policies, indexes, and updated-at trigger.
- [x] 1.2 Extend `reserve_fund_transactions` with `source`, `period_year`, `period_month`, `billing_period_id`, `reserve_rate_percent`, `issued_revenue`, `voided_at`, `voided_by`, and `void_reason`.
- [x] 1.3 Add DB constraints/indexes for one monthly accrual per fund/month and one active expense deduction per linked expense.
- [x] 1.4 Regenerate `app/types/database.types.ts` after applying schema changes.
- [x] 1.5 Update operations-report DTOs and mappers for reserve rate rows, transaction source metadata, void fields, and reserve summary data.

## 2. Reserve Fund Backend

- [x] 2.1 Replace manual deposit/withdraw service behavior with monthly accrual and expense deduction service methods.
- [x] 2.2 Add reserve rate repository/service methods to list, create, end/update, and find the effective rate for a building/month.
- [x] 2.3 Enforce reserve rate capability checks and building scope in services, following existing building fixed-cost patterns.
- [x] 2.4 Create or update linked expense deduction transactions when reserve-funded expenses are created or updated.
- [x] 2.5 Void linked reserve deduction transactions when reserve-funded expenses are voided.
- [x] 2.6 Remove insufficient-balance validation from reserve-funded expense flows.

## 3. Billing And Report Integration

- [x] 3.1 Update billing period close flow to calculate issued revenue and upsert the monthly reserve accrual transaction.
- [x] 3.2 Ensure close/reclose behavior is idempotent for the same building/month reserve accrual.
- [x] 3.3 Update operations report aggregation to return effective rate, issued revenue, monthly accrual, monthly deduction, monthly reserve balance, and cumulative reserve balance.
- [x] 3.4 Ensure operations report excludes voided reserve transactions and voided expenses from reserve deductions.
- [x] 3.5 Update export behavior if operations-report export includes reserve fund data.

## 4. Client UI

- [x] 4.1 Add building settings UI for reserve rate history management.
- [x] 4.2 Remove manual reserve deposit/withdraw controls and client calls.
- [x] 4.3 Update operations report reserve panel to show rate, issued revenue, monthly accrual, monthly deductions, monthly balance, and cumulative balance.
- [x] 4.4 Update expense modal copy to "Trừ quỹ dự phòng" and allow selecting it regardless of current reserve balance.
- [x] 4.5 Ensure users without `reserve-fund.read` do not trigger reserve fund detail requests from the client.

## 5. Tests And Documentation

- [x] 5.1 Update reserve fund service tests for auto accrual, expense deduction, negative balances, update sync, and void sync.
- [x] 5.2 Update operations report tests for reserve summary fields and reserve-funded expense math.
- [x] 5.3 Update billing close tests for monthly accrual creation and idempotent refresh.
- [x] 5.4 Update UI/component tests for removed manual movement controls and balance-independent reserve expense selection.
- [x] 5.5 Update docs for reserve fund, operations report, API inventory, database model, and permission descriptions.
- [x] 5.6 Run targeted finance tests, `npm run typecheck`, `npm test`, `npm run lint`, and OpenSpec validation.
