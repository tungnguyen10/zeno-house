## Context

v0.2.5 đã hoàn tất: `contracts.building_id NOT NULL`, `contracts.payment_day`, meter readings theo room/type/period, contract services, occupant count, building utility rates. Pre-phase3-cleanup đã done toàn bộ.

Billing workspace là Layer 3 trong product architecture (Operational Workspaces). Toàn bộ tính tiền hàng tháng xử lý tại đây, không phải tại room detail.

## Goals / Non-Goals

**Goals:**
- Monthly Billing Workspace hoạt động theo building + period.
- Bulk meter reading input với override consumption.
- Preview tiền từng phòng trước khi generate (manual trigger).
- Generate immutable billing snapshot cho cả tòa — tách 3 snapshot tables (contract/service/utility).
- Extracted pricing engine — pure function, unit testable, shared giữa preview và generate.
- Bulk mark paid/unpaid sau khi tạo billing.
- Lock/finalize period để chốt dữ liệu tính tiền.
- Room detail chỉ xem billing history read-only.

**Non-Goals:**
- Invoice PDF / email / public invoice page (defer v0.4).
- Tenant portal.
- Partial payment / debt carry-over.
- Accounting ledger / refund nâng cao.
- Physical meter device lifecycle.
- Tự động prorate khi tenant vào/ra giữa kỳ.
- Tiered utility pricing engine.
- Assigned-building scoping cho manager (nếu chưa có bảng assignment).

## Decisions

### 1. `billing_runs` giữ như một bảng riêng, không gộp vào `billing_periods`

**Decision**: Giữ 3 bảng riêng: `billing_periods` → `billing_runs` → `billing_items`.

**Rationale**: `billing_periods` là trạng thái của kỳ (draft/finalized). `billing_runs` là một lần generate snapshot — v0.3 giới hạn 1 run/period, nhưng tách bảng cho phép thêm audit trail per-regeneration ở v0.4 mà không cần đổi schema. Cost là thêm một FK join, acceptable vì query đơn giản.

**Alternative considered**: Gộp run metadata vào `billing_periods`. Rejected vì mất khả năng mở rộng audit trail regeneration.

---

### 2. `reading_value` giữ nguyên, sync từ `new_reading`

**Decision**: Giữ `reading_value` (legacy) và thêm `old_reading`, `new_reading`, `consumption`, `is_adjusted`, `adjustment_reason`, `updated_by`. Billing service write phải sync `reading_value = new_reading`.

**Rationale**: `/buildings/[id]/meter-readings` hiện tại vẫn dùng `reading_value`. Không phá vỡ existing UI. Billing path mới dùng `new_reading/consumption`. Hai write path coexist.

**Alternative considered**: Migrate hoàn toàn sang `new_reading` và bỏ `reading_value`. Rejected vì cần sửa quá nhiều code hiện tại, không aligned với "chỉ làm đủ cho feature cần".

---

### 3. Route: `/buildings/[id]/billing` (không phải `/billing/[buildingId]`)

**Decision**: Billing workspace đặt tại `/buildings/[id]/billing?month=&year=`. Entry page giữ ở `/billing`.

**Rationale**: Billing của một building thuộc về building context — breadcrumb `Buildings > [Name] > Billing` tự nhiên hơn. Entry page `/billing` là điểm chọn building+month, sau đó redirect vào building scope.

**Alternative considered**: `/billing/[buildingId]` làm top-level namespace. Rejected vì billing v0.3 vẫn là một tính năng của building management, chưa đủ tầm standalone.

---

### 4. Active contracts trong kỳ: date overlap + status

**Decision**: Contract được tính vào billing kỳ `(year, month)` khi:
```
start_date <= last_day_of_period
AND end_date >= first_day_of_period
AND status = 'active'
```

**Rationale**: Date overlap catch cả tenant vào giữa kỳ và out giữa kỳ. Status `active` filter loại bỏ terminated/expired contracts.

**Proration rule v0.3**: Không prorate. Contract được tính full-month rent bất kể vào/ra ngày nào trong tháng. Đây là business decision chủ nhà quyết định; v0.3 không implement prorate engine. ADR-006 note rõ điều này.

