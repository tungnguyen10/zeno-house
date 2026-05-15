## MODIFIED Requirements

### Requirement: Room detail page
`/rooms/:id` page SHALL display full room info including building name, all fields, and occupancy status badge. Admin sees edit and delete buttons. The page SHALL also display a read-only "Hợp đồng" section listing all contracts for this room (contract id, tenant full_name, start_date, end_date, status badge), each linking to `/contracts/:id`. When no contracts exist, show a "Chưa có hợp đồng" placeholder.

#### Scenario: Detail view
- **WHEN** admin navigates to /rooms/:id
- **THEN** room detail is displayed with edit and delete actions

#### Scenario: Not found
- **WHEN** room id does not exist
- **THEN** 404 page shown

#### Scenario: Show current tenant when occupied
- **WHEN** room has an active assignment record
- **THEN** current tenant's name and phone are displayed with a link to tenant detail

#### Scenario: Show assign button when no active assignment
- **WHEN** room has no active assignment record and user is admin
- **THEN** a "Giao phòng" button is shown that opens an assign modal

#### Scenario: Show unassign button when assigned
- **WHEN** room has an active assignment record and user is admin
- **THEN** a "Thu phòng" button is shown with UiConfirmModal for confirmation

#### Scenario: Assign modal selects tenant and date
- **WHEN** admin opens assign modal
- **THEN** can search/select from unassigned tenants only and pick start_date; submit calls assign API

#### Scenario: Show contracts list
- **WHEN** room has one or more contracts
- **THEN** each contract shown with tenant name, dates, and status badge linking to /contracts/:id

#### Scenario: Show no contracts placeholder
- **WHEN** room has no contracts
- **THEN** "Chưa có hợp đồng" placeholder displayed in the Hợp đồng section
