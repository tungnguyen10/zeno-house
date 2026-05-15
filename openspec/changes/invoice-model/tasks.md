## 1. Database

- [ ] 1.1 Tạo migration cho `invoices` + `invoice_items` — columns, enums, FK, RLS, index, triggers
- [ ] 1.2 Regenerate `app/types/database.types.ts`

## 2. Types, Validators & Mappers

- [ ] 2.1 Tạo `app/types/invoices.ts` — InvoiceStatus enum, Invoice, InvoiceItem, InvoiceWithItems DTOs
- [ ] 2.2 Tạo `app/utils/validators/invoices.ts` — Zod schemas cho invoice và invoice_item
- [ ] 2.3 Tạo `app/utils/mappers/invoices.ts` — mapInvoice, mapInvoiceItem

## 3. Verify

- [ ] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors
