## MODIFIED Requirements

### Requirement: Room detail page
`/rooms/:id` page SHALL display full room info including building name, all fields, and occupancy status badge.

#### Scenario: Detail view
- **WHEN** admin navigates to /rooms/:id
- **THEN** room detail is displayed with edit and delete actions

#### Scenario: Not found
- **WHEN** room id does not exist
- **THEN** 404 page shown

#### Scenario: Show current tenant when occupied
- **WHEN** room.status is 'occupied'
- **THEN** current tenant's name and phone are displayed with a link to tenant detail

#### Scenario: Show assign button when available
- **WHEN** room.status is 'available' and user is admin
- **THEN** a "Giao phòng" button is shown that opens an assign modal

#### Scenario: Show unassign button when occupied
- **WHEN** room.status is 'occupied' and user is admin
- **THEN** a "Thu phòng" button is shown with UiConfirmModal for confirmation

#### Scenario: Assign modal selects tenant and date
- **WHEN** admin opens assign modal
- **THEN** can search/select from tenant list and pick start_date; submit calls assign API
