## 1. Database — Migrations

- [x] 1.1 Viết `supabase/migrations/20260530200000_service_catalog.sql` — tạo bảng `service_catalog`
- [x] 1.2 Viết `supabase/migrations/20260530200001_building_services.sql` — tạo bảng `building_services`
- [x] 1.3 Viết `supabase/migrations/20260530200002_contract_services.sql` — tạo bảng `contract_services`
- [x] 1.4 Viết `supabase/migrations/20260530200003_seed_service_catalog.sql` — INSERT 8 catalog items
- [x] 1.5 Viết `supabase/migrations/20260530200004_migrate_default_fees.sql` — migrate data từ `buildings.default_service_fees` JSONB → `building_services` rows (best-effort, chỉ map nếu format khớp)
- [x] 1.6 Viết `supabase/migrations/20260530200005_drop_default_service_fees.sql` — `ALTER TABLE buildings DROP COLUMN default_service_fees`
- [x] 1.7 Apply tất cả migrations lên Supabase

## 2. Types & Mappers

- [x] 2.1 Sửa `app/types/database.types.ts`
- [x] 2.2 Tạo `app/types/service-catalog.ts`
- [x] 2.3 Tạo `app/types/building-services.ts`
- [x] 2.4 Tạo `app/types/contract-services.ts`
- [x] 2.5 Tạo `app/utils/mappers/service-catalog.ts`
- [x] 2.6 Tạo `app/utils/mappers/building-services.ts`
- [x] 2.7 Tạo `app/utils/mappers/contract-services.ts`

## 3. Validators

- [x] 3.1 Tạo `app/utils/validators/building-services.ts`
- [x] 3.2 Tạo `app/utils/validators/contract-services.ts`

## 4. Server — Repositories

- [x] 4.1 Tạo `server/repositories/service-catalog/index.ts`:
  - `findAll()` → tất cả catalog items active, order by sort_order

- [x] 4.2 Tạo `server/repositories/building-services/index.ts`:
  - `findByBuilding(event, buildingId)` → join catalog, order by sort_order
  - `upsert(event, buildingId, catalogId, data)` → INSERT ... ON CONFLICT UPDATE
  - `update(event, id, data)` → UPDATE building_services

- [x] 4.3 Tạo `server/repositories/contract-services/index.ts`:
  - `findByContract(event, contractId)` → join catalog, order by sort_order
  - `cloneFromBuilding(event, contractId, buildingId)` → copy active building_services → INSERT contract_services
  - `update(event, id, data)` → UPDATE contract_services

## 5. Server — Services

- [x] 5.1 Tạo `server/services/service-catalog/index.ts` — `list()` gọi repository
- [x] 5.2 Tạo `server/services/building-services/index.ts` — `list()`, `update()` gọi repository
- [x] 5.3 Tạo `server/services/contract-services/index.ts` — `list()`, `update()`, `cloneFromBuilding()` gọi repository

## 6. Server — API Endpoints

- [x] 6.1 Tạo `server/api/service-catalog/index.get.ts`
- [x] 6.2 Tạo `server/api/building-services/index.get.ts`
- [x] 6.3 Tạo `server/api/building-services/index.post.ts`
- [x] 6.4 Tạo `server/api/building-services/[id].patch.ts`
- [x] 6.5 Tạo `server/api/contract-services/index.get.ts`
- [x] 6.6 Tạo `server/api/contract-services/[id].patch.ts`
- [x] 6.7 Sửa `server/utils/permissions.ts`

## 7. Server — Contract Integration

- [x] 7.1 Sửa `server/services/contracts/index.ts` — `create()`:
  - Sau INSERT contract → gọi `ContractServiceService.cloneFromBuilding(event, contractId, input.building_id)`
  - Không throw nếu clone fail (best-effort) — log error, contract đã tạo thành công

## 8. Client — Composables

- [x] 8.1 Tạo `app/composables/buildings/useBuildingServices.ts`:
  - `useFetch('/api/building-services?building_id=...')`
  - `updateService(id, data)` → `$fetch PATCH`
  - `upsertService(buildingId, catalogId, data)` → `$fetch POST`

- [x] 8.2 Tạo `app/composables/contracts/useContractServices.ts`:
  - `useFetch('/api/contract-services?contract_id=...')`
  - `updateService(id, data)` → `$fetch PATCH`

## 9. Client — Components

- [x] 9.1 Tạo `app/components/buildings/BuildingServiceSettings.vue`:
  - Table hiển thị tất cả catalog items (8 items)
  - Mỗi row: tên, loại tính, đơn vị, toggle `is_active`, input `default_amount`
  - Auto-save khi toggle hoặc blur input amount
  - Nếu building chưa có `building_services` row cho catalog item → upsert khi admin enable lần đầu

- [x] 9.2 Tạo `app/components/contracts/ContractServicesTab.vue`:
  - Nhận `services: ContractService[]` qua props
  - Hiển thị bảng: Dịch vụ | Đơn giá | Số lượng | Thành tiền | Bật/Tắt | Ghi chú
  - Emit update events khi admin sửa quantity/is_enabled/notes
  - Dùng trong cả create wizard và contract detail

## 10. Client — Pages

- [x] 10.1 Tạo `app/pages/buildings/[id]/settings.vue` — trang Cài đặt dịch vụ; link từ building detail

- [x] 10.2 Sửa `app/pages/contracts/create.vue`

- [x] 10.3 Sửa `app/pages/contracts/[id]/index.vue`

## 11. Verify

- [x] 11.1 Chạy `npm run typecheck` — 0 errors
- [x] 11.2 Chạy `npm run lint` — 0 errors
- [x] 11.3 Test: GET /api/service-catalog → 8 items
- [x] 11.4 Test: Building settings → bật dịch vụ "Internet" + nhập 200000 → lưu thành công
- [x] 11.5 Test: Tạo contract mới → contract_services tự động clone từ building (active services only)
- [x] 11.6 Test: Contract detail tab Dịch vụ → hiển thị đúng; sửa quantity → save thành công
- [x] 11.7 Test: Thay đổi giá trong building_services → contracts cũ không bị ảnh hưởng (snapshot)
- [x] 11.8 Test: `buildings.default_service_fees` column không còn tồn tại
