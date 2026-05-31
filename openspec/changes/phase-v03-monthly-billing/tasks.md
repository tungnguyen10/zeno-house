## 1. Architecture Documents

- [x] 1.1 Tạo `docs/architecture/adr-006-monthly-billing-workspace.md` — ADR-006: Monthly billing is a building-level bulk workspace; no billing from room detail; no proration in v0.3; snapshot layer = 3 tables
- [x] 1.2 Tạo `docs/architecture/adr-007-meter-readings-as-billing-inputs.md` — ADR-007: Meter readings are billing inputs; no physical meter device model in v0.3; override consumption with adjustment reason
- [x] 1.3 Sửa `openspec/specs/product-architecture/spec.md` — thêm ADR-006, ADR-007 và v0.3 roadmap section

## 2. Database Migrations

- [x] 2.1 Tạo migration `20260601000000_create_billing_tables.sql`:
  - `billing_periods` với unique `(building_id, period_year, period_month)`, status check, RLS policies
  - `billing_runs` với FK `billing_period_id`, `schema_version smallint NOT NULL DEFAULT 1`, status check, RLS policies
  - `billing_items` với FK `billing_run_id`, 5 amount columns (`rent_amount`, `service_amount`, `electricity_amount`, `water_amount`, `utility_amount`, `total_amount`), payment_status check, RLS policies — KHÔNG có `snapshot_json`
  - `billing_contract_snapshots` với UNIQUE FK `billing_item_id`, ON DELETE CASCADE
  - `billing_service_snapshots` với FK `billing_item_id`, `catalog_id` FK to `service_catalog`, ON DELETE CASCADE
  - `billing_utility_snapshots` với FK `billing_item_id`, `meter_type` check, ON DELETE CASCADE
  - updated_at triggers cho `billing_periods`, `billing_runs`, `billing_items`
- [x] 2.2 Tạo migration `20260601000001_extend_meter_readings_for_billing.sql`:
  - ALTER TABLE `meter_readings`: ADD COLUMN `old_reading numeric`, `new_reading numeric`, `consumption numeric`, `is_adjusted boolean NOT NULL DEFAULT false`, `adjustment_reason text`, `updated_by uuid REFERENCES auth.users(id)`
- [x] 2.3 Apply cả 2 migrations lên Supabase
- [x] 2.4 Regenerate `app/types/database.types.ts`

## 3. TypeScript Types

- [x] 3.1 Tạo `app/types/billing.ts`:
  - `BillingPeriod`, `BillingRun`, `BillingItem` types từ database rows
  - `BillingPeriodStatus = 'draft' | 'finalized'`
  - `BillingRunStatus = 'draft' | 'generated'`
  - `BillingPaymentStatus = 'unpaid' | 'paid'`
  - `BillingContractSnapshot`, `BillingServiceSnapshot`, `BillingUtilitySnapshot` — types cho 3 snapshot tables
  - `BillingItemDetail` — item + contractSnapshot + serviceSnapshots[] + utilitySnapshots[]
  - `BillingWorkspaceData` — toàn bộ dữ liệu cần load vào workspace
  - `BillingWarning` — union type cho warnings
- [x] 3.2 Sửa `app/types/meter-readings.ts` — thêm `oldReading`, `newReading`, `consumption`, `isAdjusted`, `adjustmentReason`, `updatedBy` vào `MeterReading` type

## 4. Zod Validators

- [x] 4.1 Tạo `app/utils/validators/billing.ts`:
  - `billingPeriodCreateSchema`: `building_id`, `period_year`, `period_month`
  - `billingPeriodUpdateSchema` (partial, chỉ dùng cho finalize/unlock)
  - `billingGenerateSchema`: `billing_period_id`
  - `billingBulkPaymentSchema`: `billing_item_ids[]`, `payment_status`, `payment_method?`, `payment_note?`
- [x] 4.2 Sửa `app/utils/validators/meter-readings.ts` — thêm `old_reading?`, `new_reading?`, `consumption?`, `is_adjusted?`, `adjustment_reason?` vào create/update schemas; refinement: nếu `is_adjusted = true` thì `adjustment_reason` required

## 5. Mappers

- [x] 5.1 Tạo `app/utils/mappers/billing.ts` — `mapBillingPeriod`, `mapBillingRun`, `mapBillingItem`, `mapBillingContractSnapshot`, `mapBillingServiceSnapshot`, `mapBillingUtilitySnapshot` functions
- [x] 5.2 Sửa `app/utils/mappers/meter-readings.ts` — map thêm `oldReading`, `newReading`, `consumption`, `isAdjusted`, `adjustmentReason`, `updatedBy`

