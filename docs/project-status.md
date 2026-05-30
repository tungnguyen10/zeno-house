# Zeno House — Trạng thái dự án (31/05/2026)

Hệ thống quản lý bất động sản cho chủ nhà trọ/tòa nhà.

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4 (`future.compatibilityVersion: 4`), Vue 3, TypeScript strict |
| Styling | TailwindCSS + `clsx` |
| State | Pinia (global) + composables (domain/server state) |
| Auth + DB | Supabase (`@nuxtjs/supabase`) |
| Validation | Zod v4 |
| Icons | SVG via `nuxt-svgo` (auto-import prefix `Icon`) |
| Font | Inter variable — self-hosted `/public/fonts/` |
| Email | Resend API |
| Bot protection | Cloudflare Turnstile |

---

## Database (20 migrations)

| File | Nội dung |
|------|----------|
| `20260514000000` | `buildings` table |
| `20260514000001` | Fix buildings RLS |
| `20260514000002` | `rooms` table |
| `20260514000003` | Drop `buildings.total_rooms` column |
| `20260514000004` | `tenants` table |
| `20260514000005` | `room_assignments` table (deprecated) |
| `20260515000000` | `contracts` table |
| `20260517000000` | Building operational config (area, floors, type) |
| `20260517000001` | Contract commercial terms (price, deposit, payment day) |
| `20260517000002` | Occupants + meter_devices (meter_devices sau bị drop) |
| `20260517000003` | `contract_payments` table |
| `20260517000004` | Contract renewal columns |
| `20260517000005` | `contract_renewals` table |
| `20260517000006` | Occupant uniqueness constraint |
| `20260530000000` | DROP `room_assignments` (thay bằng contracts) |
| `20260530100000` | Tenant enrichment: +gender, occupation, id_issued_*, emergency_contact_* |
| `20260530200000–05` | `service_catalog` (8 items), `building_services`, `contract_services`, seed, migrate, drop old JSONB column |
| `20260530300000` | `meter_readings` table |
| `20260530400000` | Simplify meter model: DROP `meter_devices`, đổi UNIQUE key sang `(room_id, meter_type, period_year, period_month, reading_type)` |

---

## Domain Entities

### Buildings
- CRUD: list (`/buildings`), create, edit, detail
- Detail page: thông tin tòa nhà, danh sách phòng, link tới settings & meter-readings
- **Settings** (`/buildings/[id]/settings`): cấu hình 8 dịch vụ mặc định (toggle + amount + pricing_type), bảng matrix cross-tab cho active contracts, nút đồng bộ dịch vụ vào hợp đồng
- **Meter Readings** (`/buildings/[id]/meter-readings`): chọn kỳ (tháng/năm), nhập hàng loạt điện/nước cho từng phòng, hiện consumption so với kỳ trước, bulk upsert

### Rooms
- CRUD: list, create, edit, detail
- Status: `available` / `occupied` / `maintenance`
- Detail page: thông tin phòng, hợp đồng đang active (tenant, link), lịch sử hợp đồng
- Nút "Giao phòng" (admin, khi available) → navigate `/contracts/create?room_id=...`
- Nút "Thu phòng" (admin, khi có active contract) → terminate contract → room về `available`
- **Side-effects tự động**: tạo contract → room `occupied`; terminate/expire → room `available` (bỏ qua nếu đang `maintenance`)

### Tenants
- CRUD: list, create, edit, detail
- **Enriched profile**: gender, nghề nghiệp, ngày cấp / nơi cấp CCCD, liên hệ khẩn cấp (tên + phone)
- Detail page: thông tin cá nhân đầy đủ, hợp đồng active, lịch sử hợp đồng

### Contracts *(entity trung tâm)*
- CRUD: list, create wizard, edit, detail
- **Commercial terms**: giá thuê, tiền cọc, ngày thanh toán, chu kỳ hợp đồng
- **Occupants/Roommates**: thêm người ở cùng, ghi nhận ngày dọn ra, xóa
- **Payments**: add/edit/delete (deposit, prepaid_rent, rent, other), hiện tổng tiền đã thanh toán
- **Renewals**: gia hạn tại chỗ (extend) hoặc tạo hợp đồng mới (new_contract) → auto navigate sang contract mới
- **Contract Services**: kế thừa từ building services khi tạo (clone), chỉnh sửa per-contract (amount, quantity, is_enabled, notes)
- **Handover Readings**: 2 rows cố định (điện / nước) cho handover_in (khi tạo) và handover_out (chỉ khi terminated/expired)
- Status: `active` / `expired` / `terminated`

### Meter Readings
- Model đơn giản: `(room_id, meter_type, period_year, period_month, reading_type)`
- `reading_type`: `monthly` | `handover_in` | `handover_out`
- API: `GET/POST /api/meter-readings`, `GET/POST /api/meter-readings/bulk`, `PATCH /api/meter-readings/[id]`

### Service Catalog & Services
- **8 catalog items** cố định: điện, nước, internet, rác, xe máy/ô tô, vệ sinh, thang máy, bảo vệ
- **building_services**: override giá/trạng thái/pricing_type per building
- **contract_services**: clone từ building khi tạo contract, chỉnh sửa per contract (amount, quantity, is_enabled, notes)
- `pricing_type`: `fixed` | `per_person` | `per_unit`
- Đồng bộ: nút sync thêm dịch vụ còn thiếu vào hợp đồng active của building

