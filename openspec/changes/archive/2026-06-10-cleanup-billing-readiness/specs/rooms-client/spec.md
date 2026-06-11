## MODIFIED Requirements

### Requirement: Room detail page
`/rooms/:id` page SHALL display room master data, occupancy status, current active contract summary, and a read-only contract history. Admin sees edit/delete actions and occupancy lifecycle actions where allowed. The page SHALL NOT host monthly billing entry, monthly utility input, invoice state, payment state, or billing calculations.

#### Scenario: Detail view
- **WHEN** admin navigates to `/rooms/:id`
- **THEN** room detail is displayed with edit and delete actions

#### Scenario: Show current tenant when occupied
- **WHEN** room has an active contract (`status = 'active'`)
- **THEN** current tenant's name and phone are displayed with a link to tenant detail

#### Scenario: Show assign button when no active contract
- **WHEN** room has no active contract and room.status is not `maintenance` and user is admin
- **THEN** a "Giao phòng" button is shown that navigates to `/contracts/create?room_id=<id>`

#### Scenario: Show unassign button when occupied
- **WHEN** room has an active contract and user is admin
- **THEN** a "Thu phòng" button is shown with `UiConfirmModal`; confirm calls `PATCH /api/contracts/:id` with status `terminated`

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

## REMOVED Requirements

### Requirement: Meter readings section in room detail
The room detail page SHALL include a "Chỉ số đồng hồ" section below the contracts section showing historical meter readings for the room.

