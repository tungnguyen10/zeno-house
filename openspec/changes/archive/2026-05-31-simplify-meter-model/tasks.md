## 1. Migration

- [x] 1.1 Tạo migration file `20260530400000_simplify_meter_readings.sql`: DROP UNIQUE cũ, ADD UNIQUE `(room_id, meter_type, period_year, period_month, reading_type)`, DROP COLUMN `meter_device_id`, DROP TABLE `meter_devices`

## 2. Types & DB Types

- [x] 2.1 Xóa `meter_devices` block khỏi `app/types/database.types.ts`
- [x] 2.2 Sửa `meter_readings` block trong `database.types.ts` — xóa `meter_device_id` khỏi Row/Insert/Update
- [x] 2.3 Sửa `app/types/meter-readings.ts` — xóa `meterDeviceId` khỏi `MeterReading`, xóa `meter_device_id` khỏi `BulkReadingInput`, thêm `room_id` và `meter_type` vào `BulkReadingInput`
- [x] 2.4 Xóa `app/utils/validators/meter-devices.ts`
- [x] 2.5 Sửa `app/utils/validators/meter-readings.ts` — thêm `room_id`, `meter_type` vào `meterReadingCreateSchema`, xóa `meter_device_id`

## 3. Mapper

- [x] 3.1 Sửa `app/utils/mappers/meter-readings.ts` — xóa `meterDeviceId` field
- [x] 3.2 Xóa `app/utils/mappers/meter-devices.ts` (kiểm tra không còn import nào)

## 4. Server Repository

- [x] 4.1 Xóa `server/repositories/meter-devices/index.ts`
- [x] 4.2 Sửa `server/repositories/meter-readings/index.ts`:
  - `create()`: nhận `room_id, building_id, meter_type` thay vì `meter_device_id`
  - `bulkUpsert()`: đổi `onConflict` thành `'room_id,meter_type,period_year,period_month,reading_type'`
  - `findBuildingRoomsStatus()`: không query `meter_devices`, thay vào đó return cứng 2 meterType per room

## 5. Server Service & API

- [x] 5.1 Xóa `server/services/meter-devices/index.ts`
- [x] 5.2 Xóa `server/api/meter-devices/index.get.ts`, `index.post.ts`, `[id].patch.ts`
- [x] 5.3 Sửa `server/services/meter-readings/index.ts` — `create()` và `bulkCreate()` không inject `meter_device_id`
- [x] 5.4 Sửa `server/api/meter-readings/index.post.ts` — validate `room_id, meter_type` thay vì `meter_device_id`
- [x] 5.5 Sửa `server/api/meter-readings/bulk.post.ts` — validate schema mới
- [x] 5.6 Sửa `server/utils/permissions.ts` — xóa `meter-devices.read/write`

## 6. Composables & Components

- [x] 6.1 Xóa `app/composables/rooms/useRoomMeterDevices.ts`
- [x] 6.2 Rewrite `app/composables/contracts/useContractHandoverReadings.ts` — không fetch devices, trực tiếp save reading với `room_id + meter_type`
- [x] 6.3 Rewrite `app/components/contracts/ContractHandoverReadings.vue` — luôn hiện 2 rows điện/nước, không phụ thuộc devices
- [x] 6.4 Xóa `app/components/rooms/RoomMeterDevices.vue`
- [x] 6.5 Sửa `app/pages/rooms/[id]/index.vue` — xóa section "Thiết bị đồng hồ"
- [x] 6.6 Sửa `app/composables/buildings/useBuildingMeterReadings.ts` — `RoomMeterStatus.devices[]` → `RoomMeterStatus.meters[]` với shape mới
- [x] 6.7 Sửa `app/components/buildings/MeterReadingBulkInput.vue` — dùng shape mới

## 7. Typecheck & Cleanup

- [x] 7.1 Chạy `npm run typecheck` — 0 errors
- [x] 7.2 Xóa `server/services/rooms/index.ts` auto-create devices logic
