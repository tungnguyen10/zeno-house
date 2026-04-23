## Context

Rooms have a `status` field (`available` | `occupied` | `maintenance` | `reserved`) which drives color coding. They belong to a building via `building_id`. Tenant assignment is tracked via the contracts table (a room is occupied when it has an active contract). The existing `RoomStatus` type and status color tokens are already defined in `instructions/styling.md`.

## Goals / Non-Goals

**Goals:**
- Grid view with status color cards (responsive: 1/2/3/4 columns)
- Filters: building, status, floor — persisted in URL query params
- Quick view modal on card click (room details without full page nav)
- `RoomSelect` component for use in Tenants and Contracts modules

**Non-Goals:**
- Room pricing history (Phase 2)
- Room photos/gallery (Phase 2)
- Bulk status update (Phase 2)

## Decisions

### 1. Filters persisted in URL via `useRoute().query`

The filter state (`building_id`, `status`, `floor`, `search`) is read from and written to the URL query string using `useRoute` and `navigateTo`.

**Why**: Allows sharing/bookmarking filtered views; filters survive page refresh.

### 2. Grid responsiveness via Tailwind breakpoints

`RoomGrid.vue` uses `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

**Why**: Pure CSS, no JS resize listener needed.

### 3. Quick view modal uses `useRoom(id)` composable call

Clicking a `RoomCard` opens a `UModal` that fetches `GET /api/rooms/[id]` for full detail. This avoids embedding all data in the list response.

**Why**: List response stays lean; detail (tenant info, notes, services) loaded on demand.

### 4. Status colors via semantic Tailwind tokens

`RoomCard` uses `bg-room-${room.status}` class (tokens: `room-available`, `room-occupied`, `room-maintenance`, `room-reserved`) as defined in the styling guide.

**Why**: Consistent with established conventions; easy to theme.

### 5. Server-side filtering via query params

`GET /api/rooms?building_id=&status=&floor=` applies filters in the Supabase query rather than loading all rooms.

**Why**: Buildings could have hundreds of rooms; client-side filter won't scale.

## Risks / Trade-offs

- **`occupied` status sync** → A room's status must be set to `occupied` when an active contract is created, and back to `available` when it ends. This is enforced in the Contracts module, not here. Risk: status drift if contracts aren't managed properly. Mitigation: add DB trigger or handle in contract creation flow.
- **Quick view modal data latency** → Extra API call on card click adds ~200ms. Acceptable for now.

## Open Questions

- Should floor be a number or a string? → Number (allows numeric sort). Store as integer.
