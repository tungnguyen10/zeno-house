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
`/rooms/:id` page SHALL display full room info including building name, all fields, and occupancy status badge.

#### Scenario: Detail view
- **WHEN** admin navigates to /rooms/:id
- **THEN** room detail is displayed with edit and delete actions

#### Scenario: Not found
- **WHEN** room id does not exist
- **THEN** 404 page shown

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
