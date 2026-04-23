## ADDED Requirements

### Requirement: Rooms list renders as a color-coded grid by status
The system SHALL display rooms in a responsive grid where each card's background color corresponds to the room's status: `available` (green), `occupied` (blue), `maintenance` (yellow), `reserved` (purple).

#### Scenario: Available room renders green card
- **WHEN** a room has status `available`
- **THEN** its card uses the `bg-room-available` Tailwind token

#### Scenario: Grid is responsive
- **WHEN** the viewport changes size
- **THEN** the grid shows 1 column on mobile, 2 on sm, 3 on lg, 4 on xl

### Requirement: Rooms list filters persist in URL query params
The system SHALL persist filter state (`building_id`, `status`, `floor`, `search`) in the URL query string. Navigating to a filtered URL restores the same filter state.

#### Scenario: Filter by building scopes the list
- **WHEN** a user selects a building in the filter
- **THEN** only rooms belonging to that building are shown and the URL contains `?building_id=<id>`

#### Scenario: Filter survives page refresh
- **WHEN** a user refreshes the page with filters in the URL
- **THEN** the same filtered view is restored

### Requirement: Clicking a room card opens a quick view modal
The system SHALL show a modal with full room details (name, floor, rent, status, current tenant if occupied) when a user clicks on a room card, without navigating away from the grid.

#### Scenario: Quick view shows tenant name when occupied
- **WHEN** a user clicks an occupied room card
- **THEN** the modal displays the current tenant's name

### Requirement: Room create and edit forms validate with Zod
The system SHALL provide create (`/rooms/new`) and edit (`/rooms/[id]/edit`) pages with forms validated using `createRoomSchema` and `updateRoomSchema`.

#### Scenario: Form validates required fields
- **WHEN** a user submits a room form without a name or monthly rent
- **THEN** inline validation errors are shown and no API call is made

#### Scenario: Creating a room with a building sets building_id
- **WHEN** a user selects a building in the room form and submits
- **THEN** the room is created with the correct `building_id`

### Requirement: Rooms API supports filter query parameters
The system SHALL accept `building_id`, `status`, and `floor` as optional query parameters on `GET /api/rooms` and apply them as Supabase `.eq()` filters.

#### Scenario: Filter by status returns only matching rooms
- **WHEN** `GET /api/rooms?status=available` is called
- **THEN** only rooms with `status = 'available'` are returned

### Requirement: Rooms composable exposes occupancy stats
The system SHALL expose `stats` from `useRooms()` with `total`, `available`, `occupied`, `maintenance`, `reserved` counts and `occupancyRate` (percentage of occupied rooms).

#### Scenario: Stats reflect current filter state
- **WHEN** a building filter is active
- **THEN** `stats` counts only rooms in that building
