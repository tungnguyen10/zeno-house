# Property Operations

This feature area covers dashboard, buildings, rooms, and tenants. These are the base records that contracts and billing depend on.

## Dashboard

Route:

- `/`

API:

- `GET /api/dashboard/summary`

The dashboard summarizes:

- building count
- rooms by status
- active contracts
- tenants

## Buildings

Routes:

- `/buildings`
- `/buildings/create`
- `/buildings/[id]`
- `/buildings/[id]/edit`
- `/buildings/[id]/settings`
- `/buildings/[id]/meter-readings`
- `/buildings/[id]/rooms/[room]`

API:

- `GET /api/buildings` — supports `page`, `limit`, `q`, `status` (multi), `sort` (`name`/`created_at`/`total_rooms`), `order` (`asc`/`desc`)
- `POST /api/buildings`
- `GET /api/buildings/[id]`
- `PATCH /api/buildings/[id]`
- `DELETE /api/buildings/[id]` — returns `204` when empty; `409 CONFLICT` with `{ rooms, activeContracts }` details when not. Pass `?force=true` to soft-archive (`status=inactive`) and receive `200` with the building DTO.
- `POST /api/buildings/bulk` — body `{ action: 'archive' | 'activate' | 'delete', ids: string[] }`. Returns `{ succeeded: string[], failed: { id, reason }[] }`. Errors per item are caught and reported, not thrown.
- `GET /api/buildings/[id]/rooms/[room]`

Buildings own:

- address and display metadata
- operational config
- utility pricing config
- rooms
- building-level service defaults
- monthly billing periods

Readable building routes use `slug` when available and fall back to id.

### List page behaviour

- Toolbar exposes search (250ms debounce), status chips, sort, and order. All filter state mirrors the URL `?q=…&status=…&sort=…&order=…&page=…`.
- Admin can switch to selection mode to bulk archive/activate/delete. A "Chọn cả trang" checkbox toggles every building on the current page; the per-card checkbox toggles a single row.
- Delete requires a checkbox acknowledgement and only succeeds for buildings with no rooms and no active contracts.
- After bulk actions a toast summarises the result; if any items were skipped, an inline warning surfaces a "Xem chi tiết" button that opens a modal listing each failure with a human-readable reason.
- Empty states distinguish "no data" from "filtered to empty" (the latter offers a "Xoá bộ lọc" action).

### Detail page

- Hero shows name, code, status pill, address and three quick stats: rooms, occupied, services.
- Sections `#overview`, `#services`, `#operations`, `#danger-zone` (admin-only).
- Operations section exposes three shortcuts: "Xem phòng (N)" (rooms list filtered to this building), "Xem hợp đồng", and "Đọc đồng hồ tháng này" (links to `/buildings/[id]/meter-readings`).
- `DELETE` returning `409` shows an alert with a "Lưu trữ thay vì xoá" shortcut that re-issues `DELETE /api/buildings/[id]?force=true`.

### Form

- Four numbered card sections (basic, owner, billing defaults, schedule); the create page extends the form with a fifth "Tạo phòng nhanh" section via the `extras` slot so the same desktop footer / mobile sticky save bar drives the entire flow.
- Inline blur validation runs the create schema per field — errors appear on blur and clear as soon as the value becomes valid. Submit reveals every remaining error in a summary at the top with click-to-focus.
- Draft autosaved to `localStorage` (`building-form:create` or `building-form:edit:<id>`); the form shows a restore banner when a draft exists and clears it on successful submit.
- Dirty-state guard via `onBeforeRouteLeave` and `beforeunload` prompts before discarding changes.
- Mobile shows a sticky save bar with safe-area-inset padding.

## Rooms

Routes:

- `/rooms`
- `/rooms/create`
- `/rooms/[id]`
- `/rooms/[id]/edit`
- `/buildings/[id]/rooms/[room]`

API:

- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/[id]`
- `PATCH /api/rooms/[id]`
- `DELETE /api/rooms/[id]`

Room statuses:

- `available`
- `occupied`
- `maintenance`

Contracts drive occupancy state. Creating an active contract occupies the room. Terminating or expiring a contract releases it unless the room is in maintenance.

## Tenants

Routes:

- `/tenants`
- `/tenants/create`
- `/tenants/[id]`
- `/tenants/[id]/edit`

API:

- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/tenants/[id]`
- `PATCH /api/tenants/[id]`
- `DELETE /api/tenants/[id]`

Tenant records include:

- full name and contact fields
- gender
- occupation
- identity issue date/place
- emergency contact name/phone

Tenant detail shows current active contract and contract history.

## Implementation Files

Buildings:

- `app/pages/buildings/**`
- `app/components/buildings/**`
- `app/composables/buildings/**`
- `server/services/buildings/index.ts`
- `server/repositories/buildings/index.ts`
- `app/utils/validators/buildings.ts`
- `app/utils/mappers/buildings.ts`

Rooms:

- `app/pages/rooms/**`
- `app/components/rooms/**`
- `app/composables/rooms/**`
- `server/services/rooms/index.ts`
- `server/repositories/rooms/index.ts`
- `app/utils/validators/rooms.ts`
- `app/utils/mappers/rooms.ts`

Tenants:

- `app/pages/tenants/**`
- `app/components/tenants/**`
- `app/composables/tenants/**`
- `server/services/tenants/index.ts`
- `server/repositories/tenants/index.ts`
- `app/utils/validators/tenants.ts`
- `app/utils/mappers/tenants.ts`
