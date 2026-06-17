## Why

Hiện tại các entity room, tenant, contract đang dùng UUID thô trong URL (`/rooms/30000000-...`, `/tenants/40000000-...`), trong khi building đã có slug (`/buildings/zeno-house-phu-nhuan`). Sự không nhất quán này làm URL khó đọc, khó debug, và không phản ánh cấu trúc nghiệp vụ. Thay vào đó, mỗi entity sẽ có một **code** có ý nghĩa, duy nhất toàn cục, stable sau khi được tạo — đủ để làm URL identifier mà không lộ UUID nội bộ.

## What Changes

**Data layer (DB + server):**

- `buildings` thêm cột `code` (vd: `zhpn`) — short prefix dùng làm namespace cho entity con. **BREAKING** nếu code generation script trùng với slug hiện tại
- `rooms` thêm cột `slug` (scoped: unique per building, vd: `b201`) và `code` (global unique, vd: `zhpn-b201`)
- `tenants` thêm cột `code` (global unique, vd: `nva-2026-0001`) — dạng `{nameInitials}-{year}-{seq}`
- `contracts` đổi format `contract_code` từ `hd-2026-0001` → `hd-{buildingCode}-{year}-{seq}` (vd: `hd-zhpn-2026-0001`). **BREAKING** — migrate toàn bộ rows hiện tại
- Server API endpoints cho rooms, tenants, contracts resolve identifier bằng `code` thay vì chỉ UUID
- Code generation algorithms tập trung tại `app/utils/format/codes.ts` (dùng chung client + server)

**UI layer (routes + components):**

- Route `/rooms/[id]` → `/rooms/[code]` — param đổi từ UUID sang room.code
- Route `/tenants/[id]` → `/tenants/[code]` — param đổi từ UUID sang tenant.code
- Route `/contracts/[id]` → `/contracts/[code]` — param đã dùng contractCode, chỉ cập nhật format
- `app/utils/routes/operational.ts` — thêm `tenantPath(tenant)` nhận code, cập nhật `roomPath` dùng room.code
- Building detail page hiển thị building.code, có thể edit trước khi có phòng đầu tiên

**Tách biệt rõ ràng:**
- Data layer hoàn toàn độc lập: có thể implement và test toàn bộ DB + API trước khi chạm vào UI
- UI layer chỉ consume code từ API response, không tự generate

## Capabilities

### New Capabilities

- `building-code`: Column `buildings.code` — algorithm tạo từ slug (first-char-per-word), conflict auto-suffix, lock rule khi đã có room đầu tiên. Bao gồm DB migration + API + settings UI
- `room-code`: Columns `rooms.slug` + `rooms.code` — backfill từ `room_number`, unique constraints. Bao gồm DB migration + API resolution logic
- `tenant-code`: Column `tenants.code` — format `{nameInitials}-{year}-{seq}`, set khi tạo, immutable. Bao gồm DB migration + API resolution logic
- `contract-code-v2`: Đổi format `contract_code` sang `hd-{buildingCode}-{year}-{seq}`. Bao gồm migration data cũ + cập nhật generation logic

### Modified Capabilities

- `operational-url-identifiers`: Requirements cũ spec này đã anticipate việc dùng code thay UUID. Cần update để reflect:
  - Tenant route dùng `tenant.code` (non-PII, không phải name slug) thay UUID
  - Room route dùng `room.code` globally (thay vì `/buildings/:slug/rooms/:roomSlug`)
  - Contract route dùng format code mới `hd-{buildingCode}-{year}-{seq}`
- `buildings-database`: Thêm requirement cho cột `code`, unique index, lock rule
- `contracts-api`: Requirement cho contract code generation thay đổi format

## Impact

**Database:**
- 4 migrations mới: `add_building_codes`, `add_room_slugs_codes`, `add_tenant_codes`, `update_contract_codes`
- Unique indexes mới: `buildings.code`, `rooms.code`, `UNIQUE(rooms.building_id, rooms.slug)`, `tenants.code`
- Data migration: toàn bộ contracts hiện tại cần update `contract_code`

**Server:**
- `server/repositories/buildings/index.ts` — thêm code generation
- `server/repositories/rooms/index.ts` — thêm slug/code, update findByIdentifier
- `server/repositories/tenants/index.ts` — thêm code generation, update findByIdentifier
- `server/repositories/contracts/index.ts` — cập nhật `buildUniqueContractCode` với format mới
- `app/utils/format/codes.ts` — **new file** chứa toàn bộ code generation logic (shared client/server)

**Client routes:**
- `app/pages/rooms/[id]/` → rename thư mục sang `[code]/`
- `app/pages/tenants/[id]/` → rename thư mục sang `[code]/`
- `app/pages/contracts/[id]/` → rename thư mục sang `[code]/`
- `app/utils/routes/operational.ts` — cập nhật `tenantPath`, `roomPath`, `contractPath`

**Backward compatibility:**
- UUID-based URLs (`/rooms/uuid`) nên redirect sang code-based URL — handled ở server middleware hoặc page-level redirect
- Contract codes cũ (`hd-2026-0001`) không tồn tại sau migration — one-time hard cutover
