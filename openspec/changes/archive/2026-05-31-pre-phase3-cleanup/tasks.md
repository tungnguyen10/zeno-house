## 1. Database Migrations

- [x] 1.1 Tạo `supabase/migrations/20260531000000_contracts_backfill_building_id.sql`: backfill `building_id` từ `rooms.building_id` cho các rows có NULL, rồi `ALTER TABLE contracts ALTER COLUMN building_id SET NOT NULL`
- [x] 1.2 Tạo `supabase/migrations/20260531000001_contracts_payment_day.sql`: `ALTER TABLE contracts ADD COLUMN payment_day smallint CHECK (payment_day BETWEEN 1 AND 31)`
- [x] 1.3 Apply cả 2 migrations lên Supabase

## 2. Types

- [x] 2.1 Sửa `app/types/database.types.ts` — `contracts.building_id` đổi từ `string | null` thành `string` (Row, Insert, Update)
- [x] 2.2 Sửa `app/types/database.types.ts` — thêm `payment_day: number | null` vào contracts Row/Insert/Update
- [x] 2.3 Sửa `app/types/contracts.ts` — `Contract.buildingId` đổi từ `string | null` thành `string`
- [x] 2.4 Sửa `app/types/contracts.ts` — thêm `paymentDay: number | null` vào `Contract`
- [x] 2.5 Sửa `app/types/contracts.ts` — `ContractWithDetails.room` thêm `buildingId: string`

## 3. Mapper & Repository

- [x] 3.1 Sửa `app/utils/mappers/contracts.ts` — thêm `buildingId: row.rooms.building_id` vào `mapContractWithDetails`; `buildingId: row.building_id` (non-null) vào `mapContract`; thêm `paymentDay: row.payment_day ?? null`
- [x] 3.2 Sửa `server/repositories/contracts/index.ts` — cập nhật `DETAIL_SELECT` để join `rooms(id, room_number, floor, building_id, buildings(name))`
- [x] 3.3 Sửa `server/repositories/contracts/index.ts` — `findAll` filter `building_id`: dùng `.eq('building_id', filters.building_id)` trực tiếp (bỏ workaround join qua rooms)

## 4. Validator & API

- [x] 4.1 Sửa `app/utils/validators/contracts.ts` — thêm `payment_day: z.number().int().min(1).max(31).nullable().optional()` vào cả `contractCreateSchema` và `contractUpdateSchema`

## 5. Component: ContractForm

- [x] 5.1 Sửa `app/components/contracts/ContractForm.vue` — thêm field `payment_day` (number input, optional, range 1–31, label "Ngày thanh toán (ghi đè tòa nhà)") vào section commercial terms

## 6. Dark Theme Fix

- [x] 6.1 Sửa `app/components/buildings/BuildingServiceSettings.vue` — đổi tất cả `bg-gray-50/bg-white/text-gray-*/border-gray-*` sang dark tokens (`bg-dark-surface`, `bg-dark-card`, `border-dark-border`, `text-white`, `text-muted`, input: `bg-dark-surface border-dark-border text-white focus:ring-cyan/30 focus:outline-none`)
- [x] 6.2 Sửa `app/components/buildings/BuildingServicesMatrix.vue` — tương tự dark token fix
- [x] 6.3 Sửa `app/components/contracts/ContractServicesTab.vue` — tương tự dark token fix

## 7. Verify

- [x] 7.1 Chạy `npm run typecheck` — 0 errors
- [x] 7.2 Chạy `npm run lint` — 0 errors
