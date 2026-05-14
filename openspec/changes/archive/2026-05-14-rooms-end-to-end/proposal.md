## Why

`Buildings` đã hoàn chỉnh nhưng không có nghĩa gì nếu admin không quản lý được các phòng bên trong. `Rooms` là domain vận hành thật đầu tiên — nơi admin tạo phòng, theo dõi trạng thái, và chuẩn bị cho room assignment sau này.

## What Changes

- Tạo `rooms` table trong database với FK tới `buildings`
- CRUD API cho rooms (`GET /api/rooms`, `POST`, `GET /:id`, `PATCH /:id`, `DELETE /:id`)
- Room list page với filter theo building, status, floor
- Room detail page hiển thị thông tin + occupancy status
- Create/Edit room form với validation
- RLS policies tương tự buildings (admin full, manager read-only)

## Capabilities

### New Capabilities

- `rooms-database`: schema rooms table, FK buildings, RLS policies, trigger updated_at
- `rooms-api`: server API endpoints + service + repository
- `rooms-client`: composables, pages, components phía client

### Modified Capabilities

_(không có thay đổi requirements ở capabilities hiện tại)_

## Impact

- `supabase/migrations/` — migration mới tạo rooms table
- `app/types/database.types.ts` — regenerate sau migration
- `server/api/rooms/`, `server/services/rooms/`, `server/repositories/rooms/` — implement
- `app/pages/rooms/` — tạo mới
- `app/components/rooms/` — tạo mới
- `app/composables/rooms/` — tạo mới
- `app/utils/validators/rooms.ts` — tạo mới
- `app/utils/mappers/rooms.ts` — tạo mới
- `app/utils/constants/navigation.ts` — icon rooms đã có sẵn
