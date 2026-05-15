## Context

Khi cuối tháng, admin cần generate cho tất cả phòng đang có contract active. Batch = gọi single-room generate nhiều lần nhưng trong 1 request, collect kết quả, không fail cả batch.

## Goals / Non-Goals

**Goals:**
- Generate cho nhiều phòng cùng lúc theo period
- Filter theo building (optional)
- Per-room result: success (invoice_id) / skipped (reason) / error (message)
- Không rollback toàn batch nếu 1 phòng fail

**Non-Goals:**
- Background job / queue (sync request trong v0.3)
- Progress streaming / websocket
- Retry logic

## Decisions

**D1 — Reuse single-room generate service, wrap trong loop**
Không duplicate logic. Batch service gọi single-room service per room, catch errors, collect results. Clean separation.

**D2 — Skip conditions rõ ràng**
Skip nếu: (a) không có contract active, (b) thiếu utility readings và có utility fees, (c) đã có invoice draft/issued cho period. Trả `skip_reason` string trong result.

**D3 — Response: `{ generated: N, skipped: N, errors: N, results: [...] }`**
Không dùng 4xx nếu có lỗi từng phòng — batch vẫn trả 200 với error info trong results array. Chỉ 500 nếu fail toàn bộ (db connection, etc.)

**D4 — UI: batch generate page tại `/invoices/generate`**
Form: chọn period + building. Submit → hiển thị results table (phòng, status, invoice_id link hoặc skip reason). Không redirect — admin review kết quả ngay trên trang.

## Risks / Trade-offs

- **Timeout**: Nếu có nhiều phòng, request có thể timeout. Acceptable cho v0.3 scale (<50 phòng). Ở scale lớn hơn cần background job.
- **Partial success**: Admin cần xem kỹ results để biết phòng nào cần generate lại thủ công.
