## Why

Sau khi readability + IA đã polish (`billing-readability-and-polish`), workspace đủ sạch để nhận thêm 4 năng lực vận hành thực tế mà manager đã yêu cầu khi dùng thử:

1. **Bulk meter entry** — đang phải bấm save từng dòng; khu trọ 30+ phòng mất 5–10 phút thao tác lặp.
2. **Excel export** — chủ nhà cần file .xlsx để gửi kế toán hoặc đối chiếu nội bộ.
3. **Bulk payment** — kỳ thu tiền tập trung vào 1–2 ngày; ghi từng hoá đơn quá chậm.
4. **Unissue period** — khi phát hành nhầm cả kỳ (sai tỉ giá điện, sai số người), hiện không có cách rút lại nguyên kỳ ngoài void từng hoá đơn.

Tất cả thao tác phá vỡ tính bất biến (void, reissue, unissue) bắt buộc nhập lý do ≥10 ký tự, lưu vào `metadata.reason` của audit event.

## What Changes

- **Bulk paste + keyboard nav trong draft grid**:
  - Hỗ trợ dán dữ liệu từ Excel (`Ctrl+V`) vào cột chỉ số mới: tự fill xuống các dòng kế tiếp.
  - Phím `Tab`/`Shift+Tab`/`Enter`/`Shift+Enter` di chuyển giữa các ô input trong grid.
  - Auto-save với debounce 800ms thay vì button "Lưu nháp".
  - Save 1 lần chỉ trigger 1 GET refresh (gộp `loadGrid` + `loadOverview` + `loadDrafts` vào `loadGrid` trả full state).
- **Inline 2-line row trên mobile**:
  - Bỏ `hideOnMobile: true` cho 6 cột; thay bằng layout: dòng 1 = phòng + khách + chỉ số mới (input); dòng 2 = breakdown text-xs muted (chỉ số cũ → mới = sd · điện đơn giá).
- **Excel export**:
  - Endpoint mới `GET /api/billing/periods/:id/export.xlsx` trả file `.xlsx` với 3 sheet: `Hoá đơn`, `Thanh toán`, `Tổng hợp KPI`.
  - Button "Xuất Excel" trên header workspace.
  - Permission: `billing.read`.
- **Bulk payment recording**:
  - Tab "Thanh toán & công nợ" thêm cột checkbox + thanh action "Đã chọn N — Ghi thu hàng loạt".
  - Modal: nhập 1 lần `payment_method`, `payment_date`, `note` áp cho tất cả; mỗi dòng có thể override `amount` (mặc định = balance còn nợ).
  - Endpoint mới `POST /api/billing/invoices/bulk-payments` nhận array `{ invoice_id, amount, payment_method, payment_date, reference, note }`.
  - All-or-nothing transaction: 1 lỗi → rollback cả batch, trả `details` chỉ ra dòng lỗi.
- **Unissue period (huỷ phát hành cả kỳ)**:
  - Endpoint mới `POST /api/billing/periods/:id/unissue` nhận `{ reason: string }` (≥10 ký tự).
  - Hành vi: void tất cả invoice **chưa có thanh toán nào** (status `issued`, `partially_paid` không có payment, `pending`); giữ nguyên invoice đã có ít nhất 1 payment thành công; period quay về status `drafted` nếu tất cả invoice đều void; nếu còn invoice paid lại thì period giữ status `collecting` nhưng cho phép tiếp tục edit chỉ số / phát hành lại.
  - Permission mới: `billing.unissue` — chỉ admin có theo mặc định; manager không có cho đến khi cấp tay.
  - Block khi period đã `closed`.
  - Append audit `period.unissued` với metadata `{ reason, voided_count, retained_paid_count, retained_invoice_ids }`.
  - UI: kebab menu workspace thêm item "Hủy phát hành kỳ" (admin only); confirm modal yêu cầu nhập reason ≥10 ký tự, hiển thị trước số hoá đơn sẽ void / giữ.
- **Audit reason policy chuẩn hoá**:
  - Mọi destructive action (`void`, `reissue`, `unissue`, `override`, `adjustment` âm ≥ 100k) bắt buộc reason ≥10 ký tự, server-side validate, lưu trong `metadata.reason`.
  - Formatter audit summary của change 1 hiển thị reason rõ ràng cho các action này.

## Capabilities

### New Capabilities
- `billing-bulk-operations`: server contract + UI pattern cho bulk paste meter readings và bulk payment recording (transactional batch endpoint).
- `billing-period-unissue`: server contract + permission `billing.unissue` cho việc huỷ phát hành cả kỳ với rule giữ invoice đã có payment.
- `billing-export`: endpoint xuất Excel cho period.

### Modified Capabilities
- `billing-ui-readiness`: thêm pattern bulk-select (checkbox + action bar), inline 2-line row trên mobile, drawer/modal lý do bắt buộc.

## Impact

- **Server**:
  - `server/api/billing/invoices/bulk-payments.post.ts` (mới)
  - `server/api/billing/periods/[id]/unissue.post.ts` (mới)
  - `server/api/billing/periods/[id]/export.get.ts` (mới)
  - `server/services/billing/payments.ts` — thêm `recordBatch()` transactional
  - `server/services/billing/period-status.ts` — thêm `unissue()`
  - `server/services/billing/export.ts` (mới) — render workbook bằng thư viện (đề xuất `exceljs`)
  - `server/utils/permissions.ts` — thêm capability `billing.unissue`
  - `server/services/billing/audit.ts` — thêm validate reason ≥10 cho `void`, `reissue`, `unissue`, `override`, `adjustment` âm
- **Client**:
  - `app/components/billing/BillingDraftGridStep.vue` — bulk paste, keyboard nav, debounced auto-save, inline mobile layout, refresh đơn lẻ
  - `app/components/billing/BillingPaymentsStep.vue` — checkbox column, bulk action bar, bulk payment modal
  - `app/components/billing/BillingUnissueModal.vue` (mới) — confirm modal với reason
  - `app/pages/billing/[building]/[period].vue` — kebab thêm "Hủy phát hành kỳ", "Xuất Excel"
  - `app/composables/billing/useBillingPeriodWorkspace.ts` — `recordBulkPayment()`, `unissuePeriod()`, `exportXlsx()`
- **Database**: không có schema change. Dùng status hiện có (`drafted`, `issued`, `collecting`, `closed`) + audit metadata.
- **Dependencies**:
  - Yêu cầu `billing-readability-and-polish` đã archive (cần kebab menu, drawer, toast).
  - Dùng resolver display để show thông tin enriched trên modal/preview.
- **Breaking**: không. Các endpoint cũ giữ nguyên.
- **External library**: thêm `exceljs` cho server-side workbook generation.
