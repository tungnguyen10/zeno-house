## Why

Để sinh hóa đơn có các dòng phí dịch vụ (internet, rác, phí quản lý...), cần có danh mục phí cấu hình sẵn. Đây là bước chuẩn bị dữ liệu trước khi build generate invoice.

## What Changes

- Thêm bảng `service_fee_definitions` — danh mục phí toàn hệ thống
- Thêm bảng `room_service_fees` — gán phí cho từng phòng (có thể override amount)
- API CRUD cho fee definitions và room assignments
- UI: trang danh mục phí + gán phí vào phòng từ room detail

## Capabilities

### New Capabilities

- `service-fees-database`: Schema `service_fee_definitions`, `room_service_fees`, RLS
- `service-fees-api`: CRUD endpoints cho definitions và room assignments
- `service-fees-client`: UI quản lý phí + gán phí trong room detail

### Modified Capabilities

- `rooms-client`: Thêm "Phí dịch vụ" section trong Room detail page

## Impact

- `supabase/migrations/` — migration cho 2 bảng mới
- `app/types/service-fees.ts` — DTO types
- `app/utils/validators/service-fees.ts` — Zod schemas
- `server/api/service-fees/` — CRUD endpoints
- `server/services/service-fees/` — business logic
- `server/repositories/service-fees/` — queries
- `app/composables/service-fees/` — client composables
- `app/pages/service-fees/` — danh mục phí page
- `app/pages/rooms/[id]/index.vue` — thêm fee section
