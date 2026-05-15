## Why

Sau khi single-room generate đã chạy đúng, admin cần tạo hóa đơn cho nhiều phòng cùng lúc cuối tháng. Batch generate là tác vụ thực tế nhất trong billing workflow.

## What Changes

- Batch generate service: nhận `{ building_id?, period_start, period_end }`, generate cho tất cả phòng active có contract
- Skip phòng thiếu dữ liệu (không có contract, không có utility reading), trả per-room result
- Không fail toàn batch vì 1 phòng lỗi
- UI: trang batch generate với chọn kỳ + building filter, bảng kết quả (success / skip / error theo phòng)

## Capabilities

### New Capabilities

- `generate-invoice-batch-api`: `POST /api/invoices/generate-batch`
- `generate-invoice-batch-client`: Batch generate page

### Modified Capabilities

_(không có)_

## Impact

- `server/services/invoices/` — batch generate logic
- `server/api/invoices/generate-batch.post.ts`
- `app/types/invoices.ts` — thêm `BatchGenerateResult` type
- `app/pages/invoices/generate/index.vue` — batch trigger page
- `app/composables/invoices/useBatchGenerate.ts`
