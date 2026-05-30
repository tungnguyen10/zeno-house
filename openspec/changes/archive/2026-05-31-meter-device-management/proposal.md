## Why

Trang nhập chỉ số đồng hồ (`/buildings/:id/meter-readings`) hoàn toàn trống vì chưa có cách nào để gắn thiết bị điện/nước vào phòng. Bảng `meter_devices` đã có trong DB (v0.2.5) nhưng chưa có API hay UI để quản lý — người dùng không thể nhập số bàn giao khi tạo hợp đồng, không thể nhập chỉ số hàng tháng.

## What Changes

- **Thêm API CRUD** cho `meter_devices`: list theo phòng/tòa nhà, tạo, cập nhật, xoá
- **Thêm UI quản lý thiết bị** trong trang chi tiết phòng: xem danh sách thiết bị điện/nước, thêm thiết bị mới, inactive/thay thế thiết bị
- **Thêm UI nhập số bàn giao** trong trang chi tiết hợp đồng: nhập `handover_in` khi bắt đầu hợp đồng, `handover_out` khi kết thúc
- Trang nhập chỉ số hàng tháng (`/buildings/:id/meter-readings`) sẽ hoạt động sau khi có thiết bị

## Capabilities

### New Capabilities

- `meter-devices-api`: CRUD API cho thiết bị đồng hồ theo phòng
- `meter-devices-client`: UI quản lý thiết bị trong trang chi tiết phòng + nhập số bàn giao trong hợp đồng

### Modified Capabilities

- `rooms-client`: Thêm section "Thiết bị đồng hồ" vào trang chi tiết phòng
- `contracts-client`: Thêm section "Số bàn giao" vào trang chi tiết hợp đồng

## Impact

- **server/api/meter-devices/**: 4 endpoints mới
- **server/services/meter-devices/**: business logic mới
- **server/repositories/meter-devices/**: Supabase queries mới
- **app/composables/rooms/useRoomMeterDevices.ts**: composable mới
- **app/composables/contracts/useContractMeterReadings.ts**: composable mới
- **app/components/rooms/RoomMeterDevices.vue**: component mới
- **app/components/contracts/ContractHandoverReadings.vue**: component mới
- **app/pages/rooms/[id]/index.vue**: thêm section thiết bị
- **app/pages/contracts/[id]/index.vue**: thêm section bàn giao