### Dashboard
- Summary cards: số tòa nhà, phòng available/occupied/maintenance, hợp đồng active, tổng tenant

---

## Server Layer (API → Service → Repository)

**12 domain groups** trong `server/`:

| Group | Endpoints chính |
|-------|-----------------|
| `buildings` | GET list, POST, GET detail, PATCH, DELETE |
| `rooms` | GET list, POST, GET detail, PATCH, DELETE |
| `tenants` | GET list, POST, GET detail, PATCH, DELETE |
| `contracts` | GET list, POST, GET detail, PATCH, DELETE |
| `service-catalog` | GET list |
| `building-services` | GET list, POST upsert, PATCH |
| `contract-services` | GET list, PATCH |
| `meter-readings` | GET, POST, PATCH, GET bulk, POST bulk |
| `dashboard` | GET summary |
| `contract-occupants` | GET, POST, PATCH (move-out), DELETE |
| `contract-payments` | GET, POST, PATCH, DELETE |
| `contract-renewals` | GET, POST |

Mỗi group: **repository** (Supabase query only) → **service** (business logic + permission check) → **API handler** (Zod validate + auth guard + response envelope)

**Response envelope:**
```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError   = { error: { code: string; message: string; details?: unknown } }
```

---

## Client Layer

### Composables (23 files)

| Domain | Files |
|--------|-------|
| buildings | `useBuildingList`, `useBuildingDetail`, `useBuildingForm`, `useBuildingServices`, `useBuildingMeterReadings`, `useBuildingContractServices` |
| rooms | `useRoomList`, `useRoomDetail`, `useRoomForm`, `useMeterReadings` |
| tenants | `useTenantList`, `useTenantDetail`, `useTenantForm` |
| contracts | `useContractList`, `useContractDetail`, `useContractForm`, `useContractOccupants`, `useContractPayments`, `useContractRenewals`, `useContractServices`, `useContractHandoverReadings` |
| misc | `useDashboardSummary` |

### Components

**UI Primitives** (`app/components/ui/`):
- `UiButton`, `UiInput`, `UiModal`, `UiConfirmModal`, `UiSkeleton`, `UiStatusBadge`, `UiEmptyState`

**App Shell** (`app/components/app/`):
- `AppSidebar`, `AppHeader`, `AppStatCard`

**Domain Components:**
| Domain | Components |
|--------|------------|
| buildings | `BuildingCard`, `BuildingForm`, `BuildingServiceSettings`, `BuildingServicesMatrix`, `MeterReadingBulkInput` |
| rooms | `RoomCard`, `RoomForm`, `RoomMeterReadings` |
| tenants | `TenantForm` |
| contracts | `ContractForm`, `ContractOccupantForm`, `ContractPaymentForm`, `ContractRenewalForm`, `ContractServicesTab`, `ContractHandoverReadings` |

### Pages

| Route | Page |
|-------|------|
| `/` | Dashboard (summary cards) |
| `/login` | Auth page |
| `/buildings` | List |
| `/buildings/create` | Create form |
| `/buildings/[id]` | Detail (rooms, links to settings/meter-readings) |
| `/buildings/[id]/edit` | Edit form |
| `/buildings/[id]/settings` | Service settings + matrix |
| `/buildings/[id]/meter-readings` | Bulk meter reading input |
| `/rooms` | List |
| `/rooms/create` | Create form |
| `/rooms/[id]` | Detail (active contract, history) |
| `/rooms/[id]/edit` | Edit form |
| `/tenants` | List |
| `/tenants/create` | Create form |
| `/tenants/[id]` | Detail (full profile, contracts) |
| `/tenants/[id]/edit` | Edit form |
| `/contracts` | List |
| `/contracts/create` | Create wizard (pre-fill từ `?room_id=`) |
| `/contracts/[id]` | Detail (tất cả sections) |
| `/contracts/[id]/edit` | Edit form |

### Validators (Zod schemas, dùng chung client + server)
`buildings`, `rooms`, `tenants`, `contracts`, `contract-occupants`, `contract-payments`, `contract-renewals`, `contract-services`, `building-services`, `meter-readings`

### Mappers (DB row → DTO)
`buildings`, `rooms`, `tenants`, `contracts`, `contract-occupants`, `contract-payments`, `contract-renewals`, `contract-services`, `building-services`, `service-catalog`, `meter-readings`

---

## Auth & Permissions

- Supabase Auth (email/password)
- Roles: `admin` (full access), `manager` (building được phân công)
- Route guard: `auth.global.ts` middleware
- Capabilities check trong `server/utils/permissions.ts`
- `useAuthStore` (Pinia): session, user, role, `isAdmin`

---

## Data Flow

```
page
 └─▶ composable ($fetch / useFetch)
       └─▶ server/api/   (Zod validate, auth guard)
             └─▶ server/services/   (business logic, permission check)
                   └─▶ server/repositories/   (Supabase query)
```

Client **không** gọi Supabase trực tiếp cho business data.

---

## Những gì chưa có (out of scope v0.1–v0.2.5)

- Invoice / billing module
- Tenant portal (role `tenant`)
- Notification / email flow (Resend API đã setup, chưa dùng)
- Google Analytics (key đã có trong env, chưa integrate UI)
- CI pipeline (spec có, chưa implement)
