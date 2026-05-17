## Why

Contract hiện tại chỉ ghi nhận 1 người thuê chính (`tenant_id`), nhưng thực tế nhiều phòng có nhiều người ở cùng. Cần quản lý danh sách người ở (roommate/occupant) theo hợp đồng để phục vụ billing theo đầu người và lịch sử ra vào phòng.

## What Changes

- Thêm API CRUD cho `contract_occupants` (list, add, move-out, delete)
- Thêm composable `useContractOccupants` để client fetch và mutate
- Thêm UI trên trang chi tiết hợp đồng: hiển thị danh sách người ở, form thêm roommate, action move-out
- Admin có thể xoá record; manager chỉ xem

## Capabilities

### New Capabilities
- `contract-occupants-api`: API endpoints để list, add, move-out, và delete occupant của một hợp đồng
- `contract-occupants-client`: Composable và UI để quản lý roommate trên trang contract detail

### Modified Capabilities
- `contracts-client`: Trang contract detail thêm section "Người ở" với danh sách và form thêm roommate

## Impact

- **Server**: `server/repositories/contract-occupants/`, `server/services/contract-occupants.ts`, `server/api/contracts/[id]/occupants.*`
- **Client**: `app/composables/contracts/useContractOccupants.ts`, `app/components/contracts/ContractOccupantForm.vue`, `app/pages/contracts/[id]/index.vue`
- **Types**: `app/types/contract-occupants.ts` (rename/move từ trong `meter-devices.ts`), `app/utils/validators/contract-occupants.ts`
- **DB**: Table `contract_occupants` đã tồn tại — không cần migration mới
