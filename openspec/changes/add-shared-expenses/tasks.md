## 1. Schema And Contracts

- [x] 1.1 Add migration for `shared_expenses` (owner_id, name, category, amount, note, is_active, created_by, timestamps) with indexes and RLS safety policies
- [x] 1.2 Add migration for `shared_expense_buildings` (shared_expense_id, building_id, unique pair) with indexes and RLS safety policies
- [x] 1.3 Regenerate/update database types
- [x] 1.4 Add DTOs, mappers, and Zod validators for shared expenses and allocation input
- [x] 1.5 Add capabilities `shared-expenses.read/write/allocate` to owner (admin inherits); grant none to manager

## 2. Server Implementation

- [x] 2.1 Add repository for shared-expense CRUD, membership management, and per-period generation lookups
- [x] 2.2 Add service enforcing owner ownership on read/write and building scope for every member building on allocate
- [x] 2.3 Implement even-split allocation with rounding-remainder absorption and an idempotency guard against duplicate period generation
- [x] 2.4 Generate one `building_expenses` row per member building on allocate, tagged with a shared-origin note
- [x] 2.5 Add API routes: `GET/POST /api/shared-expenses`, `PATCH/DELETE /api/shared-expenses/[id]`, `POST /api/shared-expenses/[id]/allocate`
- [x] 2.6 Add server tests for equal split + rounding invariant, owner/scope enforcement, manager denial, and duplicate-allocation guard

## 3. Client Implementation

- [x] 3.1 Add `useSharedExpenses` composable
- [x] 3.2 Add `/shared-expenses` page listing shared expenses with create/edit/delete gated by `shared-expenses.write`
- [x] 3.3 Add a building multi-select with an even-split allocation preview (per-building share)
- [x] 3.4 Add an "Phân bổ kỳ này" action gated by `shared-expenses.allocate` with a period selector and result confirmation
- [x] 3.5 Ensure managers do not see the shared-expenses navigation or page

## 4. Documentation And Verification

- [x] 4.1 Update API, database, and auth-permissions docs; add a shared-expenses feature note
- [x] 4.2 Run `npx openspec validate --specs`
- [ ] 4.3 Run focused tests and `npm run typecheck`
- [ ] 4.4 Manually smoke: create a shared expense over two buildings, allocate a period, verify one expense per building in each report, verify re-allocation is guarded, verify manager cannot access
