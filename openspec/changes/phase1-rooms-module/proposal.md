## Why

Rooms are the core rentable unit — every contract, invoice, and tenant assignment is tied to a room. The admin/manager needs a visual grid view with status colors to quickly assess occupancy across their buildings.

## What Changes

- Add `/admin/rooms`, `/manager/rooms` pages: grid view, create, detail, edit
- Add `RoomCard.vue`, `RoomGrid.vue`, `RoomForm.vue`, `RoomFilters.vue`, `RoomStatusBadge.vue`, `RoomSelect.vue` components
- Add `useRooms()` composable with CRUD, filters, and occupancy stats
- Add server API routes with filter query params: GET/POST `/api/rooms`, GET/PUT/DELETE `/api/rooms/[id]`
- Add Zod schemas: `createRoomSchema`, `updateRoomSchema`
- Add `locales/vi/rooms.json` + `locales/en/rooms.json`

## Capabilities

### New Capabilities

- `rooms-crud`: Full CRUD for rooms with grid view, status-based colors, filter by building/status/floor, and URL-persisted filters

### Modified Capabilities

*(none)*

## Impact

- `app/pages/admin/rooms/` and `app/pages/manager/rooms/` — new pages
- `app/components/features/room/` — new components
- `app/composables/useRooms.ts` — new composable
- `app/types/rooms.ts` — new types + Zod schemas
- `server/api/rooms/` — new API routes
- `locales/vi/rooms.json`, `locales/en/rooms.json`
- Supabase `rooms` table (migration required)
- Depends on `phase1-buildings-module` (rooms belong to buildings)