---

### 5. Regenerate rule: block nếu có `paid` item

**Decision**: Chỉ cho regenerate khi `billing_items.payment_status = 'paid'` count = 0 cho run đó. Admin phải mark unpaid trước khi regenerate.

**Rationale**: Tránh tình huống admin regenerate và overwrite bill mà khách đã thanh toán. Simple và safe cho v0.3.

**Alternative considered**: Cho regenerate tự do, mark paid items là "locked". Rejected vì phức tạp hơn và chưa cần.

---

### 6. Snapshot layer: 3 separate tables, bỏ `snapshot_json` JSONB

**Decision**: Tách snapshot thành 3 tables riêng: `billing_contract_snapshots` (1:1 per item), `billing_service_snapshots` (1:many), `billing_utility_snapshots` (1:many). Bỏ hoàn toàn `snapshot_json` column trên `billing_items`. Thêm `schema_version` vào `billing_runs`.

**Rationale**: 
- Analytics v0.4+ cần "tổng tiền điện toàn tòa tháng X" → standard SQL aggregation trên utility_snapshots, không cần jsonb_array_elements.
- Tách `electricity_amount` + `water_amount` trên `billing_items` (thay vì gộp `utility_amount`) cho phép GROUP BY trực tiếp.
- Tránh data drift giữa JSON blob và actual amounts.
- `catalog_id` FK trên service_snapshots giúp report per-service revenue.
- Cost: +3 tables, 4 writes/contract thay vì 1. Acceptable cho scale v0.3 (≤50 rooms).

**Alternative considered**: Giữ `snapshot_json` JSONB embedded. Rejected vì không thể aggregate hiệu quả cho analytics, và drift risk.

---

### 7. `billing_items` tách `electricity_amount` + `water_amount`

**Decision**: `billing_items` có 5 amount columns: `rent_amount`, `service_amount`, `electricity_amount`, `water_amount`, `utility_amount` (= electricity + water, denormalized), `total_amount`.

**Rationale**: Cho phép `SUM(electricity_amount)` trực tiếp per building/period mà không cần JOIN snapshot tables. `utility_amount` giữ lại như convenience column cho hiển thị.

---

### 8. Pricing engine — extracted pure function

**Decision**: Tách logic tính tiền ra `server/services/pricing/index.ts` — pure function nhận data, trả result + warnings. Không access DB.

**Rationale**: 
- Preview và generate dùng cùng logic → DRY.
- Unit testable mà không cần mock DB.
- Future tiered pricing / proration thêm vào 1 chỗ.
- Input: contract + services + readings + building rates.
- Output: amounts + 3 snapshot structs + warnings.

---

### 9. Billing workspace — hybrid tabs, content adapts per state

**Decision**: 3 tabs luôn visible. Content tự adapt:
- No readings → Tab 2+3 empty state
- Readings done, no run → Tab 2 preview available, Tab 3 empty
- Run exists → Tab 1 editable (yellow banner "cần regen"), Tab 3 active
- Finalized → Tab 1 read-only, Tab 3 payment still editable

**Rationale**: Non-restrictive UX — admin nhảy qua lại tự do. State transitions communicated via banner/empty states thay vì locking tabs.

---

### 10. Preview trigger — manual, not auto

**Decision**: Tab 2 có button "Tính tiền preview", không auto-compute khi switch tab.

**Rationale**: Tránh auto-compute nặng mỗi lần switch (50+ rooms). Admin chủ động trigger khi sẵn sàng.

---

### 11. Item detail — lazy load per expand

**Decision**: `GET /api/billing-items` trả summary (amounts + payment status). Chi tiết snapshot chỉ load khi expand row: `GET /api/billing-items/[id]/detail` → contractSnapshot + serviceSnapshots[] + utilitySnapshots[].

**Rationale**: List view nhẹ cho 50 items. Detail load on-demand, tránh over-fetch.

---

### 12. `old_reading` auto-populate từ latest reading

