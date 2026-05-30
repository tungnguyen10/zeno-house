## Why

Trước khi bắt đầu phase 3 (Invoicing/Billing), cần giải quyết 4 vấn đề tích lũy từ v0.2.5: UI dark theme bị vỡ trên 3 components quan trọng, thiếu `buildingId` trong `ContractWithDetails.room`, contracts thiếu `payment_day` riêng, và `building_id` nullable trên contracts gây ambiguity khi tính hóa đơn.

## What Changes

- **Fix dark theme** cho `BuildingServiceSettings.vue`, `BuildingServicesMatrix.vue`, `ContractServicesTab.vue` — đổi light Tailwind classes sang dark design system token
- **Thêm `buildingId` vào `ContractWithDetails.room`** — cập nhật DETAIL_SELECT query, type, mapper trong contracts domain
- **Thêm `payment_day` vào contracts** — migration `ALTER TABLE contracts ADD COLUMN payment_day int`, cập nhật type/validator/form
- **Làm chặt `building_id` NOT NULL trên contracts** — migration backfill từ `rooms.building_id` rồi ALTER TABLE, xóa null-guard workarounds

## Capabilities

### New Capabilities
*(không có — đây là cleanup, không thêm feature mới)*

### Modified Capabilities
- `contracts-database`: thêm `payment_day` column, đặt `building_id` NOT NULL
- `contracts-api`: cập nhật ContractWithDetails type để thêm `room.buildingId`, thêm `payment_day` vào create/update schema
- `contracts-client`: cập nhật ContractForm để có field `payment_day`

## Impact

**Database:** 1 migration cho `contracts.payment_day`, 1 migration cho `contracts.building_id NOT NULL` (với backfill)

**Server:**
- `server/repositories/contracts/index.ts` — DETAIL_SELECT thêm `rooms(building_id, ...)`
- `server/repositories/contracts/index.ts` — update `findAll` filter `building_id` dùng trực tiếp thay vì join workaround

**Types:**
- `app/types/contracts.ts` — `ContractWithDetails.room` thêm `buildingId: string`
- `app/types/database.types.ts` — `contracts.building_id` đổi thành `string` (non-null), thêm `payment_day: number | null`
- `app/utils/validators/contracts.ts` — thêm `payment_day` optional field

**Mappers:**
- `app/utils/mappers/contracts.ts` — thêm `buildingId: row.rooms.building_id`

**Components (dark theme fix):**
- `app/components/buildings/BuildingServiceSettings.vue`
- `app/components/buildings/BuildingServicesMatrix.vue`
- `app/components/contracts/ContractServicesTab.vue`

**Form:**
- `app/components/contracts/ContractForm.vue` — thêm field `payment_day`
