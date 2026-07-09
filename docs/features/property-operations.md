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
- operational start period (`operational_start_year`, `operational_start_month`)
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
- After bulk actions, the page clears selection in the `onDone` handler and refreshes the keyed list (`buildings:list`) so filtered views render the latest server state immediately.
- Empty states distinguish "no data" from "filtered to empty" (the latter offers a "Xoá bộ lọc" action).

### Detail page

- Hero shows name, code, status pill, address and three quick stats: rooms, occupied, services.
- Sections `#overview`, `#services`, `#operations`, `#danger-zone` (admin-only).
- Operations section exposes three shortcuts: "Xem phòng (N)" (rooms list filtered to this building), "Xem hợp đồng", and "Đọc đồng hồ tháng này" (links to `/buildings/[id]/meter-readings`).
- `DELETE` returning `409` shows an alert with a "Lưu trữ thay vì xoá" shortcut that re-issues `DELETE /api/buildings/[id]?force=true`.

### Form

- Four numbered card sections (basic, owner, billing defaults, schedule); the create page extends the form with a fifth "Tạo phòng nhanh" section via the `extras` slot so the same desktop footer / mobile sticky save bar drives the entire flow.
- Schedule section includes optional "Năm bắt đầu" and "Tháng bắt đầu" fields to declare the first operational month of the building.
- Inline blur validation runs the create schema per field — errors appear on blur and clear as soon as the value becomes valid. Submit reveals remaining errors inline for all invalid fields and focuses the first invalid field.
- Draft autosaved to `localStorage` (`building-form:create` or `building-form:edit:<id>`); draft presence is evaluated after client mount so SSR/hydration output stays stable, then the form shows a restore banner when a draft exists and clears it on successful submit.
- Dirty-state guard via `onBeforeRouteLeave` and `beforeunload` prompts before discarding changes.
- Mobile shows a sticky save bar with safe-area-inset padding.

### Shared period options

- Month/year selectors in billing list, invoice filter, operations report, and building meter readings now use a shared composable `usePeriodOptions`.
- Default behavior is dynamic currentYear ±1 for years and full 1-12 for months.
- Operations report applies building operational start constraints on top of shared options and auto-normalizes invalid selections when filters change.

## Rooms

Routes:

- `/rooms`
- `/rooms/create`
- `/rooms/[id]`
- `/rooms/[id]/edit`
- `/buildings/[id]/rooms/[room]`

API:

- `GET /api/rooms` — supports `page`, `limit`, `q`, `building_id`, `floor`, `status` (multi), `sort` (`room_number`/`floor`/`monthly_rent`/`created_at`), `order` (`asc`/`desc`). When `status` is omitted, archived rooms are excluded by default.
- `POST /api/rooms`
- `GET /api/rooms/[id]`
- `PATCH /api/rooms/[id]`
- `DELETE /api/rooms/[id]` — returns `204` when no blockers exist; returns `409 CONFLICT` with `{ activeContracts, meterReadings }` when the room has active contracts or historical meter readings. Pass `?force=true` to soft-archive (`status=archived`) and receive `200` with the room DTO.
- `POST /api/rooms/bulk` — body `{ action: 'archive' | 'activate' | 'set_maintenance' | 'delete', ids: string[] }`. Returns `{ succeeded: string[], failed: { id, reason }[] }` with per-room failures.

Room statuses:

- `available`
- `occupied`
- `maintenance`
- `archived`

Contracts drive occupancy state. Creating an active contract occupies the room. Terminating or expiring a contract releases it unless the room is in maintenance.

### List page behaviour

- Toolbar exposes search, status chips, building filter, floor filter, sort, and order. Filter state mirrors the URL and resets `page=1` when changed.
- Admin can switch to selection mode to bulk mark rooms available, set maintenance, archive, or delete. Bulk delete requires both acknowledgement and a non-empty reason, and applies the same safe-delete checks as single delete.
- After bulk actions, the page clears selection in the `onDone` handler and refreshes the keyed list (`rooms:list`) so the current filtered result always shows the latest server state.
- Empty states distinguish filtered-empty from no-data; API errors include a retry action.

