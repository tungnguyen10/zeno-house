## Why

The current reserve fund model treats the fund as a manually managed cash ledger with deposits, withdrawals, and non-negative balance checks. The desired operating model is different: each building automatically sets aside a configured percentage of issued monthly revenue, and reserve-funded expenses deduct from that running fund even when the balance goes negative.

This change aligns reserve fund behavior with monthly operations reporting while reusing the existing `reserve_funds`, `reserve_fund_transactions`, and `building_expenses.funded_by` surfaces instead of creating parallel snapshot tables.

## What Changes

- Replace manual reserve deposits/withdrawals with automatic monthly accruals derived from billing issued revenue and an effective reserve rate.
- Add building-level reserve rate history in building settings, with period-based effective ranges.
- Reuse `reserve_fund_transactions` as the reserve ledger:
  - monthly accrual rows increase the fund
  - reserve-funded expense deduction rows decrease the fund
  - voided deductions no longer reduce the fund
- Allow reserve fund balances to become negative.
- Update billing close so closing a period creates or updates the monthly reserve accrual transaction for that building/month.
- Update operations report so it returns and displays monthly reserve accrual, reserve-funded expense deductions, monthly reserve balance, and cumulative building reserve balance.
- Update expense handling so ticking "Trừ quỹ dự phòng" stores `funded_by = reserve_fund` and records a linked deduction without requiring sufficient balance.
- Remove manual reserve deposit/withdraw controls and stop using manual deposit/withdraw API flows in the UI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reserve-fund`: Change reserve funds from manual non-negative ledgers to auto-accrual plus expense-deduction ledgers that may go negative.
- `operations-report`: Surface reserve fund accrual/deduction/cumulative figures and allow expense creation from reserve without balance blocking.
- `billing-api`: Closing a billing period creates or refreshes the reserve accrual for the period using issued revenue and the effective reserve rate.

## Impact

- Database: add reserve rate history and extend `reserve_fund_transactions` with period/source/snapshot metadata and voiding support.
- Server: update reserve fund services/repositories, billing close flow, operations report aggregation, and building settings APIs.
- Client: update building settings, operations report reserve panel, and expense modal copy/behavior.
- Tests/docs/specs: replace manual reserve deposit/withdraw expectations with auto-accrual and deduction behavior.