## 6. Server Repositories

- [x] 6.1 Tạo `server/repositories/billing-periods/index.ts` — `findByBuilding`, `findByPeriod`, `create`, `update` (finalize/unlock)
- [x] 6.2 Tạo `server/repositories/billing-runs/index.ts` — `findByPeriod`, `create`, `update`, `deleteWithCascade` (for regenerate)
- [x] 6.3 Tạo `server/repositories/billing-items/index.ts` — `findByRun`, `findById`, `bulkCreate`, `bulkUpdatePaymentStatus`, `countPaidByRunId`
- [x] 6.4 Tạo `server/repositories/billing-contract-snapshots/index.ts` — `bulkCreate`, `findByItemId`
- [x] 6.5 Tạo `server/repositories/billing-service-snapshots/index.ts` — `bulkCreate`, `findByItemId`
- [x] 6.6 Tạo `server/repositories/billing-utility-snapshots/index.ts` — `bulkCreate`, `findByItemId`
- [x] 6.7 Sửa `server/repositories/meter-readings/index.ts` — `bulkUpsert` phải set `reading_value = new_reading` khi `new_reading` được cung cấp; `findBuildingRoomsStatus` return `old_reading`, `new_reading`, `consumption`, `is_adjusted`, `adjustment_reason`

## 7. Server Services

- [x] 7.1 Tạo `server/services/pricing/index.ts` — extracted pure pricing engine:
  - `calculateRoomBilling(input: RoomBillingInput): RoomBillingResult`
  - Pure function, no DB access
  - Input: contract data + services[] + meterReadings[] + buildingRates
  - Output: amounts + contractSnapshot + serviceSnapshots[] + utilitySnapshots[] + warnings[]
  - Rules: negative consumption → warning `negative_consumption`; missing reading → warning, amount=0; missing rate → warning, amount=0
- [x] 7.2 Tạo `server/services/pricing/types.ts` — `RoomBillingInput`, `RoomBillingResult`, `BillingWarning` types
- [x] 7.3 Tạo `server/services/billing-periods/index.ts`:
  - `getOrCreatePeriod(buildingId, year, month)` — upsert billing period
  - `finalizePeriod(id)` — set status = finalized, record finalized_at/by
  - `unlockPeriod(id)` — set status = draft (admin only)
- [x] 7.4 Tạo `server/services/billing-runs/index.ts`:
  - `loadWorkspace(periodId)` — load active contracts trong kỳ, meter readings (old_reading auto from latest), warnings
  - `previewBilling(periodId)` — gọi pricing engine per contract, return results (no save)
  - `generateSnapshot(periodId, userId)`:
    - Validate: period = draft
    - Check: nếu existing run có paid items → throw CONFLICT
    - Check: nếu any room negative consumption → throw VALIDATION_ERROR
    - Nếu existing run không có paid items → delete old run (CASCADE deletes snapshots)
    - Transaction: tạo `billing_run` + per contract: `billing_items` + `billing_contract_snapshots` + `billing_service_snapshots[]` + `billing_utility_snapshots[]`
  - **Active contracts query**: `building_id` match + `status = 'active'` + `start_date <= last_day` + `end_date >= first_day`
- [x] 7.5 Tạo `server/services/billing-items/index.ts`:
  - `listItems(runId, filters)` — filter by payment_status, search room/tenant
  - `getItemDetail(itemId)` — load item + JOIN 3 snapshot tables
  - `bulkUpdatePaymentStatus(ids[], status, metadata)`:
    - paid: set `paid_at = now()`, `paid_by = userId`, `payment_method`, `payment_note`
    - unpaid: clear `paid_at`, `paid_by`, `payment_method`, `payment_note`
- [x] 7.6 Sửa `server/services/meter-readings/index.ts` — validate `adjustment_reason` required khi `is_adjusted = true`

## 8. Server API Endpoints

