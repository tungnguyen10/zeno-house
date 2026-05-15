## Context

Dựa trên invoice model đã chốt (F0.3.3) và utility readings (F0.3.1) + service fees (F0.3.2). Generate invoice = assembly: lấy các data points → tạo invoice header + items.

## Goals / Non-Goals

**Goals:**
- Generate invoice cho 1 room + 1 period: rent line + utility lines + service fee lines
- Preview trước khi confirm (draft state)
- Invoice detail page đầy đủ

**Non-Goals:**
- Batch generate (F0.3.5)
- Send email invoice
- PDF export

## Decisions

**D1 — Input: `{ room_id, period_start, period_end, electricity_rate, water_rate }`**
Admin cần nhập giá điện/nước (VND/kWh, VND/m³) vì rate có thể thay đổi theo tháng và theo khu vực. Không lưu rate trong DB ở v0.3.

**D2 — Generate tạo invoice ở `draft` status**
Admin review rồi mới `issue`. Tránh tạo invoice sai rồi không sửa được. Issue action là PATCH endpoint riêng.

**D3 — Consumption lookup: lấy 2 reading gần nhất trước/trong period**
Service lấy reading trong period + reading ngay trước period_start để tính consumption. Nếu thiếu reading → skip utility line, ghi warning trong response.

**D4 — Idempotency: không cho generate 2 invoice cho cùng room + period**
Service check existing non-cancelled invoice cho room + overlapping period → 409 CONFLICT.

**D5 — Invoice detail page tại `/invoices/:id`**
Full itemized table, status badge, tổng tiền, action "Phát hành" (draft → issued).

## Risks / Trade-offs

- **Rate nhập thủ công**: Nếu admin nhập sai rate → invoice sai. Phải cancel và tạo lại. Acceptable cho v0.3.
- **Overlapping period check**: Dùng simple date overlap query. Nếu logic phức tạp hơn sau này, cần refine.
