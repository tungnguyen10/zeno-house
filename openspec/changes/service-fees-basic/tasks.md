## 1. Database

- [ ] 1.1 Tạo migration cho `service_fee_definitions` + `room_service_fees` — columns, FK, RLS, triggers
- [ ] 1.2 Regenerate `app/types/database.types.ts`

## 2. Types & Validators

- [ ] 2.1 Tạo `app/types/service-fees.ts` — ServiceFeeDefinition, RoomServiceFee, RoomServiceFeeWithEffectiveAmount
- [ ] 2.2 Tạo `app/utils/validators/service-fees.ts` — createFeeSchema, updateFeeSchema, assignFeeSchema
- [ ] 2.3 Tạo `app/utils/mappers/service-fees.ts` — mappers cho cả 2 tables

## 3. Server

- [ ] 3.1 Tạo `server/repositories/service-fees/index.ts` — CRUD cho definitions + assignments, effective_amount
- [ ] 3.2 Tạo `server/services/service-fees/index.ts` — business logic + permission checks
- [ ] 3.3 Tạo `server/api/service-fees/index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`
- [ ] 3.4 Tạo `server/api/room-service-fees/index.get.ts`, `index.post.ts`, `[id].delete.ts`
- [ ] 3.5 Thêm `service-fees.*` capabilities vào `server/utils/permissions.ts`

## 4. Client

- [ ] 4.1 Tạo `app/composables/service-fees/useServiceFeeList.ts`, `useRoomServiceFees.ts`
- [ ] 4.2 Tạo `app/pages/service-fees/index.vue` — catalog list với CRUD
- [ ] 4.3 Tạo `app/components/rooms/RoomServiceFeesSection.vue` — list + add/remove
- [ ] 4.4 Cập nhật `app/pages/rooms/[id]/index.vue` — thêm `<RoomServiceFeesSection>`
- [ ] 4.5 Cập nhật AppSidebar — thêm link "Phí dịch vụ" → `/service-fees`

## 5. Verify

- [ ] 5.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 5.2 Test thủ công: tạo fee → gán vào phòng → xem effective amount đúng
