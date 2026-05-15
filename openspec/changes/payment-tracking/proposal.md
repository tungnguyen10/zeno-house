## Why

Sau khi hóa đơn được phát hành, admin cần ghi nhận thu tiền thủ công. Đây là phần cuối cùng của billing loop: invoice → payment → status update.

## What Changes

- Thêm bảng `payments` — ghi nhận từng lần thu tiền cho 1 invoice
- API: tạo payment, list payments theo invoice
- Logic: cập nhật `invoice.status` sau mỗi payment (draft → issued → partial → paid)
- UI: payment section trong invoice detail, modal ghi nhận thanh toán

## Capabilities

### New Capabilities

- `payments-database`: Schema `payments`, FK → invoices, RLS
- `payments-api`: `POST /api/payments`, `GET /api/payments?invoiceId=<id>`
- `payments-client`: Payment section + modal trong invoice detail

### Modified Capabilities

- `invoices-client`: Thêm payment section và status update vào invoice detail

## Impact

- `supabase/migrations/` — migration cho `payments`
- `app/types/payments.ts` — Payment DTO
- `server/api/payments/` — 2 endpoints
- `server/services/payments/` — create + update invoice status
- `server/repositories/payments/` — insert, list by invoice
- `app/components/invoices/PaymentSection.vue`
- `app/components/invoices/RecordPaymentModal.vue`
