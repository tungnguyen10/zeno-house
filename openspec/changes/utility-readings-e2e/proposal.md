## Why

v0.3 mở đầu Financial Core. Để sinh hóa đơn điện nước chính xác, hệ thống cần lưu chỉ số đồng hồ theo kỳ trước khi build bất kỳ logic billing nào. Đây là building block đầu tiên: ghi số, lưu lịch sử, tính consumption theo kỳ.

## What Changes

- Thêm bảng `utility_readings` vào database
- API CRUD cơ bản: create reading, list by room, get latest
- Validator: số mới không được nhỏ hơn số cũ của cùng utility type
- UI: panel nhập chỉ số trong Room detail page, lịch sử theo kỳ
- Tính consumption tự động (current - previous reading)

## Capabilities

### New Capabilities

- `utility-readings-database`: Schema `utility_readings`, RLS policies
- `utility-readings-api`: CRUD endpoints cho utility readings
- `utility-readings-client`: UI panel trong room detail + history list

### Modified Capabilities

- `rooms-client`: Thêm Utility Readings panel vào Room detail page

## Impact

- `supabase/migrations/` — migration mới cho `utility_readings`
- `app/types/database.types.ts` — regenerate sau migration
- `server/api/utility-readings/` — 3 endpoints
- `server/services/utility-readings/` — business logic (validate no regression)
- `server/repositories/utility-readings/` — Supabase queries
- `app/types/utility-readings.ts` — DTO types
- `app/utils/validators/utility-readings.ts` — Zod schema
- `app/composables/rooms/useUtilityReadings.ts` — fetch + submit
- `app/components/rooms/RoomUtilityPanel.vue` — UI component
- `app/pages/rooms/[id]/index.vue` — thêm panel
