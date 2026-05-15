## 1. Database

- [ ] 1.1 Tạo migration `supabase/migrations/<timestamp>_create_utility_readings.sql` — bảng `utility_readings`, index, RLS (admin all, manager select), trigger `set_updated_at`
- [ ] 1.2 Regenerate `app/types/database.types.ts` từ Supabase

## 2. Types & Validators

- [ ] 2.1 Tạo `app/types/utility-readings.ts` — interfaces `UtilityReading`, `UtilityReadingWithConsumption`
- [ ] 2.2 Tạo `app/utils/validators/utility-readings.ts` — Zod schema `createReadingSchema`
- [ ] 2.3 Tạo `app/utils/mappers/utility-readings.ts` — `mapUtilityReading(row)` → camelCase DTO

## 3. Server

- [ ] 3.1 Tạo `server/repositories/utility-readings/index.ts` — `findLatest(event, roomId, type)`, `findByRoom(event, roomId, type?, limit)`, `insert(event, data)`
- [ ] 3.2 Tạo `server/services/utility-readings/index.ts` — `create` (validate no-regression → 409), `listByRoom`, `getLatest`; permission checks
- [ ] 3.3 Tạo `server/api/utility-readings/index.post.ts` — POST /api/utility-readings
- [ ] 3.4 Tạo `server/api/utility-readings/index.get.ts` — GET /api/utility-readings?roomId&type&limit
- [ ] 3.5 Tạo `server/api/utility-readings/latest.get.ts` — GET /api/utility-readings/latest?roomId&type
- [ ] 3.6 Thêm `utility-readings.read/create` vào `server/utils/permissions.ts` cho admin + manager

## 4. Client

- [ ] 4.1 Tạo `app/composables/rooms/useUtilityReadings.ts` — fetch list + latest, expose `submit(input)`
- [ ] 4.2 Tạo `app/components/rooms/RoomReadingModal.vue` — form nhập chỉ số (type, value, date, notes), hiện previous value, handle 409
- [ ] 4.3 Tạo `app/components/rooms/RoomUtilityPanel.vue` — 2 sections (Điện / Nước), latest + history table (5 rows), nút "Ghi chỉ số"
- [ ] 4.4 Cập nhật `app/pages/rooms/[id]/index.vue` — thêm `<RoomUtilityPanel>`

## 5. Verify

- [ ] 5.1 Chạy `npm run lint && npm run typecheck` — 0 errors
- [ ] 5.2 Test thủ công: ghi chỉ số điện → history cập nhật → ghi số nhỏ hơn → bị reject
