## Context

Trước khi build generate invoice, cần chốt schema. Một invoice có nhiều items — mỗi item là 1 dòng tiền: tiền phòng, tiền điện, tiền nước, phí dịch vụ. Invoice liên kết với contract (hoặc room nếu không có contract).

## Goals / Non-Goals

**Goals:**
- Schema `invoices` + `invoice_items` đủ để chứa tất cả billing lines
- Types + mappers dùng được ngay khi build generate logic
- Status lifecycle rõ ràng

**Non-Goals:**
- Generate logic
- UI
- Payment tracking

## Decisions

**D1 — `invoices` liên kết `contract_id` (nullable), `room_id` (NOT NULL)**
Luôn có `room_id`. `contract_id` nullable để cover trường hợp phòng đang active nhưng chưa có contract formal. Khi có contract → dùng contract rent_amount; khi không → dùng room.monthly_rent.

**D2 — `invoice_items.item_type` enum: `rent` | `electricity` | `water` | `service_fee` | `other`**
Giúp UI group và hiển thị đúng. `other` cho các khoản ad-hoc.

**D3 — Status lifecycle: `draft` → `issued` → `partial` | `paid` | `overdue`**
`draft`: vừa generate, chưa gửi. `issued`: đã phát hành. `partial`: có payment nhưng chưa đủ. `paid`: đã đủ. `overdue`: quá due_date chưa paid. Status cập nhật thủ công hoặc khi ghi payment.

**D4 — `period_start`, `period_end` trên `invoices` để xác định kỳ**
Date range thay vì year/month int — flexible hơn, dễ query range.

**D5 — `invoice_items.unit_price` + `quantity` + `amount`**
`amount = unit_price * quantity`. Electricity/water: `unit_price` = giá/kWh hoặc giá/m³, `quantity` = consumption. Rent: `unit_price` = monthly_rent, `quantity` = 1.

## Risks / Trade-offs

- **Không có rate table**: Giá điện/nước nhập thủ công khi generate — không tự động lấy từ EVN. Acceptable cho v0.3.
