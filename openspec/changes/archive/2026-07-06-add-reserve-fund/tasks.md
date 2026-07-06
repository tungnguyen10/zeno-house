## 1. Schema And Contracts

- [x] 1.1 Add migration for `reserve_funds` (building_id unique, created_at) with RLS safety policies
- [x] 1.2 Add migration for `reserve_fund_transactions` (fund_id, type, amount, date, linked_expense_id, note, created_by, created_at) with indexes and RLS safety policies
- [x] 1.3 Add migration adding `funded_by` (`direct` | `reserve_fund`, default `direct`) to `building_expenses`
- [x] 1.4 Regenerate/update database types
- [x] 1.5 Add DTOs, mappers, and Zod validators for fund, transactions, deposit/withdraw, and reserve-funded expense input
- [x] 1.6 Add capabilities `reserve-fund.read/deposit/withdraw` to owner (admin inherits); grant none to manager

## 2. Server Implementation

- [x] 2.1 Add repository for fund lookup/create-on-first-use and transaction insert/list
- [x] 2.2 Add service computing derived balance = sum(deposits) − sum(withdrawals)
- [x] 2.3 Implement deposit and withdrawal with a balance guard that rejects negative balances
- [x] 2.4 Implement atomic pay-from-reserve: create expense + linked withdrawal together, setting `funded_by` and `linked_expense_id`, with compensation on failure
- [x] 2.5 Define void behavior: voiding a reserve-funded expense reverses or flags the linked withdrawal so the balance stays correct
- [x] 2.6 Add API routes: `GET /api/reserve-funds/[buildingId]` (fund + transactions), `POST /api/reserve-funds/[buildingId]/deposit`, `POST /api/reserve-funds/[buildingId]/withdraw`; extend expense create to accept reserve funding
- [x] 2.7 Add server tests for balance math, insufficient-balance rejection, atomic pay-from-reserve, void reversal, and scope/permission (manager denied)

## 3. Client Implementation

- [x] 3.1 Add `useReserveFund` composable
- [x] 3.2 Add a "Quỹ dự phòng" panel on the operations report showing current balance and recent transactions, gated by `reserve-fund.read`
- [x] 3.3 Add deposit and withdraw actions gated by the respective capabilities
- [x] 3.4 Add a "Lấy từ quỹ" toggle in `OperationsExpenseModal` shown only when the building balance is positive, with a "còn lại sau" preview
- [x] 3.5 Mark reserve-funded expenses in the expense list; ensure managers never see fund UI or the reserve toggle

## 4. Documentation And Verification

- [x] 4.1 Update operations-report, API, database, and auth-permissions docs
- [x] 4.2 Run `npx openspec validate --specs`
- [x] 4.3 Run focused tests and `npm run typecheck`
- [x] 4.4 Manually smoke: deposit to a fund, pay an expense from reserve, verify balance decreases and expense is marked, void it and verify balance restores, verify manager cannot see the fund
