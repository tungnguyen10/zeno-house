## Context

Billing workspace đã đủ đẹp sau change `billing-readability-and-polish`. Manager đã dùng thử trên data thật và phản hồi 4 nhu cầu thực tế:

- Nhập chỉ số 30+ phòng từ Excel mất nhiều phút thao tác.
- Cần file Excel để gửi kế toán / chủ nhà / đối chiếu nội bộ.
- Kỳ thu tiền tập trung vào 1–2 ngày, ghi từng hoá đơn quá chậm.
- Phát hành nhầm cả kỳ (sai tỉ giá điện) hiện không có cách rút lại tổng thể, phải void từng invoice.

Đồng thời cần policy thống nhất: mọi hành động phá tính bất biến phải có lý do ghi lại để audit chịu trách nhiệm được.

## Goals / Non-Goals

**Goals:**
- Giảm thời gian nhập chỉ số toà 30 phòng từ ~10 phút xuống <2 phút (paste 1 lần).
- Cho phép xuất Excel kỳ vận hành đầy đủ thông tin để gửi đối tác.
- Cho phép thu tiền hàng loạt với 1 modal duy nhất.
- Cho phép admin huỷ phát hành cả kỳ với rule rõ ràng cho invoice đã có payment.
- Mọi destructive action có reason ≥10 ký tự, lưu vào audit metadata.

**Non-Goals:**
- Không tự match payment với hoá đơn từ file ngân hàng (out of scope, là 1 change riêng "auto-reconcile" sau).
- Không xuất PDF / template hoá đơn cá nhân (đã có flow khác hoặc sẽ có).
- Không undo từng action lẻ (chỉ unissue cả kỳ; void invoice / reissue đã có sẵn).
- Không bulk-issue: phát hành luôn theo full period, không phát hành 1 nhóm chọn lọc.

## Decisions

### D1 — Bulk paste: parse client-side, save server-side bằng existing endpoint

Lựa chọn:
- **A. Endpoint bulk save mới**: `POST /readings/bulk` array. Lợi: 1 round-trip. Hại: phải design payload, validate, transaction.
- **B. Reuse existing `saveReading()` per row, parallel (chosen)**: dán → parse → fill state → debounced auto-save trigger từng row qua endpoint cũ. Lợi: 0 server change. Hại: N request parallel.

Chọn **B** vì:
- N=30 phòng, request nhỏ, server xử lý trong ~1s.
- Endpoint cũ đã có validation đầy đủ — không cần copy logic.
- Auto-save debounce 800ms gom các thay đổi nhanh thành 1 lần / dòng.
- Save success refresh grid 1 lần (không phải 3 lần như hiện tại).

Nếu sau này N tăng lên 100+ và performance kém, mở change mới thêm endpoint bulk.

### D2 — Refresh đơn lẻ thay vì 3 GET

Hiện tại sau mỗi save: `loadGrid()` + `loadOverview()` + `loadDrafts()`. Đổi: chỉ `loadGrid()` trả full state bao gồm KPI strip data + draft preview. Server gộp logic, client gọi 1 lần.

Sticky KPI strip subscribe vào cùng state — auto refresh khi grid load.

### D3 — Excel export: `exceljs` server-side

Lựa chọn:
- **A. Generate client-side (sheetjs/xlsx)**: bundle nặng (~500KB), khó style.
- **B. Server (exceljs) (chosen)**: stream binary response, style flexible, server cache khả thi sau này.

Layout 3 sheet:
- **Sheet 1 — Hoá đơn**: phòng, khách, mã HĐ, ngày phát hành, hạn, tiền nhà, tiền điện, tiền nước, dịch vụ khác, điều chỉnh, tổng, đã thu, còn lại, trạng thái.
- **Sheet 2 — Thanh toán**: thời gian, hoá đơn (room+tenant), số tiền, phương thức, người ghi nhận.
- **Sheet 3 — Tổng hợp**: KPI strip values + audit highlights (số HĐ phát hành / void / paid).

File name: `billing-{building-slug}-{YYYY-MM}.xlsx`. Endpoint `GET /api/billing/periods/:id/export.xlsx`.

### D4 — Bulk payment: transactional all-or-nothing

Endpoint `POST /api/billing/invoices/bulk-payments` body:
```ts
{
  payments: Array<{
    invoice_id: string
    amount: number
    payment_method: PaymentMethod
    payment_date: string  // ISO date
    reference?: string
    note?: string
  }>
}
```

Server:
1. Validate từng row (Zod array).
2. Bắt đầu transaction (Supabase RPC hoặc sequential với rollback marker).
3. Per row: gọi `recordPayment` service hiện có.
4. Nếu bất kỳ row nào fail → rollback toàn bộ, trả `409 CONFLICT` với `details: { failed_index, failed_reason }`.
5. Append audit `payments.bulk_recorded` với metadata `{ count, total_amount, invoice_ids }` (1 event tổng, không append từng row).

Trả về danh sách payments đã ghi để client cập nhật UI.

UI flow:
- Tick checkbox dòng có balance > 0.
- Action bar hiện "Đã chọn N — [Ghi thu hàng loạt]".
- Modal: 1 lần nhập `payment_method`, `payment_date`, `note`; bảng inline cho từng dòng với amount mặc định = balance, cho phép sửa.
- Submit → loading → toast success/error.

### D5 — Unissue period: rule giữ invoice đã có payment

Endpoint `POST /api/billing/periods/:id/unissue` body `{ reason: string }`.

Service `BillingPeriodService.unissue(periodId, reason, actor)`:
1. Validate `reason.trim().length >= 10`.
2. Permission check: `billing.unissue` (mới — admin only mặc định).
3. Block nếu period status = `closed` → `409 CONFLICT` "Kỳ đã chốt, không thể huỷ phát hành".
4. Load tất cả invoice của period.
5. Phân loại:
   - `void_targets` = invoice chưa có payment thành công nào (kể cả `issued`, `partially_paid` 0 payment, `pending`).
   - `retained` = invoice có ≥1 payment thành công.
