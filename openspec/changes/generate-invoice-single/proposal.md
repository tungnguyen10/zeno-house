## Why

Kiểm chứng toàn bộ billing flow bằng 1 use case cụ thể: sinh hóa đơn cho 1 phòng. Chỉ làm đúng 1 trường hợp, chạy thật, có itemized lines đầy đủ trước khi mở rộng batch.

## What Changes

- Service generate invoice: lấy rent từ contract, utility readings của kỳ, active service fees → tạo `invoice` + `invoice_items`
- API endpoint: `POST /api/invoices/generate` với `{ room_id, period_start, period_end }`
- UI: action "Sinh hóa đơn" trong room detail, form chọn kỳ, xem invoice detail sau khi tạo
- Invoice detail page: hiển thị itemized lines, status badge, tổng tiền

## Capabilities

### New Capabilities

- `invoices-api`: Generate endpoint + GET invoice detail
- `invoices-client`: Invoice detail page, generate modal trong room detail

### Modified Capabilities

- `rooms-client`: Thêm nút "Sinh hóa đơn" + invoice history trong room detail

## Impact

- `server/services/invoices/` — generate logic
- `server/repositories/invoices/` — insert invoice + items, query detail
- `server/api/invoices/generate.post.ts`, `[id].get.ts`
- `app/pages/invoices/[id]/index.vue` — invoice detail
- `app/components/invoices/` — InvoiceDetailCard, InvoiceItemsTable
- `app/composables/invoices/` — useInvoiceDetail, useGenerateInvoice
