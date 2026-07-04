## Why

Operators set aside money for large or unexpected costs such as a lift repair or repainting, but the app has no place to track that reserve. Without it, a big withdrawal distorts a single month's profit and the running balance lives in a spreadsheet or someone's memory. This change adds a simple per-building reserve fund with manual deposits and withdrawals and a running balance, and lets an expense be funded from the reserve so the money movement and the cost are linked.

## What Changes

- Add a per-building reserve fund with a running balance.
- Add manual deposit and withdrawal transactions with date, amount, and note.
- Let a withdrawal be tied to a building expense so paying from the reserve records both the expense and the fund movement.
- Add a `funded_by` marker on building expenses to distinguish reserve-funded from directly paid.
- Show fund balance and history on the operations report and offer a "pay from reserve" option in the expense form when a balance exists.
- Add capabilities: reserve read/deposit/withdraw for admin/owner only.

## Capabilities

### New Capabilities

- `reserve-fund`: Per-building reserve fund, manual deposit/withdrawal transactions, running balance, expense funding linkage, permissions, and scope enforcement.

### Modified Capabilities

- `operations-report`: Add a `funded_by` marker to building expenses and surface fund balance/history alongside the report.

## Impact

- Database: new `reserve_funds` and `reserve_fund_transactions` tables; new `funded_by` column on `building_expenses`; indexes and RLS safety policies; regenerated database types.
- Server: new repositories, services, validators, and API routes; withdrawal-with-expense performed atomically; balance derived from transactions.
- Client: fund panel and history on the operations report; a "pay from reserve" toggle in the expense modal when a balance exists.
- Docs/specs: new reserve-fund capability; updates to operations-report, API, database, and auth-permissions docs.