### Detail page

- Hero shows room identity, code, status, building link, active-contract state, occupant count, and meter-device count inferred from latest readings.
- Sections `#overview`, `#active-contract`, `#meter-readings`, `#contracts-history`, `#danger-zone` (admin-only).
- Delete/archive confirmations in danger zone require a non-empty reason before submitting.
- `DELETE` returning `409` shows an alert with blocker counts and a "Lưu trữ thay vì xoá" shortcut that re-issues `DELETE /api/rooms/[id]?force=true`.

### Form

- Four numbered sections: location, status, rent/area, description.
- Inline blur validation and submit-time inline errors match the buildings form pattern.
- Draft autosaves to `localStorage` (`room-form:create:<building_id|none>` or `room-form:edit:<id>`) and can be restored, dismissed, or deleted from the banner; draft presence is evaluated after client mount to avoid SSR hydration mismatch.
- Dirty-state guard via `onBeforeRouteLeave` and `beforeunload`; mobile shows a sticky save bar with safe-area-inset padding.

## Tenants

Routes:

- `/tenants`
- `/tenants/create`
- `/tenants/[code]`
- `/tenants/[code]/edit`

API:

- `GET /api/tenants` — supports `q` (multi-field), `building_id`, `contract_state` (`with_contract`/`without_contract`), `status[]` (defaults to `active`; pass `status[]=archived` or `status[]=all` to include archived), `sort` (`full_name`/`created_at`/`updated_at`), `order` (`asc`/`desc`).
- `POST /api/tenants`
- `GET /api/tenants/[id]`
- `PATCH /api/tenants/[id]`
- `DELETE /api/tenants/[id]` — returns `409 CONFLICT` with `details.activeContracts` and `details.activeOccupancies` when blocked. Pass `?force=true` to soft-archive instead (returns archived tenant). For owner users, when tenant has no active-building scope, delete is still allowed if the tenant row was created by that owner.
- `POST /api/tenants/bulk` — body `{ action: 'archive' | 'activate' | 'delete', ids: string[], reason?: string }` returns `{ succeeded: string[], failed: { id, reason }[] }`. `reason` is required when `action='delete'`. Reasons: `has_active_contracts`, `has_active_occupancies`, `not_found`, `conflict`, `forbidden`.

Tenant records include:

- full name and contact fields
- gender
- occupation
- identity issue date/place
- emergency contact name/phone
- status (`active` / `archived`)

UX notes:

- List page (`/tenants`): toolbar wraps debounced search, building filter, contract-state filter, status chips, sort dropdown, and order toggle. Filters sync to URL query so the view is shareable. Admins can toggle a selection mode that exposes per-row checkboxes plus a `TenantBulkActionsBar` for archive/activate/delete. Bulk delete requires a non-empty reason. Failures are surfaced inline with a "Xem chi tiết" modal listing each blocked tenant. After bulk actions, the page clears selection in the `onDone` handler and refreshes the keyed list (`tenants:list`) so filtered data is immediately up to date.
- Detail page (`/tenants/[code]`): renders a `TenantDetailHero` with status badge, contact chips (phone `tel:`, email `mailto:`, ID number), and three stat tiles (active contracts, current room, occupancies). Sections use anchor ids `#personal`, `#id-document`, `#emergency`, `#contracts`, `#danger-zone`. The danger-zone section is hidden for managers. Delete/archive confirmations require a non-empty reason. When delete returns 409, the page shows a warning alert summarising blockers with a "Lưu trữ thay vì xoá" button that calls `DELETE` with `?force=true`.
- Form (`TenantForm`): four numbered sections (Personal / ID document / Emergency contact / Notes), inline blur validation, submit-time inline errors with first-invalid focus, draft autosave to `localStorage` (`tenant-form:create` or `tenant-form:edit:<id>`), restore/dismiss banner (draft visibility computed after client mount for hydration safety), dirty-state guard via `onBeforeRouteLeave` + `beforeunload`, mobile sticky save bar with safe-area-inset padding.

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
