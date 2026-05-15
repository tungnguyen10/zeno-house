## Why

Trước khi build generate invoice, cần chốt cứng data model của hóa đơn để không phải sửa schema giữa chừng. Step này chỉ làm DB schema + types — không có UI hay generate logic.

## What Changes

- Thêm bảng `invoices` — header hóa đơn
- Thêm bảng `invoice_items` — dòng chi tiết (tiền phòng, điện, nước, phí)
- Types, validators, mappers cho invoice entities
- Không có UI, không có generate logic ở step này

## Capabilities

### New Capabilities

- `invoices-database`: Schema `invoices`, `invoice_items`, RLS, status enum

### Modified Capabilities

_(không có)_

## Impact

- `supabase/migrations/` — migration cho `invoices` + `invoice_items`
- `app/types/invoices.ts` — InvoiceStatus enum, Invoice, InvoiceItem DTOs
- `app/utils/validators/invoices.ts` — Zod schemas
- `app/utils/mappers/invoices.ts` — DB row → DTO
- `app/types/database.types.ts` — regenerate
