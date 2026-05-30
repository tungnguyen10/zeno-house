## Why

Hệ thống đã có `meter_devices` để track lifecycle của đồng hồ điện/nước theo phòng. Nhưng chưa có nơi lưu **chỉ số đọc định kỳ** — dữ liệu thực tế admin đọc hàng tháng. Không có bảng này thì billing engine (v0.3) không thể tính tiền điện/nước vì không biết consumption từng kỳ.

## What Changes

- Tạo bảng `meter_readings` — lưu chỉ số đọc theo kỳ (tháng/năm) per meter device
- Có 2 loại reading: `monthly` (đọc định kỳ hàng tháng) và `handover` (đọc khi bàn giao phòng — vào/ra)
- UI chính: **Bulk input per building** — 1 trang nhập chỉ số tất cả phòng active trong 1 tòa nhà cho 1 kỳ
- UI phụ: Room detail hiển thị lịch sử readings của phòng đó

## Non-goals

- Không tính bill trong change này — chỉ lưu raw readings
- Không có photo capture (chụp ảnh đồng hồ) — scope sau
- Không tự động tính consumption trong DB — để service layer tính khi generate bill
- Không link FK trực tiếp với contract — billing engine resolve qua room_id + date range

## Reading Type & Handover Flow

Khi terminate HĐ: admin nhập reading `handover_out` → lưu vào meter_readings  
Khi tạo HĐ mới (bàn giao): admin nhập reading `handover_in` → lưu vào meter_readings  
Hàng tháng: admin vào bulk input → chọn kỳ tháng/năm → nhập chỉ số tất cả phòng → save

## Capabilities

### New Capabilities
- `meter-readings-database`: Bảng `meter_readings` với FK về meter_devices, indexes
- `meter-readings-api`:
  - `GET /api/meter-readings?room_id=&period_year=&period_month=` — lịch sử readings của phòng
  - `GET /api/meter-readings/bulk?building_id=&period_year=&period_month=` — tất cả phòng trong building cho 1 kỳ
  - `POST /api/meter-readings/bulk` — nhập nhiều readings cùng lúc cho 1 building/kỳ
  - `POST /api/meter-readings` — nhập 1 reading đơn lẻ (handover)
  - `PATCH /api/meter-readings/:id` — sửa reading (nếu nhập nhầm)

### Modified Capabilities
- `rooms-client`: Room detail page thêm section "Lịch sử chỉ số" (danh sách readings)
- `buildings-client`: Building detail page thêm action "Nhập chỉ số tháng X" → navigate tới bulk input page

### New Pages
- `/buildings/:id/meter-readings` — bulk input page: chọn kỳ, list phòng active, nhập chỉ số điện/nước

## Data Model

```
meter_readings
  id                uuid PK
  meter_device_id   uuid FK → meter_devices(id)
  room_id           uuid FK → rooms(id)          (denorm, fast query)
  building_id       uuid FK → buildings(id)       (denorm, fast query)
  meter_type        'electricity' | 'water'       (denorm từ device)
  reading_type      'monthly' | 'handover_in' | 'handover_out'
  period_year       integer NOT NULL
  period_month      integer NOT NULL (1-12)
  reading_date      date NOT NULL
  reading_value     numeric(12,3) NOT NULL
  is_estimated      boolean default false
  notes             text
  recorded_by       uuid FK → auth.users(id)
  created_at / updated_at

UNIQUE: (meter_device_id, period_year, period_month, reading_type)
  → 1 reading per device per kỳ per type
```

## Billing Integration (v0.3 sẽ dùng)

```
Consumption tháng 6 phòng 101:
  1. Lấy active meter_devices của room_id, type='electricity'
  2. Lấy reading tháng 6 (monthly hoặc handover_out)
  3. Lấy reading kỳ trước (tháng 5 hoặc handover_in của HĐ hiện tại)
  4. consumption = reading_value(6) - reading_value(5)
  5. × electricity_rate → tiền điện
```

## Impact

- **DB**: 1 migration mới
- **Server**: repository + service + 5 API endpoints
- **Client**: 1 trang mới (bulk input), sửa room detail, sửa building detail
- **Không có breaking change** với data hiện tại
