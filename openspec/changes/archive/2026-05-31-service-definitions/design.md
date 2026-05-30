## Context

Bảng `buildings` có column `default_service_fees` (JSONB) để lưu phí dịch vụ mặc định. Cách này không thể query, không có lịch sử giá, và mỗi contract tạo mới phải nhập lại thủ công. Khi billing engine (v0.3) cần tính bill thì không có cấu trúc để:

- Biết contract nào có dịch vụ gì
- Giá bao nhiêu vào thời điểm ký HĐ (snapshot)
- Tính tiền theo số lượng (xe, người)

**State hiện tại:**
- `buildings.default_service_fees` là JSONB blob — admin nhập tự do, không schema
- Contract form có input phí dịch vụ rời rạc, không liên kết với building defaults
- Không có data model cho dịch vụ

**Target state:**
- `service_catalog` — danh mục toàn hệ thống, seeded sẵn
- `building_services` — per-building enable/disable + giá
- `contract_services` — per-contract snapshot, auto-clone khi tạo HĐ
- `buildings.default_service_fees` bị drop sau khi migrate data

## Goals / Non-goals

**Goals:**
- 3 bảng mới với quan hệ rõ ràng
- Auto-clone `building_services` → `contract_services` khi tạo contract
- Building settings UI cho phép admin quản lý dịch vụ per building
- Contract wizard tab "Dịch vụ" để review và nhập quantity
- Snapshot pricing — giá trong `contract_services` không đổi khi building thay đổi

**Non-goals:**
- Tính bill trong change này
- Price history / audit trail
- Room-level service override
- Tenant-facing service list

## Decisions

**D1 — `service_catalog` là global, chỉ admin có thể thêm/sửa qua migration (không có UI)**

Catalog đủ ổn định để seed sẵn. Admin không cần tạo catalog item mới thường xuyên. Nếu cần thêm sau này thì tạo migration mới — tránh over-engineer UI quản lý catalog.

**D2 — `pricing_type` enum: `fixed_per_room` | `per_person` | `per_vehicle`**

Không có `per_kwh` và `per_m3` — điện/nước tính riêng qua meter readings. Chỉ 3 loại này áp dụng cho v0.2.5 scope.

**D3 — `contract_services.amount` là snapshot tại thời điểm tạo HĐ**

Khi admin thay đổi `building_services.default_amount`, contracts cũ không bị ảnh hưởng. Nếu admin muốn update giá cho contract đang active → sửa trực tiếp `contract_services.amount`.

**D4 — Auto-clone trigger ở service layer (ContractService.create), không dùng DB trigger**

Nhất quán với pattern hiện tại (không dùng DB triggers). `ContractService.create()` sau khi INSERT contract → gọi `ContractServiceRepository.cloneFromBuilding(contractId, buildingId)`.

**D5 — `building_services` bật theo catalog; admin nhập `default_amount`**

`is_active` default `false` — admin phải bật từng dịch vụ và nhập giá. Không auto-enable tất cả vì mỗi building có dịch vụ khác nhau.

**D6 — Xoá `default_service_fees` chỉ sau khi data đã migrate**

Tạo migration riêng để drop column. Thứ tự: (1) tạo 3 bảng, (2) migrate data, (3) drop column.

**D7 — Tab "Dịch vụ" trong Building settings, không phải Building detail chính**

Không muốn clutter building detail page. Building settings page (`/buildings/:id/settings`) thêm tab "Dịch vụ".

**D8 — Contract wizard: Tab "Dịch vụ" hiển thị danh sách auto-cloned, admin nhập quantity**

Wizard không thêm step mới cho mỗi service — chỉ có 1 tab "Dịch vụ" với table. `quantity` default = 1, `is_enabled` default theo building setting. Admin có thể toggle on/off và sửa quantity.

## Files bị thêm

