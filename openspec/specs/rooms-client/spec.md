## Purpose

Client-side UI for managing rooms. Includes list page with filters, detail page, create and edit pages. Status badge uses color coding per room occupancy state.

## Requirements

### Requirement: Room list page
`/rooms` page SHALL display all rooms in a table/card list. Supports filter by building (dropdown), status (dropdown), floor (input). Shows loading skeleton and empty state. Admin sees create button.

#### Scenario: List loads
- **WHEN** admin navigates to /rooms
- **THEN** rooms are displayed with building name, room_number, floor, status, monthly_rent

#### Scenario: Filter by building
- **WHEN** admin selects a building from filter dropdown
- **THEN** list updates to show only rooms in that building

#### Scenario: Empty state
- **WHEN** no rooms match filter or no rooms exist
- **THEN** empty state message displayed with create button

### Requirement: Room detail page
`/rooms/:id` page SHALL display room master data, occupancy status, current active contract summary, and a read-only contract history. Admin sees edit/delete actions and occupancy lifecycle actions where allowed. The page SHALL NOT host monthly billing entry, monthly utility input, invoice state, payment state, or billing calculations.

#### Scenario: Detail view
- **WHEN** admin navigates to `/rooms/:id`
- **THEN** room detail is displayed with edit and delete actions

#### Scenario: Not found
- **WHEN** room id does not exist
- **THEN** 404 page shown

#### Scenario: Show current tenant when occupied
- **WHEN** room has an active contract (`status = 'active'`)
- **THEN** current tenant's name and phone are displayed with a link to tenant detail

#### Scenario: Show assign button when no active contract
- **WHEN** room has no active contract and room.status is not `maintenance` and user is admin
- **THEN** a "Giao phòng" button is shown that navigates to `/contracts/create?room_id=<id>`

#### Scenario: Show unassign button when occupied
- **WHEN** room has an active contract and user is admin
- **THEN** a "Thu phòng" button is shown with `UiConfirmModal`; confirm calls `PATCH /api/contracts/:id` with status `terminated`

#### Scenario: Show contracts list
- **WHEN** room has one or more contracts
- **THEN** each contract shown with tenant name, dates, and status badge linking to /contracts/:id

#### Scenario: Show no contracts placeholder
- **WHEN** room has no contracts
- **THEN** "Chưa có hợp đồng" placeholder displayed in the Hợp đồng section

#### Scenario: Monthly billing is not performed from room detail
- **WHEN** user needs to enter monthly readings or review monthly charges
- **THEN** the UI directs them to the Monthly Billing Workspace instead of a room-detail workflow

#### Scenario: Effective rent reflects active contract when present
- **WHEN** the room has an active contract whose `monthly_rent` differs from the room's `monthly_rent`
- **THEN** the page displays the active contract's `monthly_rent` as the effective rent
- **AND** the page shows a helper note indicating the value comes from the active contract

#### Scenario: Catalog rent shown when vacant
- **WHEN** the room has no active contract
- **THEN** the page displays `room.monthly_rent` without the active-contract note

#### Scenario: No helper note when rents already match
- **WHEN** the active contract's `monthly_rent` equals the room's `monthly_rent`
- **THEN** the page displays the rent without the active-contract helper note

### Requirement: Room form labels rent as the canonical price
The room create/edit form's monthly rent input SHALL include helper text indicating that this is the room's canonical price and that new contracts default to this value.

#### Scenario: Helper text shown on the form
- **WHEN** an admin opens the room create or edit form
- **THEN** a helper text below the "Giá thuê / tháng" input explains that this is the room's standard price and new contracts will default to it

### Requirement: Create room page
`/rooms/create` page SHALL present RoomForm. On success redirects to /rooms. Shows API errors inline.

#### Scenario: Create success
- **WHEN** admin fills valid form and submits
- **THEN** room created, redirected to /rooms

#### Scenario: Duplicate room number
- **WHEN** admin submits duplicate room_number in same building
- **THEN** error displayed inline without page reload

### Requirement: Edit room page
`/rooms/:id/edit` page SHALL pre-fill RoomForm with existing data. On success redirects to /rooms/:id.

#### Scenario: Edit success
- **WHEN** admin edits and saves
- **THEN** room updated, redirected to detail page

### Requirement: Room status badge
Status badge SHALL use color coding: `available` → green, `occupied` → cyan, `maintenance` → yellow.

#### Scenario: Badge colors
- **WHEN** room has status 'available'
- **THEN** badge displays with green color variant

---

### Requirement: Room list pagination
The `/rooms` list page SHALL support pagination matching the buildings list pattern. `useRoomList` SHALL expose `page` (reactive, default 1), `totalPages` (computed), and reset `page` to 1 when filters change. UI shows prev/next buttons when `totalPages > 1`.

#### Scenario: Next page
- **WHEN** user clicks next page button
- **THEN** page increments and list reloads with next page of results

#### Scenario: Filter resets page
- **WHEN** user changes building or status filter
- **THEN** page resets to 1 automatically