- [x] 8.1 Tạo `server/api/billing-periods/index.get.ts` — list periods by `building_id`
- [x] 8.2 Tạo `server/api/billing-periods/index.post.ts` — create/getOrCreate period
- [x] 8.3 Tạo `server/api/billing-periods/[id].patch.ts` — finalize/unlock
- [x] 8.4 Tạo `server/api/billing-runs/workspace.get.ts` — load workspace data (`?billing_period_id=`)
- [x] 8.5 Tạo `server/api/billing-runs/preview.post.ts` — compute preview (no save), gọi pricing engine
- [x] 8.6 Tạo `server/api/billing-runs/generate.post.ts` — generate snapshot, gọi pricing engine + persist
- [x] 8.7 Tạo `server/api/billing-items/index.get.ts` — list items summary (`?billing_run_id=&payment_status=&q=`), NO snapshot detail
- [x] 8.8 Tạo `server/api/billing-items/[id]/detail.get.ts` — item + contractSnapshot + serviceSnapshots[] + utilitySnapshots[] (lazy load per expand)
- [x] 8.9 Tạo `server/api/billing-items/bulk-payment-status.post.ts` — bulk update payment status

## 9. Client Composables

- [x] 9.1 Tạo `app/composables/billing/useBillingPeriod.ts` — getOrCreate period, finalize, unlock; expose `period`, `isLoading`, `isSaving`
- [x] 9.2 Tạo `app/composables/billing/useBillingWorkspace.ts` — load workspace data (active contracts, meter readings with old_reading auto from latest, warnings); expose `workspaceData`, `isLoading`, `refresh`
- [x] 9.3 Tạo `app/composables/billing/useBillingPreview.ts` — manual trigger preview, expose `previewItems`, `warnings`, `isCalculating`
- [x] 9.4 Tạo `app/composables/billing/useBillingItems.ts` — fetch billing items summary after generate; filter, search, pagination; expose `items`, `summary` (total/paid/unpaid amounts), `isLoading`
- [x] 9.5 Tạo `app/composables/billing/useBillingItemDetail.ts` — lazy load item detail (snapshots) per expand; expose `detail`, `isLoading`, `loadDetail(itemId)`
- [x] 9.6 Tạo `app/composables/billing/useBillingPaymentStatus.ts` — selected items state, bulk mark paid/unpaid; expose `selectedIds`, `toggle`, `selectAll`, `markPaid`, `markUnpaid`, `isSaving`

## 10. Client Components

- [x] 10.1 Tạo `app/components/billing/BillingStatusBadge.vue` — hiển thị `draft` / `finalized` / `unpaid` / `paid` với màu phù hợp design system
- [x] 10.2 Tạo `app/components/billing/BillingMeterReadingsTable.vue` — bảng nhập điện/nước theo tòa nhà; columns: Room, Tenant, Đ.cũ, Đ.mới, TT(điện), N.cũ, N.mới, TT(nước), Notes; old_reading auto-populated from latest; override toggle để nhập `consumption` thủ công + `adjustment_reason`; warning indicator khi negative consumption; disabled khi period finalized
- [x] 10.3 Tạo `app/components/billing/BillingPreviewTable.vue` — bảng preview tiền; manual trigger button "Tính tiền preview"; columns: Room, Tenant, Tiền thuê, Tiền điện, Tiền nước, Dịch vụ, Tổng, Warnings; warning icons per cell
- [x] 10.4 Tạo `app/components/billing/BillingSummaryCards.vue` — summary sau generate: Total rooms, Total receivable, Total paid, Total unpaid, Total electricity, Total water
- [x] 10.5 Tạo `app/components/billing/BillingItemsTable.vue` — bảng billing items: checkbox, Room, Tenant, Rent, Đ, N, DV, Total, Payment status badge, Paid at; expandable row → lazy load detail từ snapshot tables (contract/service/utility breakdown); hỗ trợ filter và search
- [x] 10.6 Tạo `app/components/billing/BillingBulkActions.vue` — hiển thị khi có items được chọn: "X phòng đã chọn | Mark paid | Mark unpaid | Clear selection"
- [x] 10.7 Tạo `app/components/billing/BillingRegenerateModal.vue` — modal khi regenerate bị block: "X phòng đã thanh toán. Đánh dấu chưa thanh toán trước khi tạo lại."

## 11. Client Pages

- [x] 11.1 Sửa `app/pages/billing/index.vue` — thành entry page:
  - Building selector (dropdown, fetch `/api/buildings`)
  - Month selector (1–12)
  - Year input
  - Button "Mở billing workspace" → navigate tới `/buildings/[id]/billing?month=&year=`
  - Tiêu đề "Vận hành / Tính tiền hàng tháng"
