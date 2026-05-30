## Context

`meter_devices` đã được tạo trong F0.2.5.5 để track lifecycle đồng hồ điện/nước (lắp đặt, thay thế, tháo dỡ). Nhưng chưa có bảng lưu **chỉ số đọc hàng tháng** — dữ liệu thực tế admin đọc từ đồng hồ. Billing engine (v0.3) cần bảng này để tính:

```
consumption = reading_tháng_N - reading_tháng_N-1
tiền điện = consumption × electricity_rate
```

Không có `meter_readings` thì v0.3 không thể implement billing.

## Goals / Non-goals

**Goals:**
- Bảng `meter_readings` lưu chỉ số đọc theo kỳ per device
- 3 loại reading: `monthly`, `handover_in`, `handover_out`
- Bulk input UI per building: 1 kỳ, tất cả phòng active
- Room detail hiển thị lịch sử readings
- Billing engine (v0.3) có thể resolve consumption từ bảng này

**Non-goals:**
- Tính bill trong change này
- Photo capture / OCR
- IoT auto-reading
- `per_kwh` / `per_m3` rate calculation (thuộc service-definitions hoặc billing)
- Meter device management UI (đã có)

## Decisions

**D1 — Denorm `room_id` và `building_id` trong meter_readings**

Query phổ biến nhất là "tất cả readings của building X trong kỳ Y" — cần `building_id` để không phải JOIN qua meter_devices → rooms → buildings. Denorm hợp lý vì room/building không đổi sau khi gán device.

**D2 — UNIQUE constraint: `(meter_device_id, period_year, period_month, reading_type)`**

Đảm bảo mỗi device chỉ có 1 reading per kỳ per loại. `handover_in` và `handover_out` cùng 1 tháng là hợp lệ (phòng có người ra và người vào trong cùng tháng).

**D3 — `reading_type` có 3 values: `monthly` | `handover_in` | `handover_out`**

- `monthly`: đọc định kỳ cuối tháng
- `handover_in`: đọc khi bắt đầu HĐ mới (người vào)
- `handover_out`: đọc khi kết thúc HĐ (người ra)

Billing engine ưu tiên handover values khi có; fallback về monthly nếu không có handover.

**D4 — Bulk input page là `/buildings/:id/meter-readings`, không phải modal**

Đủ phức tạp để cần trang riêng. Trang này: chọn kỳ tháng/năm → load tất cả phòng có active contract + có meter device active → hiển thị input per phòng per loại đồng hồ.

**D5 — `consumption` không lưu trong DB — tính runtime**

Tránh inconsistency khi admin sửa reading. Service layer tính consumption khi cần (gen bill, xem lịch sử). DB chỉ lưu raw `reading_value`.

**D6 — Bulk save: `POST /api/meter-readings/bulk` nhận array**

Một lần submit toàn bộ kỳ. Server upsert (ON CONFLICT UPDATE) để admin có thể sửa và submit lại.

**D7 — Handover readings trigger từ Contract terminate/create flow**

Khi HĐ bắt đầu (`ContractService.create`): sau khi tạo contract → chuyển hướng về room detail để admin đọc và nhập `handover_in` reading thủ công (không auto). Tương tự khi terminate: chuyển về room detail. Không inject vào contract flow để tránh force mandatory.

## Files bị thêm

```
supabase/migrations/20260530300000_meter_readings.sql

server/repositories/meter-readings/index.ts
server/services/meter-readings/index.ts
server/api/meter-readings/index.get.ts       ← GET /api/meter-readings?room_id=&period_year=&period_month=
server/api/meter-readings/index.post.ts      ← POST /api/meter-readings (single)
server/api/meter-readings/[id].patch.ts      ← PATCH /api/meter-readings/:id
server/api/meter-readings/bulk.get.ts        ← GET /api/meter-readings/bulk?building_id=&period_year=&period_month=
server/api/meter-readings/bulk.post.ts       ← POST /api/meter-readings/bulk

app/utils/validators/meter-readings.ts
app/utils/mappers/meter-readings.ts
app/types/meter-readings.ts
app/composables/rooms/useMeterReadings.ts
app/composables/buildings/useBuildingMeterReadings.ts
app/components/rooms/RoomMeterReadings.vue    ← lịch sử readings trong room detail
app/components/buildings/MeterReadingBulkInput.vue  ← table nhập chỉ số
app/pages/buildings/[id]/meter-readings.vue  ← trang bulk input
```

## Files bị sửa

```
app/pages/rooms/[id]/index.vue               ← thêm section lịch sử chỉ số
app/pages/buildings/[id]/index.vue           ← thêm action "Nhập chỉ số tháng X"
app/types/database.types.ts                  ← thêm meter_readings table
server/utils/permissions.ts                  ← thêm meter-readings capabilities
```

## Data Model

```sql
CREATE TABLE public.meter_readings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_device_id uuid NOT NULL REFERENCES meter_devices(id) ON DELETE RESTRICT,
  room_id         uuid NOT NULL REFERENCES rooms(id),          -- denorm
  building_id     uuid NOT NULL REFERENCES buildings(id),      -- denorm
  meter_type      text NOT NULL CHECK (meter_type IN ('electricity','water')),  -- denorm từ device
  reading_type    text NOT NULL CHECK (reading_type IN ('monthly','handover_in','handover_out')),
  period_year     integer NOT NULL,
  period_month    integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  reading_date    date NOT NULL,
  reading_value   numeric(12,3) NOT NULL CHECK (reading_value >= 0),
  is_estimated    boolean NOT NULL DEFAULT false,
  notes           text,
  recorded_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE (meter_device_id, period_year, period_month, reading_type)
);

CREATE INDEX idx_meter_readings_building_period ON meter_readings (building_id, period_year, period_month);
CREATE INDEX idx_meter_readings_room ON meter_readings (room_id, period_year, period_month);
```

## Bulk Input UI Flow

```
/buildings/:id/meter-readings
  │
  ├─ Header: chọn kỳ (tháng/năm), default = tháng hiện tại
  ├─ GET /api/meter-readings/bulk?building_id=X&period_year=Y&period_month=M
  │    └─ Server trả về: [{ room, device(s), existingReading | null }]
  │
  ├─ Table: mỗi row là 1 phòng
  │    columns: Phòng | Loại | Chỉ số kỳ trước | Chỉ số mới (input) | Tiêu thụ (computed) | Ngày đọc | Ghi chú
  │
  └─ Button "Lưu tất cả" → POST /api/meter-readings/bulk
       payload: [{ meter_device_id, period_year, period_month, reading_type:'monthly', reading_date, reading_value, notes }]
```

## Billing Resolution Logic (cho v0.3 reference)

```
consumption(room, month, year, type):
  1. device = meter_devices WHERE room_id = room AND type = type AND status = 'active'
  2. current = meter_readings WHERE device.id AND period_year = year AND period_month = month
               ORDER BY reading_type → ưu tiên handover_out > monthly
  3. prev = meter_readings WHERE device.id AND period trước đó
               → kiểm tra handover_in trước (HĐ mới), sau đó monthly
  4. consumption = current.reading_value - prev.reading_value
```
