## 1. Server

- [ ] 1.1 Tạo `server/repositories/invoices/index.ts` — insert invoice+items, getById with items, checkDuplicate, updateStatus
- [ ] 1.2 Tạo `server/services/invoices/generate.ts` — assembly logic: rent + utility + service fees → invoice + items
- [ ] 1.3 Tạo `server/api/invoices/generate.post.ts` — POST /api/invoices/generate
- [ ] 1.4 Tạo `server/api/invoices/[id].get.ts` — GET /api/invoices/:id
- [ ] 1.5 Tạo `server/api/invoices/[id]/issue.patch.ts` — PATCH /api/invoices/:id/issue
- [ ] 1.6 Thêm `invoices.*` capabilities vào `server/utils/permissions.ts`

## 2. Client

- [ ] 2.1 Tạo `app/composables/invoices/useInvoiceDetail.ts`, `useGenerateInvoice.ts`
- [ ] 2.2 Tạo `app/components/invoices/InvoiceItemsTable.vue` — itemized lines table
- [ ] 2.3 Tạo `app/components/rooms/GenerateInvoiceModal.vue` — form: period, rates, notes
- [ ] 2.4 Tạo `app/pages/invoices/[id]/index.vue` — invoice detail page với issue action
- [ ] 2.5 Cập nhật `app/pages/rooms/[id]/index.vue` — thêm "Sinh hóa đơn" button + recent invoices list

## 3. Verify

- [ ] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 3.2 Test thủ công: generate invoice → xem detail → issue
