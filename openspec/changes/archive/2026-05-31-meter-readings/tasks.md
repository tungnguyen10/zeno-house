## 1. Database

- [x] 1.1 Viết `supabase/migrations/20260530300000_meter_readings.sql`:
  - Tạo bảng `meter_readings` với tất cả columns và constraints
  - UNIQUE `(meter_device_id, period_year, period_month, reading_type)`
  - Index: `(building_id, period_year, period_month)` và `(room_id, period_year, period_month)`
- [x] 1.2 Apply migration lên Supabase

## 2. Types & Mapper

- [x] 2.1 Sửa `app/types/database.types.ts` — thêm `meter_readings` block (Row/Insert/Update/Relationships)

- [x] 2.2 Tạo `app/types/meter-readings.ts`:
  ```ts
  export interface MeterReading {
    id: string
    meterDeviceId: string
    roomId: string
    buildingId: string
    meterType: 'electricity' | 'water'
    readingType: 'monthly' | 'handover_in' | 'handover_out'
    periodYear: number
    periodMonth: number
    readingDate: string
    readingValue: number
    isEstimated: boolean
    notes: string | null
    recordedBy: string | null
    createdAt: string
    updatedAt: string
  }

  export interface BulkReadingInput {
    meter_device_id: string
    period_year: number
    period_month: number
    reading_type: 'monthly' | 'handover_in' | 'handover_out'
    reading_date: string
    reading_value: number
    notes?: string | null
  }

  export interface RoomMeterStatus {
    roomId: string
    roomNumber: string
    floor: number
    devices: {
      device: MeterDevice   // from meter-devices.ts
      existingReading: MeterReading | null
      previousReading: MeterReading | null
    }[]
  }
  ```

- [x] 2.3 Tạo `app/utils/mappers/meter-readings.ts` — `mapMeterReading(row): MeterReading`

## 3. Validator

- [x] 3.1 Tạo `app/utils/validators/meter-readings.ts`:
  ```ts
  export const meterReadingCreateSchema = z.object({
    meter_device_id: z.string().uuid(),
    period_year: z.number().int().min(2000).max(2100),
    period_month: z.number().int().min(1).max(12),
    reading_type: z.enum(['monthly','handover_in','handover_out']),
    reading_date: z.string(),     // ISO date
    reading_value: z.number().min(0),
    is_estimated: z.boolean().optional(),
    notes: z.string().max(300).nullable().optional(),
  })

  export const meterReadingBulkSchema = z.object({
    readings: z.array(meterReadingCreateSchema).min(1),
  })

  export const meterReadingUpdateSchema = meterReadingCreateSchema.partial().omit({ meter_device_id: true })
  ```

## 4. Server — Repository

- [x] 4.1 Tạo `server/repositories/meter-readings/index.ts`:
  - `findByRoom(event, roomId, filters?)` → readings của 1 phòng, order by period DESC
  - `findByBuilding(event, buildingId, periodYear, periodMonth)` → tất cả readings của building trong kỳ + previous period (cho tính consumption)
  - `findBuildingRoomsStatus(event, buildingId, periodYear, periodMonth)` → list rooms có active contract + active devices + reading hiện tại (nếu có)
  - `create(event, data)` → INSERT 1 reading
  - `bulkUpsert(event, readings[])` → INSERT ... ON CONFLICT (meter_device_id, period_year, period_month, reading_type) DO UPDATE
  - `update(event, id, data)` → UPDATE

## 5. Server — Service

- [x] 5.1 Tạo `server/services/meter-readings/index.ts`:
  - `list(event, filters)` → gọi repository
  - `getBuildingStatus(event, buildingId, year, month)` → gọi `findBuildingRoomsStatus`
  - `create(event, input, userId)` → validate + insert
  - `bulkCreate(event, inputs[], userId)` → validate + bulkUpsert, inject `recorded_by = userId`
  - `update(event, id, data)` → validate + update

## 6. Server — API Endpoints

- [x] 6.1 Tạo `server/api/meter-readings/index.get.ts` — GET /api/meter-readings
  - Query params: `room_id?`, `building_id?`, `period_year?`, `period_month?`, `meter_type?`
  - Auth: authenticated, permission `meter-readings.read`

