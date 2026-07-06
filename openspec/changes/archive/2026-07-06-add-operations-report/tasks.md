## 1. Schema And Contracts

- [x] 1.1 Add migration for `building_expenses` and `building_fixed_costs` with indexes and RLS safety policies
- [x] 1.2 Regenerate or update database type surface used by the app
- [x] 1.3 Add operations report DTOs, constants, mappers, and Zod validators
- [x] 1.4 Add operations capabilities to the shared permission map

## 2. Server Implementation

- [x] 2.1 Add repositories for expenses, fixed costs, and report aggregate queries
- [x] 2.2 Add services that enforce permissions, building scope, fixed-cost overlap rules, soft-void behavior, and report aggregation
- [x] 2.3 Add API routes for report, expense CRUD, and fixed-cost CRUD
- [x] 2.4 Add focused server tests for report calculations, scope/permissions, expense voiding, and fixed-cost ranges

## 3. Client Implementation

- [x] 3.1 Add composables for report loading and expense/fixed-cost mutations
- [x] 3.2 Add `/operations-report` page with building/month/category filters and report sections
- [x] 3.3 Add expense create/edit/void UI using existing UI primitives and capability gates
- [x] 3.4 Add fixed-cost management UI or scoped controls if included in MVP page

## 4. Documentation And Verification

- [x] 4.1 Update API, database, auth-permissions, and operations-report docs
- [x] 4.2 Run `npx.cmd openspec validate --specs`
- [x] 4.3 Run focused tests and `npm run typecheck`
- [x] 4.4 Manually smoke the operations report page/API with scoped building filters
