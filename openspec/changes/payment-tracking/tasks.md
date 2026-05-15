## 1. Database

- [ ] 1.1 Tạo migration cho `payments` — columns, FK → invoices, method enum, RLS, check constraint amount > 0
- [ ] 1.2 Regenerate `app/types/database.types.ts`

## 2. Types & Validators

- [ ] 2.1 Tạo `app/types/payments.ts` — PaymentMethod enum, Payment DTO
- [ ] 2.2 Tạo `app/utils/validators/payments.ts` — createPaymentSchema
- [ ] 2.3 Tạo `app/utils/mappers/payments.ts` — mapPayment

## 3. Server

- [ ] 3.1 Tạo `server/repositories/payments/index.ts` — insert, listByInvoice, deleteById, sumByInvoice
- [ ] 3.2 Tạo `server/services/payments/index.ts` — create (validate invoice status + recalculate), listByInvoice, delete + recalculate
- [ ] 3.3 Tạo `server/api/payments/index.post.ts`, `index.get.ts`, `[id].delete.ts`
- [ ] 3.4 Thêm `payments.*` capabilities vào `server/utils/permissions.ts`

## 4. Client

- [ ] 4.1 Tạo `app/composables/invoices/useInvoicePayments.ts`
- [ ] 4.2 Tạo `app/components/invoices/RecordPaymentModal.vue`
- [ ] 4.3 Tạo `app/components/invoices/PaymentSection.vue` — history table + record button
- [ ] 4.4 Cập nhật `app/pages/invoices/[id]/index.vue` — thêm `<PaymentSection>`

## 5. Verify

- [ ] 5.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 5.2 Test thủ công: ghi payment → invoice status cập nhật đúng
