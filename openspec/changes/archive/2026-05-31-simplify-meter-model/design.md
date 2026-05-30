## Context

`meter_readings` hiện có `meter_device_id uuid NOT NULL REFERENCES meter_devices(id)` và UNIQUE `(meter_device_id, period_year, period_month, reading_type)`. Mọi thao tác ghi reading đều phải có device trước. `meter_devices` đã được auto-create khi tạo phòng, nhưng đây là workaround cho một design quá phức tạp.

## Goals / Non-Goals

**Goals:**
- Xóa hoàn toàn layer `meter_devices` khỏi code và DB
- `meter_readings` identify bằng `(room_id, meter_type, period_year, period_month, reading_type)`
- API/UI đơn giản: POST reading chỉ cần `room_id, meter_type, ...`

**Non-Goals:**
- Tracking lịch sử thay đồng hồ vật lý
- Serial number / mã thiết bị (nếu cần sau này có thể thêm field `device_code` optional vào `meter_readings`)

## Decisions

**D1 — Drop `meter_device_id`, không nullable**
Xóa hẳn cột, không để nullable. Không có use case nào cần biết device cụ thể.

**D2 — UNIQUE mới: `(room_id, meter_type, period_year, period_month, reading_type)`**
Đủ để upsert đúng. Bulk endpoint dùng `onConflict: 'room_id,meter_type,period_year,period_month,reading_type'`.

**D3 — DROP TABLE `meter_devices`**
Xóa hẳn, không giữ. Data hiện có trong `meter_devices` không có giá trị nghiệp vụ (auto-created với start_reading=0).

**D4 — `meter_type` đã có trong `meter_readings`**
Cột `meter_type` giữ nguyên — đủ để phân biệt điện/nước.

**D5 — Migration cần chạy trước khi deploy**
Thứ tự: thêm UNIQUE mới → drop FK constraint → drop column → drop table.

## Risks / Trade-offs

- **Data loss**: `meter_devices` bị drop — chấp nhận được vì data là auto-generated, không có giá trị nghiệp vụ
- **Existing `meter_readings` rows**: nếu có rows trong DB, cần kiểm tra không có duplicate `(room_id, meter_type, period, reading_type)` trước khi add UNIQUE constraint