```
supabase/migrations/20260530200000_service_catalog.sql
supabase/migrations/20260530200001_building_services.sql
supabase/migrations/20260530200002_contract_services.sql
supabase/migrations/20260530200003_seed_service_catalog.sql
supabase/migrations/20260530200004_migrate_default_fees.sql     ← data migration
supabase/migrations/20260530200005_drop_default_service_fees.sql

server/repositories/service-catalog/index.ts
server/repositories/building-services/index.ts
server/repositories/contract-services/index.ts

server/services/service-catalog/index.ts
server/services/building-services/index.ts
server/services/contract-services/index.ts

server/api/service-catalog/index.get.ts
server/api/building-services/index.get.ts
server/api/building-services/index.post.ts
server/api/building-services/[id].patch.ts
server/api/contract-services/index.get.ts
server/api/contract-services/[id].patch.ts

app/utils/validators/service-catalog.ts
app/utils/validators/building-services.ts
app/utils/validators/contract-services.ts
app/utils/mappers/service-catalog.ts
app/utils/mappers/building-services.ts
app/utils/mappers/contract-services.ts
app/types/service-catalog.ts
app/types/building-services.ts
app/types/contract-services.ts
app/composables/buildings/useBuildingServices.ts
app/composables/contracts/useContractServices.ts
app/components/buildings/BuildingServiceSettings.vue
app/components/contracts/ContractServicesTab.vue
```

## Files bị sửa

```
server/services/contracts/index.ts      ← create() gọi cloneFromBuilding sau INSERT
app/pages/buildings/[id]/settings.vue   ← thêm tab "Dịch vụ"
app/pages/contracts/create.vue          ← thêm tab "Dịch vụ" trong wizard
app/types/database.types.ts             ← thêm 3 bảng mới
```

## Data Model chi tiết

```sql
-- service_catalog
CREATE TABLE public.service_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed_per_room','per_person','per_vehicle')),
  unit        text,                    -- NULL nếu fixed_per_room
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- building_services
CREATE TABLE public.building_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id    uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  catalog_id     uuid NOT NULL REFERENCES service_catalog(id),
  default_amount numeric(12,0) NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(building_id, catalog_id)
);

-- contract_services
CREATE TABLE public.contract_services (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  catalog_id  uuid NOT NULL REFERENCES service_catalog(id),
  amount      numeric(12,0) NOT NULL,   -- snapshot
  quantity    integer NOT NULL DEFAULT 1,
  is_enabled  boolean NOT NULL DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(contract_id, catalog_id)
);
```

## Seeded Catalog

```sql
INSERT INTO service_catalog (code, name, pricing_type, unit, sort_order) VALUES
  ('internet',          'Internet',       'fixed_per_room', NULL,   1),
  ('garbage',           'Rác',            'per_person',     'người',2),
  ('parking_motorbike', 'Gửi xe máy',    'per_vehicle',    'xe',   3),
  ('parking_bicycle',   'Gửi xe đạp',    'per_vehicle',    'xe',   4),
  ('cleaning',          'Vệ sinh',        'fixed_per_room', NULL,   5),
  ('elevator',          'Thang máy',      'per_person',     'người',6),
  ('surcharge',         'Phụ thu',        'fixed_per_room', NULL,   7),
  ('other',             'Khác',           'fixed_per_room', NULL,   8);
```

## Auto-clone flow

```
ContractService.create(input)
  └─ INSERT contracts → contractId
  └─ ContractServiceRepository.cloneFromBuilding(contractId, buildingId)
       └─ SELECT building_services WHERE building_id = buildingId AND is_active = true
       └─ INSERT contract_services (contract_id, catalog_id, amount = default_amount, quantity = 1, is_enabled = true)
```

## Contract wizard tab

Tab "Dịch vụ" xuất hiện sau các fields cơ bản. Hiển thị bảng:

| Dịch vụ | Đơn giá | Số lượng | Bật/Tắt | Ghi chú |
Dữ liệu được auto-populate từ `building_services` active. Admin có thể toggle `is_enabled` và sửa `quantity` trước khi lưu HĐ.

Sau khi submit form → POST `/api/contracts` → server tạo contract + clone services trong 1 transaction (best-effort, không rollback nếu clone fail).