- [x] 6.2 Tạo `server/api/meter-readings/index.post.ts` — POST /api/meter-readings
  - Body: `meterReadingCreateSchema`
  - Auth: admin/manager, permission `meter-readings.write`

- [x] 6.3 Tạo `server/api/meter-readings/[id].patch.ts` — PATCH /api/meter-readings/:id
  - Body: `meterReadingUpdateSchema`
  - Auth: admin/manager

- [x] 6.4 Tạo `server/api/meter-readings/bulk.get.ts` — GET /api/meter-readings/bulk
  - Query params: `building_id` (required), `period_year`, `period_month`
  - Trả về `RoomMeterStatus[]`
  - Auth: admin/manager

- [x] 6.5 Tạo `server/api/meter-readings/bulk.post.ts` — POST /api/meter-readings/bulk
  - Body: `meterReadingBulkSchema`
  - Auth: admin/manager

- [x] 6.6 Sửa `server/utils/permissions.ts` — thêm `meter-readings.read`, `meter-readings.write` vào admin và manager sets

## 7. Client — Composables

- [x] 7.1 Tạo `app/composables/rooms/useMeterReadings.ts`:
  - `useFetch('/api/meter-readings?room_id=...')`
  - `createReading(data)` → `$fetch POST`

- [x] 7.2 Tạo `app/composables/buildings/useBuildingMeterReadings.ts`:
  - `fetchBuildingStatus(buildingId, year, month)` → GET /api/meter-readings/bulk
  - `saveBulk(readings[])` → POST /api/meter-readings/bulk
  - State: `isSaving`, `savedCount`, `errors[]`

## 8. Client — Components

- [x] 8.1 Tạo `app/components/rooms/RoomMeterReadings.vue`:
  - Nhận `roomId` prop
  - Dùng `useMeterReadings(roomId)`
  - Hiển thị bảng lịch sử: Kỳ | Loại ĐH | Chỉ số | Ngày đọc | Loại reading | Ghi chú
  - Group by meter_type (Điện / Nước)

- [x] 8.2 Tạo `app/components/buildings/MeterReadingBulkInput.vue`:
  - Nhận `buildingId`, `periodYear`, `periodMonth` props
  - Hiển thị table: Phòng | Loại | Chỉ số tháng trước | Chỉ số mới | Tiêu thụ | Ngày đọc | Ghi chú
  - "Tiêu thụ" là computed = input - previous (real-time)
  - Emit `save(readings[])` khi nhấn "Lưu tất cả"
  - Highlight phòng chưa nhập chỉ số (existingReading === null)

## 9. Client — Pages

- [x] 9.1 Tạo `app/pages/buildings/[id]/meter-readings.vue`:
  - Header: tên building + month/year picker (default = tháng hiện tại)
  - Chứa `<MeterReadingBulkInput>`
  - Khi `save` event: gọi `useBuildingMeterReadings.saveBulk()` → hiển thị success/error summary

- [x] 9.2 Sửa `app/pages/rooms/[id]/index.vue` — thêm section "Lịch sử chỉ số":
  - Chứa `<RoomMeterReadings :room-id="id">`
  - Đặt bên dưới section thông tin phòng

- [x] 9.3 Sửa `app/pages/buildings/[id]/index.vue` — thêm action button/link:
  - "Nhập chỉ số tháng X" → navigateTo(`/buildings/${id}/meter-readings`)
  - X = tháng hiện tại (computed)

## 10. Verify

- [x] 10.1 Chạy `npm run typecheck` — 0 errors
- [x] 10.2 Chạy `npm run lint` — 0 errors
- [x] 10.3 Test: GET /api/meter-readings/bulk?building_id=X → trả về danh sách phòng
- [x] 10.4 Test: Bulk input page → nhập chỉ số 2 phòng → lưu → reload → hiện đúng giá trị
- [x] 10.5 Test: Upsert — submit lại cùng kỳ → không tạo duplicate, UPDATE existing
- [x] 10.6 Test: Room detail → hiển thị section lịch sử chỉ số đúng
- [x] 10.7 Test: PATCH /api/meter-readings/:id → sửa reading nhập nhầm → ok
- [x] 10.8 Test: POST reading loại `handover_in` cho phòng vừa tạo HĐ → thành công