**Decision**: Khi load workspace, `old_reading` = latest `reading_value` cho room+meter_type bất kể period. Nếu không tìm thấy → để trống, admin nhập thủ công.

**Rationale**: Không phải lúc nào cũng có reading tháng trước (mới vào, thiếu data). Lấy latest available là pragmatic nhất.

---

### 13. Negative consumption — block toàn bộ run

**Decision**: Nếu bất kỳ room nào có `consumption < 0` (chưa adjusted), `generateSnapshot` throw error, block toàn bộ run. Preview vẫn show warning nhưng không block.

**Rationale**: Nếu cho partial generate → admin mark paid → fix reading → regen bị block (có paid items). Force fix hết trước generate an toàn hơn.

---

### 14. Regenerate UX — modal explain, not auto-action

**Decision**: Khi admin click Generate mà đã có run với paid items → hiển thị modal: "X phòng đã thanh toán. Đánh dấu chưa thanh toán trước khi tạo lại." Không tự động mark unpaid.

**Rationale**: An toàn — admin phải chủ động quyết định mark unpaid. Tránh overwrite payment records do nhấn nhầm.

---

### 15. Billing overview page — list thay vì form

**Decision**: `/billing` đổi từ form chọn building+month thành **danh sách billing periods** (cross-building). Hiển thị: Tòa nhà, Kỳ, Trạng thái, Số phòng, Đã thu, Tổng tiền. Click row → navigate tới workspace.

**Rationale**: Admin cần overview nhanh "tháng này building nào đã tính, building nào chưa, bao nhiêu đã thu". Form cũ chỉ mở mới, không cho xem lại — missing basic CRUD list pattern.

**Backend**: Endpoint `GET /api/billing-periods/summary` JOIN buildings + aggregate billing_items per run.

---

### 16. Consolidated billing table — merge 3 tabs thành 1 bảng

**Decision**: Bỏ 3 tabs (Readings / Preview / Billing). Thay bằng **1 bảng gộp** với columns: TT | Phòng | Họ tên | Đ.cũ | Đ.mới | N.cũ | N.mới | Tiền Đ | Tiền N | Phòng/DV | Tổng | Đóng tiền | Thao tác.

**Pricing inline**: Khi user nhập "Đ.mới" → `Tiền Đ = (mới - cũ) × đơn_giá` tính ngay client-side (không cần server call). Đơn giá đã có sẵn từ workspace API (`building.electricity_rate`, `building.water_rate`).

**Rationale**: Chủ trọ thực tế nhập chỉ số và muốn thấy tiền ngay trên cùng dòng. Tách 3 tabs bắt switch qua lại — friction. 1 bảng gộp match mental model: "nhập xong → thấy tiền → đánh dấu thu → xong".

**Alternative considered (Decision 9 cũ)**: 3 tabs hybrid. Rejected sau user feedback: không natural cho workflow nhà trọ thực tế.

---

### 17. Điều chỉnh đầu kỳ — collapsible section

**Decision**: Bên dưới bảng gộp, thêm section collapsible "Điều chỉnh chỉ số đầu kỳ". Columns: Phòng | Người thuê | ĐT | Ngày vào | Số Đ đầu kỳ (editable) | Số N đầu kỳ (editable) | Lý do.

**Rationale**: Case thay đồng hồ hoặc nhập sai tháng trước cần sửa `old_reading`. Tách riêng khỏi bảng chính để không gây nhầm lẫn — chỉ mở khi cần.

**Backend**: Dùng existing meter readings update endpoint, set `is_adjusted = true` + `adjustment_reason`.

---

### 18. Navigation — building-centric expandable sidebar

**Decision**: Sidebar đổi từ flat list → building list expandable:
```
Dashboard
Tòa nhà ▾
  ├─ Toà 1
  ├─ Tòa 2
Khách thuê
Hợp đồng
Vận hành (billing list overview)
```
Khi chọn building → content area hiện sub-tabs: **Phòng | Tính tiền | Cài đặt**.

