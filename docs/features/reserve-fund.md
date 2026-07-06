# Reserve Fund

Admin and owner users can track one reserve fund per building. The fund balance is derived from `reserve_fund_transactions`: deposits increase the balance, withdrawals decrease it, and managers receive no reserve-fund capabilities.

Current behavior:

- `GET /api/reserve-funds/[buildingId]` returns the fund, derived balance, and transactions.
- `POST /api/reserve-funds/[buildingId]/deposit` records a positive deposit.
- `POST /api/reserve-funds/[buildingId]/withdraw` records a positive withdrawal only when the derived balance remains non-negative.
- Creating a building expense with `funded_by = reserve_fund` creates the expense and a linked withdrawal.
- If linked withdrawal creation fails after the expense row is created, the service deletes that newly created expense so no orphan reserve-funded expense remains.
- Voiding a reserve-funded expense records a compensating deposit so the derived balance is restored.

The reserve fund is a cash pool, not a separate expense category, so it does not change operations-report profit math. Reserve-funded expenses still count as normal building expenses and are marked in the expense list.
