# Reserve Fund

Admin and owner users can track one reserve fund per building. The fund is an accounting ledger: monthly billing close records an automatic accrual from issued revenue, reserve-funded expenses record linked deductions, and the derived balance may be negative. Managers receive no reserve-fund capabilities.

Current behavior:

- `GET /api/reserve-funds/[buildingId]` returns the fund, active derived balance, and transactions for users with `reserve-fund.read`.
- `GET /api/reserve-fund-rates`, `POST /api/reserve-fund-rates`, and `PATCH /api/reserve-fund-rates/[id]` manage period-based building reserve rate history for users with `reserve-fund.manage`.
- Closing a billing period upserts one `monthly_accrual` transaction for the building/month. The amount is `issued_revenue * effective_rate / 100`, using non-void issued invoice totals.
- If no rate applies, closing still records a zero-rate monthly accrual for that period.
- Creating or updating a building expense with `funded_by = reserve_fund` creates or updates one linked `expense_deduction` transaction.
- Voiding a reserve-funded expense voids the linked deduction so it no longer affects active balance.
- Manual deposit and withdrawal controls are no longer part of the UI. Legacy manual transactions can remain in the ledger for historical balance math.

The reserve fund is not a tenant-facing charge and does not change operations-report profit math. Reserve-funded expenses still count as normal building expenses and are marked in the expense list.