- [x] 11.2 Tạo `app/pages/buildings/[id]/billing.vue` — billing workspace:
  - Context bar: building name, month/year, status badge, Actions (Generate/Finalize/Unlock)
  - 3 tabs luôn visible (hybrid): Readings | Preview | Billing
  - Tab content adapts per state:
    - No readings: Tab 1 editable, Tab 2+3 empty state
    - Readings done: Tab 2 preview available (manual trigger)
    - Run exists: Tab 1 editable + yellow banner "Cần tạo lại", Tab 3 active
    - Finalized: Tab 1 read-only, Tab 3 payment still editable
- [x] 11.3 Sửa room detail page (`app/pages/rooms/[id]/index.vue`) — thêm "Lịch sử billing" section:
  - Fetch `/api/billing-items?room_id=` hoặc tương tự
  - Hiển thị danh sách billing items theo kỳ: Period, Total, Status, Paid at
  - Read-only hoàn toàn, không có action tạo bill
  - Link tới billing workspace nếu muốn xem chi tiết

## 12. Navigation

- [x] 12.1 Sửa `app/utils/constants/navigation.ts` — giữ nguyên `billing` nav item trỏ `/billing`, đổi label thành "Tính tiền" hoặc giữ "Vận hành" tùy product decision

## 13. Verify

- [x] 13.1 Chạy `npm run typecheck` — 0 errors
- [x] 13.2 Chạy `npm run lint` — 0 warnings/errors
- [x] 13.3 Kiểm tra migration scenarios:
  - Unique billing period per building/month/year (duplicate → conflict)
  - `is_adjusted = true` không có `adjustment_reason` → rejected
  - Invalid `payment_status` value → rejected
  - CASCADE delete: delete billing_run → auto-delete items + snapshots
- [x] 13.4 Kiểm tra API scenarios:
  - Load workspace trả active contracts + readings (old_reading from latest) + warnings
  - Preview tính đúng rent, enabled services, utility consumption, per-person quantity
  - Generate snapshot tạo đúng billing_run + billing_items + 3 snapshot tables
  - Regenerate bị chặn nếu đã có item paid (modal explain)
  - Negative consumption block generate (throw), preview chỉ warning
  - Item detail endpoint trả full snapshot breakdown
  - Bulk mark paid set `paid_at/paid_by`; mark unpaid clear metadata
- [x] 13.5 Kiểm tra UI scenarios:
  - Entry page chọn building/month/year và navigate đúng
  - Hybrid tabs: all visible, content adapts per state
  - Draft workspace: nhập readings (old auto-populated), override consumption, thấy warnings
  - Manual preview trigger button
  - Generate creates run → Tab 3 active
  - Tab 1 after generate: yellow banner "Cần tạo lại"
  - Finalized period: inputs disabled, payment status vẫn editable
  - Billing result: summary cards, expand row → lazy load detail, search/filter, bulk select, bulk mark paid/unpaid

---

## Phase 2 — UX Consolidation

## 14. Billing Overview Page (thay thế entry form)

- [x] 14.1 Tạo `server/api/billing-periods/summary.get.ts` — endpoint trả list periods enriched:
  - JOIN `buildings.name`
  - Aggregate per run: `item_count`, `total_amount`, `paid_count` (count billing_items WHERE payment_status = 'paid')
  - Filter: `?building_id=&year=`
  - Sort: newest period first
- [x] 14.2 Tạo `app/composables/billing/useBillingOverview.ts` — fetch summary list, expose `periods`, `isLoading`, filter state
- [x] 14.3 Sửa `app/pages/billing/index.vue` — thay form chọn building bằng **danh sách billing periods**:
  - Filter bar: building dropdown + year selector
  - Table: Tòa nhà | Kỳ (T6/2026) | Trạng thái (badge) | Số phòng | Đã thu | Tổng tiền | Action (Mở →)
  - Button "Tạo kỳ tính tiền mới" → navigate chọn building+month hoặc inline modal
  - Summary footer: tổng finalized, draft, tổng thu

## 15. Consolidated Billing Table (merge 3 tabs → 1 bảng)

- [x] 15.1 Tạo `app/components/billing/BillingConsolidatedTable.vue` — bảng gộp:
  - Columns: TT | Phòng | Họ tên | Đ.cũ | Đ.mới (input) | N.cũ | N.mới (input) | Tiền Đ (auto) | Tiền N (auto) | Phòng/DV (auto) | Tổng (auto) | Đóng tiền (checkbox) | Thao tác (⋮)
  - Props: `contracts`, `meterReadings`, `billingItems` (nếu run exists), `electricityRate`, `waterRate`, `disabled`
  - Client-side pricing: tính inline khi input blur/enter — `(mới - cũ) × rate`
  - Keyboard nav: Tab/Enter nhảy giữa inputs
  - Row highlight: warning nếu negative consumption
  - Footer: tổng cộng, count đã thu
