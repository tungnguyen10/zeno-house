## 1. Database

- [x] 1.1 Tạo migration thêm columns vào `contracts`: `previous_contract_id` (uuid nullable FK self), `original_end_date` (date nullable), `renewal_count` (int default 0). Thêm status `renewed` vào CHECK constraint.
- [x] 1.2 Tạo migration tạo `contract_renewals` table: id, contract_id, new_contract_id (nullable, cho mode new_contract), mode (extend|new_contract), old_end_date, new_end_date, old_monthly_rent, new_monthly_rent, reason (text nullable), created_by (uuid FK users), created_at.
- [x] 1.3 Update `app/types/database.types.ts` — thêm columns mới vào contracts; thêm `contract_renewals` table

## 2. Types, Validators, Mapper

- [x] 2.1 Update `app/types/contracts.ts` — thêm `previousContractId`, `originalEndDate`, `renewalCount` vào `Contract`; thêm status `renewed`
- [x] 2.2 Tạo `app/types/contract-renewals.ts` với `ContractRenewalMode`, `ContractRenewal` interface
- [x] 2.3 Tạo `app/utils/validators/contract-renewals.ts` với `contractRenewSchema` (Zod) — mode, new_end_date (required cho extend), new contract fields (required cho new_contract)
- [x] 2.4 Update `app/utils/mappers/contracts.ts` — map `previousContractId`, `originalEndDate`, `renewalCount`
- [x] 2.5 Tạo `app/utils/mappers/contract-renewals.ts` với `mapContractRenewal(row)`

## 3. Server API

- [x] 3.1 Tạo `server/repositories/contract-renewals/index.ts` với `listByContract(contractId)` và `insert(input)`
- [x] 3.2 Tạo `server/services/contract-renewals.ts` với `renew(user, contractId, input)` — xử lý cả 2 modes, update contract, tạo log
- [x] 3.3 Tạo `server/api/contracts/[id]/renew.post.ts` — POST /api/contracts/:id/renew

## 4. Client

- [x] 4.1 Tạo `app/composables/contracts/useContractRenewals.ts` với `renewals`, `isLoading`, `renew(input)`
- [x] 4.2 Tạo `app/components/contracts/ContractRenewalForm.vue` — form chọn mode (extend / new contract), new end date, optional new rent và reason
- [x] 4.3 Update `app/pages/contracts/[id]/index.vue` — thêm "Gia hạn hợp đồng" action button, hiển thị renewal history và link previous contract

## 5. Verify

- [x] 5.1 Run npm run lint && npm run typecheck
