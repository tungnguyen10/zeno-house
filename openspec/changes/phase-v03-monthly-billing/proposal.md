## Why

Zeno House đã có đầy đủ dữ liệu lõi: buildings, rooms, tenants, contracts, meter readings và contract services. Thiếu còn lại là **luồng tính tiền hàng tháng** — hệ thống chưa cho phép admin xử lý billing theo tòa nhà + kỳ tháng, tạo snapshot khoản phải thu và theo dõi paid/unpaid hàng loạt.

Hiện tại `/billing` chỉ là placeholder. Mục tiêu v0.3 là biến nó thành **Monthly Billing Workspace** hoạt động thực sự, theo đúng ADR-002 (billing là workspace-based, không phải room-detail-based).

## What Changes

- Thêm 6 bảng database: `billing_periods`, `billing_runs`, `billing_items`, `billing_contract_snapshots`, `billing_service_snapshots`, `billing_utility_snapshots`.
- Mở rộng `meter_readings` với các field phục vụ billing: `old_reading`, `new_reading`, `consumption`, `is_adjusted`, `adjustment_reason`, `updated_by`.
- Thêm server domain groups: `billing-periods`, `billing-runs`, `billing-items` theo pattern API → service → repository.
- Thêm `server/services/pricing/` — extracted pure function tính tiền, shared giữa preview và generate.
- Thêm 3 snapshot repositories cho contract/service/utility snapshots.
- Thêm billing service chịu trách nhiệm load active contracts, validate period status, tính preview, generate snapshot, finalize/unlock, bulk payment status.
- Đổi `/billing` thành entry page chọn building + month/year, điều hướng tới `/buildings/[id]/billing`.
- Thêm `/buildings/[id]/billing?month=&year=` làm billing workspace (hybrid tabs, content adapts per state).
- Reuse và extend `MeterReadingBulkInput` cho old/new/consumption/override/adjustment reason.
- Thêm preview table (manual trigger), billing items table (lazy detail load), summary cards, filter paid/unpaid, bulk mark paid/unpaid.
- Thêm ADR-006 và ADR-007 vào `docs/architecture/`.
- Room detail chỉ hiển thị billing history dạng read-only.

### Phase 2 — UX Consolidation (bổ sung)

- Đổi `/billing` entry page từ form chọn building → **danh sách billing periods** đã tạo (overview cross-building), có filter building/year, hiện trạng thái + tổng tiền + đã thu.
- Gộp 3 tabs billing workspace thành **1 bảng gộp** — nhập chỉ số + auto tính tiền + đánh dấu thu tiền trên cùng 1 dòng.
- Bỏ tab Preview riêng — pricing tính client-side inline khi nhập xong chỉ số (đơn giá đã có sẵn từ workspace API).
- Thêm section "Điều chỉnh đầu kỳ" (collapsible) cho case thay đồng hồ / sửa chỉ số cũ.
- Navigation sidebar: building list expandable, khi chọn building hiện sub-tabs (Phòng, Tính tiền, Cài đặt).
- Backend: thêm endpoint `GET /api/billing-periods/summary` trả list periods enriched (building name, item count, paid count, total amount).

## Capabilities

### New Capabilities

- `billing-database`: Migration tạo `billing_periods`, `billing_runs`, `billing_items`, `billing_contract_snapshots`, `billing_service_snapshots`, `billing_utility_snapshots`; migration mở rộng `meter_readings`.
- `billing-api`: API groups cho billing periods, billing runs, billing items. Bao gồm workspace load, preview calculation, generate snapshot, finalize, bulk payment status.
- `billing-pricing`: Extracted pricing engine — pure function tính tiền per room, shared giữa preview và generate. Unit testable without DB.
- `billing-client`: Entry page `/billing`, billing workspace `/buildings/[id]/billing`, extended meter input, preview table, billing items table, bulk payment actions, summary cards.

### Modified Capabilities

- `meter-readings-api`: Mở rộng schema và repository để support `old_reading`, `new_reading`, `consumption`, `is_adjusted`, `adjustment_reason`, `updated_by`.
- `product-architecture`: Cập nhật spec thêm ADR-006, ADR-007 và v0.3 roadmap section.
- `rooms-client`: Room detail thêm billing history section (read-only), không có action tạo bill.

## Impact

**Database:**
- Migration: `billing_periods`, `billing_runs`, `billing_items`, `billing_contract_snapshots`, `billing_service_snapshots`, `billing_utility_snapshots`
- Migration: ALTER `meter_readings` thêm 6 field mới
- `billing_items`: thêm `electricity_amount`, `water_amount` columns; bỏ `snapshot_json`
- `billing_runs`: thêm `schema_version`
- Regenerate `database.types.ts`

**Server:**
- Mới: `server/api/billing-periods/`, `server/api/billing-runs/`, `server/api/billing-items/`
- Mới: `server/services/billing-periods/`, `server/services/billing-runs/`, `server/services/billing-items/`
- Mới: `server/services/pricing/` — extracted pure pricing engine
- Mới: `server/repositories/billing-periods/`, `server/repositories/billing-runs/`, `server/repositories/billing-items/`
- Mới: `server/repositories/billing-contract-snapshots/`, `server/repositories/billing-service-snapshots/`, `server/repositories/billing-utility-snapshots/`
- Sửa: `server/repositories/meter-readings/` — upsert phải sync `reading_value = new_reading`
- Sửa: `server/services/meter-readings/` — update logic cho `is_adjusted` validation

**Types:**
- Mới: `app/types/billing.ts`
- Sửa: `app/types/meter-readings.ts` — thêm fields mới

**Validators:**
- Mới: `app/utils/validators/billing.ts`
- Sửa: `app/utils/validators/meter-readings.ts` — thêm `old_reading`, `new_reading`, `is_adjusted`, `adjustment_reason`

**Mappers:**
- Mới: `app/utils/mappers/billing.ts`
- Sửa: `app/utils/mappers/meter-readings.ts`

**Composables:**
- Mới: `app/composables/billing/useBillingPeriod.ts`
- Mới: `app/composables/billing/useBillingWorkspace.ts`
- Mới: `app/composables/billing/useBillingPreview.ts`
- Mới: `app/composables/billing/useBillingItems.ts`
- Mới: `app/composables/billing/useBillingPaymentStatus.ts`

**Components:**
- Mới: `app/components/billing/BillingPeriodSelector.vue`
- Mới: `app/components/billing/BillingMeterReadingsTable.vue`
- Mới: `app/components/billing/BillingPreviewTable.vue`
- Mới: `app/components/billing/BillingSummaryCards.vue`
- Mới: `app/components/billing/BillingItemsTable.vue`
- Mới: `app/components/billing/BillingBulkActions.vue`
- Mới: `app/components/billing/BillingStatusBadge.vue`
- Sửa: `app/components/buildings/MeterReadingBulkInput.vue` — extend hoặc tạo variant mới cho billing mode

**Pages:**
- Sửa: `app/pages/billing/index.vue` — thành entry page chọn building + month/year
- Mới: `app/pages/buildings/[id]/billing.vue` — billing workspace
- Sửa: Room detail — thêm billing history tab/section

**Architecture:**
- Thêm `docs/architecture/adr-006-monthly-billing-workspace.md`
- Thêm `docs/architecture/adr-007-meter-readings-as-billing-inputs.md`
- Sửa: `openspec/specs/product-architecture/spec.md` — thêm ADR-006, ADR-007, v0.3 roadmap

**Navigation:**
- `app/utils/constants/navigation.ts` — đổi label "Vận hành" trỏ tới `/billing` (giữ nguyên route)
