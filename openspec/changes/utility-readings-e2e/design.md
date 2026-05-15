## Context

`utility_readings` là bảng mới hoàn toàn. Cần ghi chỉ số đồng hồ điện/nước theo kỳ (tháng) cho từng phòng. Mỗi lần đọc gồm: utility type (electricity/water), reading value, reading date. Consumption tính từ 2 lần đọc liên tiếp.

**Constraint quan trọng:**
- Không cho phép nhập reading value nhỏ hơn reading gần nhất của cùng room + utility_type (đồng hồ chỉ chạy tiến, không lùi)
- Một phòng có thể có nhiều utility types (electricity và water đều cần ghi)
- Giao diện phải đủ đơn giản để admin nhập nhanh cuối tháng

## Goals / Non-Goals

**Goals:**
- Ghi chỉ số điện và nước theo phòng, theo ngày
- Xem lịch sử ghi số với consumption tính sẵn
- Validate regression (số mới ≥ số cũ)
- UI tích hợp trong Room detail page

**Non-Goals:**
- Ảnh hóa đơn / OCR đọc số tự động (v0.4+)
- Ghi chỉ số cho nhiều phòng cùng lúc (batch — v0.3.5+)
- Các utility type khác ngoài electricity và water
- Export lịch sử readings

## Decisions

**D1 — `utility_type` là enum: `electricity` | `water`**
Chỉ 2 loại phổ biến nhất cho nhà trọ VN. Giữ đơn giản, không dùng lookup table. Nếu cần thêm type sau, migrate enum.

**D2 — `reading_value` là NUMERIC(10, 2), đơn vị: kWh / m³**
Số thực để cover trường hợp có số thập phân (nước dùng fraction đơn vị). Không lưu consumption trong DB — tính ở application layer khi query.

**D3 — Consumption tính ở server, không ở client**
API trả về `consumption` đã tính (current - previous). Repository join để lấy previous reading cùng room + type có `reading_date` lớn nhất trước reading hiện tại.

**D4 — Validate no-regression ở service layer, sau đó Zod schema cho format**
Zod validate: required fields, numeric > 0, date format. Service validate: reading_value ≥ latest existing reading cho room + type. Nếu fail → 409 CONFLICT.

**D5 — Panel trong Room detail, không phải page riêng**
Room detail đã có assignment section. Thêm "Chỉ số điện nước" panel bên dưới. Panel gồm: nút "Ghi chỉ số", bảng lịch sử gần nhất (5 entries mỗi loại).

**D6 — API endpoints**
- `POST /api/utility-readings` — create new reading
- `GET /api/utility-readings?roomId=<id>&type=<type>&limit=<n>` — list by room
- `GET /api/utility-readings/latest?roomId=<id>&type=<type>` — get latest reading

## Risks / Trade-offs

- **Concurrent writes**: Nếu 2 admin ghi cùng lúc cho cùng phòng + type, validation có thể race. Acceptable cho v0.3 (single admin expected).
- **No-regression check cần query latest**: Thêm 1 query per create. Acceptable — không cần optimize ở scale này.
