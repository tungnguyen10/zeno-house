## 1. Types & Validators

- [x] 1.1 Thêm `MeterDevice` interface vào `app/types/meter-devices.ts` (kiểm tra đã có chưa, bổ sung nếu thiếu field)
- [x] 1.2 Tạo `app/utils/validators/meter-devices.ts` với `meterDeviceCreateSchema` và `meterDeviceUpdateSchema`
- [x] 1.3 Thêm capability `meter-devices.read` và `meter-devices.write` vào `server/utils/permissions.ts` cho admin + manager

## 2. Server Repository

- [x] 2.1 Tạo `server/repositories/meter-devices/index.ts` với: `findByRoom(event, roomId)`, `findByBuilding(event, buildingId)`, `create(event, input)`, `update(event, id, input)`
- [x] 2.2 Kiểm tra: nếu đã tồn tại active device cùng type trong phòng thì throw CONFLICT trong create

## 3. Server Service

- [x] 3.1 Tạo `server/services/meter-devices/index.ts` với: `list(event, user, roomId)`, `create(event, user, input)`, `update(event, user, id, input)` — tất cả check permission

## 4. API Endpoints

- [x] 4.1 Tạo `server/api/meter-devices/index.get.ts` — GET `/api/meter-devices?room_id=` (bắt buộc)
- [x] 4.2 Tạo `server/api/meter-devices/index.post.ts` — POST `/api/meter-devices`
- [x] 4.3 Tạo `server/api/meter-devices/[id].patch.ts` — PATCH `/api/meter-devices/:id`

## 5. Composable

- [x] 5.1 Tạo `app/composables/rooms/useRoomMeterDevices.ts` với: `devices`, `isLoading`, `addDevice(input)`, `deactivateDevice(id)`, `refresh`

## 6. Component: RoomMeterDevices

- [x] 6.1 Tạo `app/components/rooms/RoomMeterDevices.vue` nhận prop `roomId: string`
- [x] 6.2 Hiện danh sách thiết bị active với: loại (điện/nước), mã đồng hồ, số đầu, ngày lắp
- [x] 6.3 Nút "Thêm thiết bị" mở inline form: chọn loại, nhập mã, số đầu, ngày lắp
- [x] 6.4 Nút "Ngưng sử dụng" gọi deactivateDevice → set status=inactive + removed_at=today

## 7. Composable: ContractHandoverReadings

- [x] 7.1 Tạo `app/composables/contracts/useContractHandoverReadings.ts` — fetch devices cho room, fetch readings với `reading_type IN (handover_in, handover_out)` cho contract start month/end month
- [x] 7.2 Expose: `devices`, `handoverInReadings`, `handoverOutReadings`, `saveReading(deviceId, type, value, date)`, `isLoading`

## 8. Component: ContractHandoverReadings

- [x] 8.1 Tạo `app/components/contracts/ContractHandoverReadings.vue` nhận props `contractId, roomId, startDate, endDate?, status`
- [x] 8.2 Hiện bảng: mỗi thiết bị 1-2 rows (handover_in luôn có; handover_out chỉ khi contract terminated/expired)
- [x] 8.3 Input nhập số đồng hồ + ngày đọc, blur/enter → save
- [x] 8.4 Hiện empty state nếu không có thiết bị nào

## 9. Tích hợp vào pages

- [x] 9.1 Thêm section "Thiết bị đồng hồ" vào `app/pages/rooms/[id]/index.vue` dùng `<RoomMeterDevices :room-id="id" />`
- [x] 9.2 Thêm section "Số bàn giao" vào `app/pages/contracts/[id]/index.vue` dùng `<ContractHandoverReadings :contract-id="id" :room-id="contract.room.id" :start-date="contract.startDate" :end-date="contract.endDate" :status="contract.status" />`
