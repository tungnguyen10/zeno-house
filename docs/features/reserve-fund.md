# Reserve Fund

Admin and owner users can track one reserve fund per building. The fund is an accounting ledger: billing close, operations-report close, month-end report auto-close, or admin refresh records an automatic accrual from operations profit; reserve-funded expenses record linked deductions; and the derived balance may be negative. Managers receive no reserve-fund capabilities.

Current behavior:

- `GET /api/reserve-funds/[buildingId]` returns the fund, active derived balance, and transactions for users with `reserve-fund.read`.
- `POST /api/reserve-funds/[buildingId]/refresh-accrual` lets admins refresh the formula-derived `monthly_accrual` for one building/month.
- `GET /api/reserve-fund-rates`, `POST /api/reserve-fund-rates`, and `PATCH /api/reserve-fund-rates/[id]` manage period-based building reserve rate history for users with `reserve-fund.manage`.
- Closing a billing period, closing an operations report, auto-closing the report at month end, or admin-refreshing accrual upserts one `monthly_accrual` transaction for the building/month. The amount is `max(issued revenue - report expenses, 0) * effective_rate / 100`.
- If no rate applies, closing still records a zero-rate monthly accrual for that period.
- Only admin can manually refresh accrual. Refresh never creates a manual deposit/withdrawal and never accepts a typed amount; it accepts only `period_year` and `period_month`, recalculates the formula, and upserts the existing monthly accrual row.
- Manual refresh is the escape hatch when expenses are added, edited, voided, allocated, or otherwise changed after billing close. If refresh is not used, operations-report close or month-end report auto-close will still refresh the latest accrual.
- Creating or updating a building expense with `funded_by = reserve_fund` creates or updates one linked `expense_deduction` transaction.
- Voiding a reserve-funded expense voids the linked deduction so it no longer affects active balance.
- Manual deposit and withdrawal controls are no longer part of the UI. Legacy manual transactions can remain in the ledger for historical balance math.

The reserve fund is not a tenant-facing charge. Reserve-funded expenses are marked in the expense list and tracked through linked deductions; direct expenses, fixed costs, and prepaid allocations drive operations profit for accrual calculation.
