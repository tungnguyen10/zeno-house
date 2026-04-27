## 1. Database & Types

- [ ] 1.1 Add migration 003: `ALTER TABLE rooms ADD COLUMN thumbnail_url TEXT` (`rooms` table already exists from migration 001 with `id`, `building_id`, `room_number`, `floor`, `area`, `base_price`, `deposit_amount`, `max_occupants`, `status`, `description`, `created_at`, `updated_at`)
- [ ] 1.2 Verify existing RLS policies in migration 001: `rooms_admin_all`, `rooms_manager_select/insert/update/delete` (scoped via building `manager_id`)
- [ ] 1.3 Create `app/types/rooms.ts` — `Room` interface, `RoomStatus` enum, `createRoomSchema`, `updateRoomSchema`
- [ ] 1.4 Fill `i18n/locales/vi/rooms.json` + `i18n/locales/en/rooms.json` with required keys (files already exist)

## 2. API Routes

- [ ] 2.1 Create `server/api/rooms/index.get.ts` — list rooms with `building_id`, `status`, `floor` filter params
- [ ] 2.2 Create `server/api/rooms/index.post.ts` — create room (Zod validate)
- [ ] 2.3 Create `server/api/rooms/[id].get.ts` — get room with current tenant info if occupied
- [ ] 2.4 Create `server/api/rooms/[id].put.ts` — update room
- [ ] 2.5 Create `server/api/rooms/[id].delete.ts` — delete room (block if has active contract)

## 3. Composable

- [ ] 3.1 Create `app/composables/useRooms.ts` — `rooms`, `loading`, `error`, `filters`, `filteredRooms` (computed), `stats` (computed), full CRUD methods

## 4. Components

- [ ] 4.1 Create `app/components/features/room/StatusBadge.vue` — colored badge for room status
- [ ] 4.2 Create `app/components/features/room/Card.vue` — status color background, room_number, floor, base_price, tenant name if occupied
- [ ] 4.3 Create `app/components/features/room/Grid.vue` — responsive grid wrapper using `v-for`
- [ ] 4.4 Create `app/components/features/room/Form.vue` — room_number, building select, floor, base_price, deposit_amount, status, description
- [ ] 4.5 Create `app/components/features/room/Filters.vue` — building dropdown, status multi-select, floor input, search
- [ ] 4.6 Create `app/components/features/room/Select.vue` — dropdown to pick a room (used in Tenants/Contracts)

## 5. Pages (Admin)

- [ ] 5.1 Create `app/pages/admin/rooms/index.vue` — grid + filters + quick view modal
- [ ] 5.2 Create `app/pages/admin/rooms/new.vue` — create form
- [ ] 5.3 Create `app/pages/admin/rooms/[id].vue` — room detail
- [ ] 5.4 Create `app/pages/admin/rooms/[id]/edit.vue` — edit form

## 6. Pages (Manager)

- [ ] 6.1 Create `app/pages/manager/rooms/index.vue`
- [ ] 6.2 Create `app/pages/manager/rooms/new.vue`
- [ ] 6.3 Create `app/pages/manager/rooms/[id].vue`
- [ ] 6.4 Create `app/pages/manager/rooms/[id]/edit.vue`
