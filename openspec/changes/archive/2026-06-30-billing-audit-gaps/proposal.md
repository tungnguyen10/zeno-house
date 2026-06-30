## Why

`billing_audit_events` có 2 gap nhỏ nhưng cụ thể: action `reading.saved` được định nghĩa trong constants nhưng chưa bao giờ được ghi (meter-readings service không có audit call), và `invoice.reissued` thiếu `before_data`/`after_data` — inconsistent với toàn bộ các action khác. Sửa sớm trước khi audit log được dùng rộng hơn.

## What Changes

- **Meter readings audit**: Thêm `BillingAuditService.append` vào `server/services/meter-readings/index.ts` khi save chỉ số — ghi `reading.saved` với `before_data` (chỉ số cũ nếu là update), `after_data` (chỉ số mới), metadata count.
- **Invoice reissued before/after**: Bổ sung `before_data` (voided invoice snapshot) và `after_data` (new invoice snapshot) vào event `invoice.reissued` trong `server/services/billing/invoices.ts`.
- **`audit-summary.ts` coverage**: Đảm bảo `formatAuditSummary` có case cho `reading.saved` (đã có handler, cần verify nó đủ).

## Capabilities

### New Capabilities
<!-- Không có capability mới — đây là fix/completion của billing-api -->

### Modified Capabilities
- `billing-api`: Hai mutation paths (`meter-readings save`, `invoice reissue`) hiện thiếu audit payload đúng theo contract.

## Impact

- `server/services/meter-readings/index.ts` — thêm audit append
- `server/services/billing/invoices.ts` — bổ sung before_data/after_data cho INVOICE_REISSUED
- `server/services/billing/audit-summary.ts` — verify case `reading.saved`
- Không có schema migration, không có breaking change
