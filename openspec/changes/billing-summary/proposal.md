## Why

Admin cần nhìn nhanh tình hình thu tiền: kỳ này phải thu bao nhiêu, đã thu bao nhiêu, còn nợ bao nhiêu phòng. Đây là màn hình tổng quan financial cho phase v0.3.

## What Changes

- Summary stats: total invoices, total_amount, total_paid, overdue count
- Danh sách phòng/hóa đơn còn nợ với số tiền cụ thể
- Filter theo kỳ billing (period) và building
- API endpoint riêng cho billing summary (tương tự dashboard summary)

## Capabilities

### New Capabilities

- `billing-summary-api`: `GET /api/billing/summary?periodStart&periodEnd&buildingId?`
- `billing-summary-client`: Billing summary page tại `/billing`

### Modified Capabilities

_(không có)_

## Impact

- `server/repositories/billing/` — aggregate queries
- `server/services/billing/` — permission check
- `server/api/billing/summary.get.ts`
- `app/types/billing.ts` — BillingSummary DTO
- `app/composables/useBillingSummary.ts`
- `app/pages/billing/index.vue` — billing overview page
- Navigation: thêm link "Billing" vào AppSidebar
