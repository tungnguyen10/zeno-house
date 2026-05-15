## Context

Phí dịch vụ trong nhà trọ VN thường là: internet, rác, gửi xe, phí quản lý — các khoản fixed amount mỗi tháng. Cần cấu hình ở system level rồi gán cho phòng. Không cần công thức tính phức tạp ở v0.3.

## Goals / Non-Goals

**Goals:**
- Tạo/sửa/xóa fee definitions (global catalog)
- Gán fee vào phòng với amount có thể override
- Deactivate fee (inactive) mà không xóa historical data

**Non-Goals:**
- Fee per-contract (giữ per-room cho đơn giản)
- Công thức tính fee theo usage
- Fee shared giữa nhiều phòng
- Approval workflow khi thêm fee

## Decisions

**D1 — 2 bảng: `service_fee_definitions` + `room_service_fees`**
`service_fee_definitions`: global catalog (name, default_amount, unit=`monthly`, description, active). `room_service_fees`: assignment (room_id FK, fee_definition_id FK, amount override nullable, active, start_date).

**D2 — Amount override per room**
Nếu `room_service_fees.amount IS NULL` → dùng `service_fee_definitions.default_amount`. Giúp admin set default rồi override từng phòng nếu cần (vd: phòng có internet riêng giá khác).

**D3 — Page `/service-fees` + section trong Room detail**
Fee definitions có trang quản lý riêng. Room detail có section "Phí dịch vụ" list các fee đang gán + nút thêm/xóa.

**D4 — `active` field để soft-deactivate**
Không xóa fee khi deactivate — invoice_items đã tồn tại vẫn giữ nguyên. Generate invoice chỉ lấy fee có `active = true`.

## Risks / Trade-offs

- **Schema lock-in**: Nếu sau này cần fee per-contract, cần migrate. Acceptable cho v0.3.
- **Override amount complexity**: Chỉ số thực, không phải percentage — đủ cho v0.3.
