## 1. Database

- [x] 1.1 Tạo migration `contract_payments` table với các columns: id, contract_id, tenant_id (nullable), payment_type (enum), amount, covered_period_start (varchar 7), covered_period_end (varchar 7), paid_at, payment_method (varchar nullable), note, created_at, updated_at. RLS: admin all, manager select.
- [x] 1.2 Update `app/types/database.types.ts` thêm `contract_payments` table Row/Insert/Update

## 2. Types, Validators, Mapper

- [x] 2.1 Tạo `app/types/contract-payments.ts` với `ContractPaymentType`, `ContractPayment` interface
- [x] 2.2 Tạo `app/utils/validators/contract-payments.ts` với `contractPaymentCreateSchema` (Zod)
- [x] 2.3 Tạo `app/utils/mappers/contract-payments.ts` với `mapContractPayment(row)`

## 3. Server API

- [x] 3.1 Tạo `server/repositories/contract-payments/index.ts` với `listByContract(contractId)` và `insert(input)`
- [x] 3.2 Tạo `server/services/contract-payments.ts` với `list(user, contractId)` và `create(user, contractId, input)` — check contract exists + permission
- [x] 3.3 Tạo `server/api/contracts/[id]/payments.get.ts` — GET /api/contracts/:id/payments
- [x] 3.4 Tạo `server/api/contracts/[id]/payments.post.ts` — POST /api/contracts/:id/payments

## 4. Client

- [x] 4.1 Tạo `app/composables/contracts/useContractPayments.ts` với `payments`, `isLoading`, `addPayment(input)`
- [x] 4.2 Tạo `app/components/contracts/ContractPaymentForm.vue` — form thêm payment (type, amount, paid_at, method, note, period)
- [x] 4.3 Update `app/pages/contracts/[id]/index.vue` — thêm section "Thanh toán" hiển thị danh sách payments và form thêm mới

## 5. Verify

- [x] 5.1 Run npm run lint && npm run typecheck
