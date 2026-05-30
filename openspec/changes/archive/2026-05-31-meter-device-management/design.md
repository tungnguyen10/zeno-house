## Context

Bảng `meter_devices` đã tồn tại từ migration v0.2.5 với các field: `id, building_id, room_id, meter_type, meter_code, start_reading, end_reading, installed_at, removed_at, status, notes`. Bảng `meter_readings` đã có từ change `meter-readings` với field `reading_type IN ('monthly', 'handover_in', 'handover_out')`.

Hiện tại không có API nào cho `meter_devices`, và flow bàn giao bị thiếu hoàn toàn: người dùng tạo hợp đồng nhưng không có cách nhập số điện/nước đầu vào.

## Goals / Non-Goals

**Goals:**
- CRUD API cho `meter_devices` (list, create, update, deactivate)
- UI quản lý thiết bị trong trang phòng
- UI nhập/xem số bàn giao (handover_in / handover_out) trong trang hợp đồng
- Trang nhập chỉ số hàng tháng hoạt động được sau khi có device

**Non-Goals:**
- Tự động trigger handover reading khi tạo/kết thúc hợp đồng (manual entry, theo design D7 của meter-readings)
- Quản lý lịch sử thay thiết bị phức tạp (replaced/broken) — chỉ cần active/inactive

## Decisions

**D1 — Không cần migration mới**
Bảng `meter_devices` đã đủ field. Không cần ALTER TABLE. Chỉ cần thêm API + UI.

**D2 — Deactivate thay vì delete**
Xoá thiết bị sẽ cascade-delete `meter_readings` (FK). Thay vào đó dùng `PATCH /api/meter-devices/:id` với `{ status: 'inactive' }` để ẩn thiết bị mà giữ lịch sử đọc.

**D3 — Handover readings gắn vào contract detail page**
Không tạo page riêng. Section "Số bàn giao" nằm trong tab/section của trang chi tiết hợp đồng. Hiện có `ContractServicesTab` → thêm `ContractHandoverReadings` component tương tự.

**D4 — Thiết bị hiện theo phòng, không theo tòa nhà**
API filter chính là `room_id`. Trang phòng hiện danh sách thiết bị của phòng đó. Trang nhập chỉ số hàng tháng (đã có) query devices theo `building_id` qua repository.

**D5 — `start_reading` trên device = số đồng hồ lúc lắp, KHÔNG phải handover_in**
Handover readings là `meter_readings` rows với `reading_type = 'handover_in'/'handover_out'`. `start_reading` trên device chỉ là reference, không dùng để tính tiêu thụ.

## Risks / Trade-offs

- **RLS trên `meter_devices`**: Migration v0.2.5 đã có policies cho admin (all) và manager (select). Manager không write được — cần kiểm tra lại nếu manager cần nhập số.
- **Trang nhập chỉ số vẫn trống nếu phòng không có hợp đồng active**: Repository lọc `rooms.status = 'occupied'` — nếu phòng chưa có contract active thì không hiện. Đây là behavior đúng.
