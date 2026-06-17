## 1. Shared Code Generation Logic

- [x] 1.1 Tạo `app/utils/format/codes.ts` — `buildingCodeFromSlug(slug)`: first char per word, lowercase
- [x] 1.2 Thêm `nameInitialsFromFullName(fullName)`: slugify → split('-') → first char each word
- [x] 1.3 Viết unit tests cho `buildingCodeFromSlug` và `nameInitialsFromFullName` (conflict cases, dấu tiếng Việt, single-word name)

## 2. DB Migration — buildings.code

- [x] 2.1 Tạo migration `add_building_codes.sql`: thêm cột `buildings.code text`, backfill từ slug qua `buildingCodeFromSlug` logic (SQL function), unique index, NOT NULL
- [x] 2.2 Cập nhật `app/types/database.types.ts` (regenerate hoặc thêm tay `code: string` vào `buildings` Row/Insert/Update)

## 3. DB Migration — rooms.slug + rooms.code

- [x] 3.1 Tạo migration `add_room_slugs_codes.sql`: thêm `rooms.slug text`, backfill = `lower(regexp_replace(room_number, '[^a-z0-9]+', '-', 'gi'))`, unique index `UNIQUE(building_id, slug)`
- [x] 3.2 Thêm `rooms.code text`: backfill = `buildings.code || '-' || rooms.slug` (JOIN), unique index `UNIQUE(code)`, NOT NULL
- [x] 3.3 Cập nhật `database.types.ts` — thêm `slug: string`, `code: string` vào `rooms` Row

## 4. DB Migration — tenants.code

- [x] 4.1 Tạo migration `add_tenant_codes.sql`: thêm `tenants.code text`, backfill sequences theo initials+year từ `full_name` và `created_at`, unique index, NOT NULL
- [x] 4.2 Cập nhật `database.types.ts` — thêm `code: string` vào `tenants` Row

## 5. DB Migration — contract_code format

- [x] 5.1 Tạo migration `update_contract_codes.sql`: UPDATE trong 1 transaction, JOIN `contracts → rooms → buildings`, đổi `hd-YYYY-NNNN` → `hd-{building.code}-YYYY-NNNN`
- [x] 5.2 Verify migration: tất cả contract_code sau migration đều match pattern `^hd-[a-z0-9]+-[0-9]{4}-[0-9]{4}$`

## 6. Server — Building code

- [x] 6.1 Cập nhật `server/repositories/buildings/index.ts` — `buildUniqueCode()`: query conflicts, auto-suffix, gọi `buildingCodeFromSlug` từ `codes.ts`
- [x] 6.2 Thêm `code` vào `BuildingRepository.insert()` và `update()` (check lock: reject nếu có rooms)
- [x] 6.3 Cập nhật `app/utils/mappers/buildings.ts` — thêm `code: row.code` vào `mapBuilding`
- [x] 6.4 Cập nhật `app/types/buildings.ts` — thêm `code: string` vào `Building` interface

## 7. Server — Room slug + code

- [x] 7.1 Cập nhật `server/repositories/rooms/index.ts` — `insert()`: tự generate `slug` + `code` khi tạo phòng
- [x] 7.2 Cập nhật `findByIdentifier(identifier)` trong rooms repo: `isUuid` → `id`, else → `code` column
- [x] 7.3 Cập nhật `app/utils/mappers/rooms.ts` — thêm `slug: row.slug`, `code: row.code`
- [x] 7.4 Cập nhật `app/types/rooms.ts` — thêm `slug: string`, `code: string` vào `Room`

## 8. Server — Tenant code

- [x] 8.1 Cập nhật `server/repositories/tenants/index.ts` — `buildUniqueTenantCode(event, fullName, createdAt)`: query max seq cho `{initials}-{year}`, return next
- [x] 8.2 Gọi `buildUniqueTenantCode` trong `insert()`, lưu vào `code`
- [x] 8.3 Cập nhật `findByIdentifier` tenant: `isUuid` → `id`, else → `code`
- [x] 8.4 Cập nhật `app/utils/mappers/tenants.ts` — thêm `code: row.code`
- [x] 8.5 Cập nhật `app/types/tenants.ts` — thêm `code: string` vào `Tenant`

## 9. Server — Contract code v2

- [x] 9.1 Cập nhật `buildUniqueContractCode` trong `server/repositories/contracts/index.ts`: nhận thêm `buildingCode`, prefix = `hd-{buildingCode}-{year}`, sequence scoped per prefix
- [x] 9.2 Cập nhật `ContractRepository.insert()` để resolve `building.code` trước khi gọi code generator
- [x] 9.3 Đảm bảo `findByIdentifier` contracts vẫn hoạt động với cả UUID và code mới

## 10. Client — Route helpers

- [x] 10.1 Cập nhật `app/utils/routes/operational.ts` — `tenantPath(tenant)`: nhận `{ code }`, return `/tenants/${tenant.code}`
- [x] 10.2 Cập nhật `roomPath(room)`: dùng `room.code` cho canonical path `/rooms/${room.code}`; giữ `/buildings/:slug/rooms/:slug` chỉ cho redirect context
- [x] 10.3 Cập nhật `TenantRouteSubject` interface — thay `id` bằng `code`
- [x] 10.4 Cập nhật `RoomRouteSubject` interface — thêm `code?: string`

## 11. Client — Route pages rename

- [x] 11.1 Rename `app/pages/rooms/[id]/` → `app/pages/rooms/[code]/` (index.vue + edit.vue)
- [x] 11.2 Rename `app/pages/tenants/[id]/` → `app/pages/tenants/[code]/`
- [x] 11.3 Rename `app/pages/contracts/[id]/` → `app/pages/contracts/[code]/`
- [x] 11.4 Cập nhật tất cả `route.params.id` → `route.params.code` trong 6 page files

## 12. Client — UUID redirect

- [x] 12.1 Trong `app/pages/rooms/[code]/index.vue`: nếu `isUuid(code)` → fetch room by id → `navigateTo(roomPath(room), { replace: true })`
- [x] 12.2 Trong `app/pages/tenants/[code]/index.vue`: nếu `isUuid(code)` → fetch tenant by id → `navigateTo(tenantPath(tenant), { replace: true })`
- [x] 12.3 Trong `app/pages/contracts/[code]/index.vue`: nếu `isUuid(code)` → fetch contract by id → `navigateTo(contractPath(contract), { replace: true })`

## 13. Client — Building settings UI

- [x] 13.1 Thêm field `code` vào building settings form (`app/pages/buildings/[id]/settings.vue`)
- [x] 13.2 Hiển thị lock state: disable field + tooltip khi building đã có rooms

## 14. Smoke test + cleanup

- [x] 14.1 Chạy typecheck toàn bộ project, fix type errors
- [x] 14.2 Test manual: `/rooms/zhpn-b201`, `/tenants/nva-2026-0001`, `/contracts/hd-zhpn-2026-0001` resolve đúng
- [x] 14.3 Test manual: UUID URL cũ redirect đúng về code URL
- [x] 14.4 Test manual: tạo building mới → code auto-generate, hiển thị trong settings
- [x] 14.5 Test manual: tạo contract mới → code dùng format `hd-{bcode}-YYYY-NNNN`