**Rationale**: Chủ trọ nghĩ theo building → phòng → thu tiền. Nav phẳng 6 items khiến phải pick building nhiều lần. Building-centric hierarchy match mental model.

**Keep `/rooms` globally?** Có — giữ cho global search across buildings. Nhưng bỏ khỏi main nav.

---

### 7. Meter consumption = `new_reading - old_reading` khi `is_adjusted = false`

**Decision**: 
- `is_adjusted = false`: `consumption = new_reading - old_reading`. Negative → warning, block generate.
- `is_adjusted = true`: `consumption` là giá trị nhập thủ công. `adjustment_reason` bắt buộc.

**Rationale**: Negative consumption không phải lỗi code mà là bất thường dữ liệu (meter hư, thay đồng hồ). Override flow cho phép admin nhập consumption đúng và ghi lại lý do. Billing service enforce rule này.

---

## Data Model

### billing_periods

```sql
CREATE TABLE billing_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id),
  period_year smallint NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  period_month smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  finalized_at timestamptz,
  finalized_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, period_year, period_month)
);
```

### billing_runs

```sql
CREATE TABLE billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period_id uuid NOT NULL REFERENCES billing_periods(id),
  building_id uuid NOT NULL REFERENCES buildings(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated')),
  schema_version smallint NOT NULL DEFAULT 1,
  generated_at timestamptz,
  generated_by uuid REFERENCES auth.users(id),
  item_count int NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### billing_items

```sql
CREATE TABLE billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_run_id uuid NOT NULL REFERENCES billing_runs(id),
  room_id uuid NOT NULL REFERENCES rooms(id),
  contract_id uuid NOT NULL REFERENCES contracts(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),

  rent_amount numeric(15,2) NOT NULL DEFAULT 0,
  service_amount numeric(15,2) NOT NULL DEFAULT 0,
  electricity_amount numeric(15,2) NOT NULL DEFAULT 0,
  water_amount numeric(15,2) NOT NULL DEFAULT 0,
  utility_amount numeric(15,2) NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,

  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id),
  payment_method text CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
  payment_note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### billing_contract_snapshots (1:1 with billing_items)

