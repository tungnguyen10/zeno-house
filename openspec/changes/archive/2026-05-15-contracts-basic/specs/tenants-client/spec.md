## MODIFIED Requirements

### Requirement: Tenant detail page
`/tenants/:id` page SHALL display all tenant fields including full_name, phone, email, id_number, date_of_birth, permanent_address, notes. Admin sees edit and delete buttons. Delete uses `UiConfirmModal`. The page SHALL also display a read-only "Hợp đồng" section listing all contracts for this tenant (contract id, room number + building, start_date, end_date, status badge), each linking to `/contracts/:id`. When no contracts exist, show a "Chưa có hợp đồng" placeholder.

#### Scenario: Detail view
- **WHEN** admin navigates to /tenants/:id
- **THEN** all tenant fields displayed with edit/delete actions

#### Scenario: Delete with confirmation
- **WHEN** admin clicks Xoá and confirms in UiConfirmModal
- **THEN** tenant deleted, redirected to /tenants

#### Scenario: Not found
- **WHEN** tenant id does not exist
- **THEN** redirected to /tenants

#### Scenario: Show current room when assigned
- **WHEN** tenant has an active room assignment
- **THEN** current room number, floor, and building name are displayed with a link to room detail

#### Scenario: Show no room when unassigned
- **WHEN** tenant has no active room assignment
- **THEN** "Chưa có phòng" placeholder displayed

#### Scenario: Show contracts list
- **WHEN** tenant has one or more contracts
- **THEN** each contract shown with room, dates, and status badge linking to /contracts/:id

#### Scenario: Show no contracts placeholder
- **WHEN** tenant has no contracts
- **THEN** "Chưa có hợp đồng" placeholder displayed in the Hợp đồng section
