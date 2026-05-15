## 1. Server

- [ ] 1.1 Tạo `server/services/invoices/generate-batch.ts` — loop rooms, call single generate, collect results
- [ ] 1.2 Tạo `server/api/invoices/generate-batch.post.ts` — POST /api/invoices/generate-batch
- [ ] 1.3 Thêm `BatchGenerateResult`, `BatchRoomResult` types vào `app/types/invoices.ts`

## 2. Client

- [ ] 2.1 Tạo `app/composables/invoices/useBatchGenerate.ts`
- [ ] 2.2 Tạo `app/pages/invoices/generate/index.vue` — form + results table
- [ ] 2.3 Cập nhật AppSidebar — thêm link "Sinh hóa đơn hàng loạt" → `/invoices/generate`

## 3. Verify

- [ ] 3.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 3.2 Test thủ công: batch generate → xem kết quả per-room