- [x] 15.2 Tạo `app/utils/billing-calculator.ts` — pure function client-side:
  - `calculateRowAmounts(input: { oldElec, newElec, oldWater, newWater, elecRate, waterRate, monthlyRent, services[] }): RowAmounts`
  - Dùng chung logic với server pricing engine (subset)
- [x] 15.3 Sửa `app/pages/buildings/[id]/billing.vue` — refactor:
  - Bỏ 3 tabs (BillingMeterReadingsTable, BillingPreviewTable, BillingItemsTable)
  - Thay bằng `BillingConsolidatedTable` duy nhất
  - Context bar giữ nguyên: building name, month selector, status badge, Generate/Finalize/Unlock buttons
  - Load workspace data → merge contracts + readings + items (nếu có) → pass vào consolidated table
  - Auto-save readings on blur (debounced) thay vì manual save button
- [x] 15.4 Sửa workspace API response hoặc composable — thêm `building.electricityRate`, `building.waterRate` vào workspace data (nếu chưa có)

## 16. Điều Chỉnh Đầu Kỳ

- [x] 16.1 Tạo `app/components/billing/BillingAdjustmentSection.vue` — collapsible section:
  - Header: "▼ Điều chỉnh chỉ số đầu kỳ (thay đồng hồ / sửa sai)"
  - Table: Phòng | Người thuê | ĐT | Ngày vào | Số Đ đầu kỳ (editable) | Số N đầu kỳ (editable) | Lý do (text input)
  - Save button per row hoặc bulk save
  - Khi save → update `old_reading` + set `is_adjusted = true` + `adjustment_reason` → recalculate consumption in bảng chính
- [x] 16.2 Thêm vào `app/pages/buildings/[id]/billing.vue` — render `BillingAdjustmentSection` bên dưới bảng gộp, collapsed by default

## 17. Navigation Restructure

- [x] 17.1 Sửa `app/utils/constants/navigation.ts` — đổi structure:
  - Remove `rooms` khỏi top-level nav
  - `buildings` item có `children` (dynamic từ building list) hoặc expand on click
  - Keep: Dashboard, Tòa nhà (expandable), Khách thuê, Hợp đồng, Vận hành
- [x] 17.2 Sửa `app/components/app/AppSidebar.vue` — support expandable nav items:
  - Building list dưới "Tòa nhà" (fetch buildings, show as sub-items)
  - Active building highlighted
  - Click building → navigate `/buildings/[id]`
- [x] 17.3 Tạo hoặc sửa building detail layout — sub-tabs ngang:
  - Tabs: Phòng | Tính tiền | Cài đặt
  - `/buildings/[id]` → default tab Phòng (list rooms of building)
  - `/buildings/[id]/billing` → tab Tính tiền
  - `/buildings/[id]/settings` → tab Cài đặt

## 18. Cleanup

- [x] 18.1 Xóa hoặc redirect `/buildings/[id]/meter-readings` — legacy page, functionality merged vào billing
- [x] 18.2 Bỏ `BillingMeterReadingsTable.vue`, `BillingPreviewTable.vue` — thay bằng consolidated table
- [x] 18.3 Bỏ `useBillingPreview.ts` — không cần preview riêng, tính client-side inline

## 19. Verify Phase 2

- [ ] 19.1 `/billing` hiện danh sách periods, filter building/year hoạt động
- [ ] 19.2 Click row từ overview → navigate đúng tới workspace
- [ ] 19.3 Billing workspace: 1 bảng gộp, nhập Đ.mới/N.mới → tiền tính inline
- [ ] 19.4 Keyboard nav (Tab/Enter) giữa inputs smooth
- [ ] 19.5 Đóng tiền checkbox toggle hoạt động
- [ ] 19.6 Section điều chỉnh đầu kỳ: mở/đóng, edit old_reading, save + recalculate
- [ ] 19.7 Sidebar: building list expandable, click → sub-tabs hiện
- [ ] 19.8 Generate/Finalize/Unlock buttons vẫn hoạt động đúng
- [x] 19.9 `npm run typecheck` — 0 errors
- [x] 19.10 `npm run lint` — 0 errors