```sql
CREATE TABLE billing_contract_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_item_id uuid NOT NULL UNIQUE REFERENCES billing_items(id) ON DELETE CASCADE,
  monthly_rent numeric(15,2) NOT NULL,
  surcharge_amount numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_day smallint,
  occupant_count smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### billing_service_snapshots (1:many with billing_items)

```sql
CREATE TABLE billing_service_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_item_id uuid NOT NULL REFERENCES billing_items(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES service_catalog(id),
  service_name text NOT NULL,
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed', 'per_person')),
  amount numeric(15,2) NOT NULL,
  quantity smallint NOT NULL DEFAULT 1,
  total numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### billing_utility_snapshots (1:many with billing_items)

```sql
CREATE TABLE billing_utility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_item_id uuid NOT NULL REFERENCES billing_items(id) ON DELETE CASCADE,
  meter_type text NOT NULL CHECK (meter_type IN ('electricity', 'water')),
  old_reading numeric,
  new_reading numeric,
  consumption numeric,
  unit_price numeric(15,2),
  total numeric(15,2) NOT NULL DEFAULT 0,
  is_adjusted boolean NOT NULL DEFAULT false,
  adjustment_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### meter_readings — thêm field

```sql
ALTER TABLE meter_readings
  ADD COLUMN old_reading numeric,
  ADD COLUMN new_reading numeric,
  ADD COLUMN consumption numeric,
  ADD COLUMN is_adjusted boolean NOT NULL DEFAULT false,
  ADD COLUMN adjustment_reason text,
  ADD COLUMN updated_by uuid REFERENCES auth.users(id);
```

`reading_value` giữ nguyên và được sync bằng `new_reading` khi billing write.

## Pricing Engine — Pure Function

```typescript
// server/services/pricing/types.ts

interface RoomBillingInput {
  contract: {
    id: string
    roomId: string
    tenantId: string
    monthlyRent: number
    surchargeAmount: number
    discountAmount: number
    paymentDay: number | null
    occupantCount: number
  }
  services: {
    catalogId: string
    name: string
    pricingType: 'fixed' | 'per_person'
    amount: number
    quantity: number
  }[]
  meterReadings: {
    meterType: 'electricity' | 'water'
    oldReading: number | null
    newReading: number | null
    consumption: number | null
    isAdjusted: boolean
    adjustmentReason: string | null
  }[]
  buildingRates: {
    electricityRate: number | null
    waterRate: number | null
    waterPricingType: 'per_unit' | 'per_person'
  }
}

interface RoomBillingResult {
  amounts: {
    rentAmount: number
    serviceAmount: number
    electricityAmount: number
    waterAmount: number
    utilityAmount: number
    totalAmount: number
  }
  contractSnapshot: {
    monthlyRent: number
    surchargeAmount: number
    discountAmount: number
    paymentDay: number | null
    occupantCount: number
  }
  serviceSnapshots: {
    catalogId: string
    serviceName: string
    pricingType: 'fixed' | 'per_person'
    amount: number
    quantity: number
    total: number
  }[]
  utilitySnapshots: {
    meterType: 'electricity' | 'water'
    oldReading: number | null
    newReading: number | null
    consumption: number | null
    unitPrice: number | null
    total: number
    isAdjusted: boolean
    adjustmentReason: string | null
  }[]
  warnings: BillingWarning[]
}

type BillingWarning =
  | { type: 'missing_reading'; meterType: string }
  | { type: 'negative_consumption'; meterType: string; value: number }
  | { type: 'no_rate_configured'; meterType: string }
  | { type: 'zero_rent' }
```

### Blocking rules

- `negative_consumption` → block generate (throw), preview shows warning only
- `missing_reading` → warning only, amount = 0
- `no_rate_configured` → warning only, amount = 0
- `zero_rent` → warning only, generate OK

## Billing Calculation Logic

```
Rent = contract.monthly_rent + contract.surcharge_amount - contract.discount_amount

Services (per contract_services where is_enabled = true):
  - pricing_type = 'fixed': total = amount × quantity
  - pricing_type = 'per_person': total = amount × billing_counted_occupants

Electricity:
  - consumption = meter_readings.consumption (confirmed value)
  - unit_price = building.default_electricity_rate
  - total = consumption × unit_price

Water:
  - consumption = meter_readings.consumption (confirmed value)
  - unit_price = building.default_water_rate
  - total = consumption × unit_price
  (hoặc nếu water là per-person: total = billing_counted_occupants × unit_price)

Grand total = rent + sum(services) + electricity + water
```

## API Design

### Billing Periods
```
GET    /api/billing-periods?building_id=&period_year=&period_month=
POST   /api/billing-periods
PATCH  /api/billing-periods/[id]     ← finalize / unlock
```

### Billing Workspace (load everything needed)
```
GET    /api/billing-runs/workspace?billing_period_id=
       → { period, run?, activeContracts, meterReadings, warnings }

POST   /api/billing-runs/preview?billing_period_id=
       → { items: RoomBillingResult[], warnings[] }

POST   /api/billing-runs/generate    ← body: { billing_period_id }
       → { run, items[] }
```

### Billing Items
```
GET    /api/billing-items?billing_run_id=&payment_status=&q=
       → items[] (summary: amounts + payment status, NO snapshot detail)

GET    /api/billing-items/[id]/detail
       → { item, contractSnapshot, serviceSnapshots[], utilitySnapshots[] }

POST   /api/billing-items/bulk-payment-status
       body: { billing_item_ids[], payment_status, payment_method?, payment_note? }
```

## UI Layout — Billing Workspace

```
/buildings/[id]/billing?month=5&year=2026

┌─────────────────────────────────────────────────────────────┐
│  CONTEXT BAR                                                │
│  Nhà trọ Tân Bình · T5/2026 · [draft] · [Actions ▾]        │
│  Actions: Generate | Finalize | Unlock                      │
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────────┐
│  Tab 1   │  Tab 2   │   Tab 3      │  ← luôn visible (hybrid)
│ Readings │ Preview  │ Billing      │
└──────────┴──────────┴──────────────┘

STATE: no readings yet
┌────────────────────────────────────────────────────────────┐
│ Tab 1: METER READINGS (editable)                           │
│  Room | Tenant | Đ.cũ | Đ.mới | TT(đ) | N.cũ | N.mới | TT(n)│
│  old_reading auto from latest. Override toggle + reason.   │
│ Tab 2: Empty state "Nhập chỉ số trước"                     │
│ Tab 3: Empty state "Chưa có billing"                        │
└────────────────────────────────────────────────────────────┘

STATE: readings done, no run
┌────────────────────────────────────────────────────────────┐
│ Tab 2: BILLING PREVIEW                                     │
│  [Tính tiền preview] ← manual trigger button               │
│  Room | Tenant | Rent | Đ | N | DV | Total | Warnings     │
└────────────────────────────────────────────────────────────┘

STATE: run exists (generated)
┌────────────────────────────────────────────────────────────┐
│ Tab 1: Still editable + yellow banner                       │
│  ⚠️ "Dữ liệu đã thay đổi so với lần generate. Cần tạo lại."│
│ Tab 3: BILLING RESULT                                       │
│  Summary cards: Total rooms | Total receivable | Paid | Unpaid│
│  Filter: All | Paid | Unpaid   Search: room/tenant          │
│  [☐] Room | Tenant | Rent | Đ | N | DV | Total | Status    │
│  Expand row → lazy load detail (contract/service/utility)   │
│  Bulk: [Mark paid] [Mark unpaid]                            │
└────────────────────────────────────────────────────────────┘

STATE: finalized
┌────────────────────────────────────────────────────────────┐
│ Tab 1: Read-only (disabled inputs)                          │
│ Tab 2: Read-only                                            │
│ Tab 3: Payment tracking still editable                      │
└────────────────────────────────────────────────────────────┘

Regenerate UX:
  - No paid items → regenerate directly (delete old run + snapshots, create new)
  - Has paid items → modal: "X phòng đã thanh toán. Đánh dấu chưa thanh toán trước."
  - Admin phải chủ động mark unpaid, không auto-action
```

## Billing Period Status Flow

```
[CREATE]
  ↓
draft
  ↓  ← meter readings editable, preview available, generate/regenerate allowed
[GENERATE SNAPSHOT] → billing_run + billing_items + 3 snapshot tables created
  ↓
draft (still, with items)
  ↓  ← payment tracking starts here
[FINALIZE]
  ↓
finalized ← input locked, payment status still editable
  ↓
[UNLOCK] (admin only)
  ↓
draft ← back to editable
```

## Risks / Trade-offs

- **Double write path cho meter readings**: billing write vs. standalone meter-readings page. Đã chấp nhận với convention `reading_value = new_reading` sync rule.
- **No proration v0.3**: full-month billing có thể không fair với tenant vào/ra giữa kỳ. Được ghi rõ trong ADR-006 là decision có chủ đích.
- **Manager permission**: v0.3 dùng rule đơn giản admin full access, manager access tất cả buildings (chưa có assigned-building scoping nếu repo chưa có bảng assignment).
- **Regenerate với paid items**: admin phải manual mark unpaid trước khi regenerate. UX friction nhưng an toàn.
- **4 writes/contract khi generate**: 140 rows cho 20 phòng (items + 3 snapshot tables). Acceptable trong 1 transaction, scale OK cho v0.3.
- **Lazy detail load**: thêm 1 API call per expand. Tradeoff cho list performance.

## Migration Plan

1. Migration: tạo `billing_periods`, `billing_runs`, `billing_items`, `billing_contract_snapshots`, `billing_service_snapshots`, `billing_utility_snapshots`.
2. Migration: ALTER `meter_readings` thêm 6 field mới.
3. Regenerate `database.types.ts`.
4. Pricing engine pure function.
5. Server domain groups + snapshot repositories.
6. Client workspace (hybrid tabs).
7. Room detail billing history.