6. Loop `void_targets`: gọi `voidInvoice` (reuse service có sẵn) với reason chuyển tiếp.
7. Cập nhật period status:
   - Nếu `retained.length === 0`: status → `drafted`.
   - Nếu `retained.length > 0`: status → `collecting` nhưng cho phép edit chỉ số (cờ phụ `unissued_at` ghi vào period nếu cần — đề xuất dùng audit thay vì cột mới).
8. Append audit `period.unissued` với metadata:
   ```
   {
     reason,
     voided_count: void_targets.length,
     retained_paid_count: retained.length,
     retained_invoice_ids: retained.map(i => i.id)
   }
   ```
9. Trả về `{ voided: number, retained: number, status: BillingPeriodStatus }`.

Client UI:
- Kebab item "Hủy phát hành kỳ" (admin only).
- Modal: hiện preview "Sẽ huỷ N hoá đơn, giữ M hoá đơn đã có thanh toán", textarea reason ≥10, button danger "Xác nhận huỷ phát hành".
- Server response → toast success → refresh workspace.

### D6 — Permission `billing.unissue`

Thêm vào `server/utils/permissions.ts` (hoặc nơi khai báo capability hiện tại):
- Mặc định: chỉ role `admin`.
- Manager không có. Cấp tay qua bảng `user_capabilities` nếu cần.

Lý do tách riêng (không reuse `billing.write`): unissue là destructive ở scope cả kỳ; cần guard rail riêng.

### D7 — Reason policy ≥10 ký tự

Validate ở server cho mọi destructive action:
- `voidInvoice(reason)` — đã có ở service, kiểm tra ≥10
- `reissueInvoice(reason)` — kiểm tra ≥10
- `unissuePeriod(reason)` — kiểm tra ≥10
- `saveOverride(reason)` — kiểm tra ≥10
- `createAdjustment(reason)` khi `amount < 0` và `|amount| >= 100000` — kiểm tra ≥10

Trim trước khi check. Throw `VALIDATION_ERROR` với message Việt.

UI side: input có `minlength="10"` + counter realtime; submit disabled khi chưa đạt.

### D8 — Bulk paste UX detail

`BillingDraftGridStep.vue`:
- Bắt event `paste` trên input của ô "Chỉ số mới".
- Parse clipboard text:
  - Tab-separated → multi-column (lấy column đầu).
  - Newline-separated → multi-row.
  - Decimal separator `,` hoặc `.`.
- Fill từ ô đang focus xuống các ô kế tiếp cùng cột; skip dòng disabled (không có meter / read-only).
- Highlight các ô vừa fill trong 1.5s.
- Trigger debounced save (800ms) cho từng dòng đã fill.

Keyboard nav:
- `Tab` → ô input kế tiếp cùng dòng (skip read-only) → cuối dòng → đầu dòng kế.
- `Enter` → ô cùng cột dòng dưới.
- `Shift+Tab` / `Shift+Enter` → ngược lại.

### D9 — Inline 2-line mobile row

Bỏ `hideOnMobile: true` cho các cột breakdown. Layout dòng:
```
P.01 · Võ Chí Linh                    [_____ kWh ]
  Cũ 12.345 → Mới ____  · Điện 3.500đ/kWh
```
Dòng 2 dùng `text-xs text-muted` chứa thông tin breakdown.

Trên desktop giữ table layout cũ.

## Risks / Trade-offs

- **[Bulk save N parallel quá tải Supabase]** → Mitigation: chunk thành batch 5–10 song song; 30 phòng = 3–6 batch. Server log nếu thấy lỗi 429.
- **[Auto-save mất chỉ số khi user offline]** → Mitigation: hiện indicator "Đã lưu / Đang lưu / Lỗi"; giữ giá trị trong local state cho đến khi save thành công.
- **[Excel export cho kỳ siêu lớn (>500 hoá đơn) chậm/timeout]** → Mitigation: v1 chấp nhận; cảnh báo nếu >300; phase sau chuyển sang background job.
- **[Bulk payment transaction phức tạp]** → Mitigation: nếu Supabase không có RPC sẵn, dùng sequential + rollback marker (track payment_ids đã insert, xoá ngược khi lỗi). Document trong code.
- **[Unissue khi có retained paid invoices có thể gây inconsistency]** → Mitigation: rule rõ — paid invoice giữ nguyên, period vẫn `collecting`; user có thể tiếp tục thao tác. Mô tả trong UI preview.
- **[Reason ≥10 ký tự là arbitrary]** → Mitigation: dễ điều chỉnh, document; giảm rủi ro reason trống "x", "test".
- **[`exceljs` thêm dependency lớn]** → Mitigation: chỉ import server-side (không vào bundle client); chấp nhận trade-off.

## Migration Plan

1. Server foundation: thêm permission `billing.unissue`, validate reason policy.
2. Bulk payment endpoint + bulk paste auto-save.
3. Excel export endpoint + button.
4. Unissue endpoint + UI modal.
5. Inline mobile row + keyboard nav.

Mỗi bước commit riêng, có thể roll back từng phần.

## Open Questions

- Audit có cần track từng row payment trong bulk hay chỉ event tổng? → Đề xuất event tổng + per-row vẫn append `payment.recorded` thường (reuse path cũ).
- Excel export có cần signed URL / expiring link không? → v1 trả trực tiếp binary, public chỉ qua auth. Nếu cần share external sẽ là change sau.
- Có expose số phòng trong file name Excel không? → Không, dùng building slug + period.
