## Why

`meter_devices` là một abstraction thừa. Để ghi nhận số điện/nước của một phòng, chỉ cần biết `room_id + meter_type + period + reading_type`. Việc track device-level (serial number, lịch sử thay thiết bị) không phải use case thực tế — khi thay đồng hồ, user chỉ cần nhập số đầu mới, không cần biết đó là "thiết bị thứ mấy". Hiện tại mỗi operation đều phải `ensureDevice()` trước rồi mới lưu reading được — phức tạp không cần thiết.

## What Changes

- **REMOVED**: Bảng `meter_devices`, tất cả API/service/repository/composable/component liên quan
- **MODIFIED**: Bảng `meter_readings` — drop cột `meter_device_id` (NOT NULL FK), đổi UNIQUE constraint thành `(room_id, meter_type, period_year, period_month, reading_type)`
- **MODIFIED**: `ContractHandoverReadings` — không cần fetch devices, trực tiếp POST reading với `room_id + meter_type`
- **MODIFIED**: `useBuildingMeterReadings` / bulk input page — query theo `building_id` trực tiếp, không qua devices
- **REMOVED**: Auto-create devices trong `RoomService.create()`
- **REMOVED**: Section "Thiết bị đồng hồ" khỏi trang chi tiết phòng
- **REMOVED**: `RoomMeterDevices` component

## Capabilities

### New Capabilities

_(không có)_

### Modified Capabilities

- `meter-readings-api`: UNIQUE constraint thay đổi, `meter_device_id` không còn required
- `meter-devices-client`: Toàn bộ capability bị xóa
- `rooms-client`: Xóa section thiết bị đồng hồ
- `contracts-client`: `ContractHandoverReadings` không còn phụ thuộc vào devices

## Impact

- **Migration**: DROP COLUMN `meter_device_id`, thêm UNIQUE mới, DROP TABLE `meter_devices`
- **server/api/meter-devices/**: xóa 3 files
- **server/services/meter-devices/**: xóa
- **server/repositories/meter-devices/**: xóa
- **server/api/meter-readings/**: sửa bulk endpoint (không cần resolve device)
- **server/services/meter-readings/**: sửa create/bulk — không inject `meter_device_id`
- **server/repositories/meter-readings/**: sửa insert/upsert
- **app/composables/rooms/useRoomMeterDevices.ts**: xóa
- **app/composables/contracts/useContractHandoverReadings.ts**: đơn giản lại
- **app/components/rooms/RoomMeterDevices.vue**: xóa
- **app/components/contracts/ContractHandoverReadings.vue**: rewrite
- **app/pages/rooms/[id]/index.vue**: xóa section thiết bị
- **app/types/database.types.ts**: xóa `meter_devices` block, sửa `meter_readings`
- **app/utils/validators/meter-devices.ts**: xóa
- **app/utils/mappers/meter-devices.ts**: xóa (hoặc giữ nếu còn dùng ở chỗ khác)
