## ADDED Requirements

### Requirement: Service fees catalog page
`/service-fees` page SHALL display all fee definitions in a table with columns: name, default_amount, active status. Admin can create new fee, edit, and toggle active. Uses `UiEmptyState` when no fees exist.

#### Scenario: List displays all fees
- **WHEN** admin navigates to /service-fees
- **THEN** fee definitions shown with name, amount, active badge

#### Scenario: Create fee via modal
- **WHEN** admin clicks create button and fills form
- **THEN** new fee appears in list

### Requirement: Room service fees section
Room detail page SHALL have a "Phí dịch vụ" section listing active fee assignments for the room. Each row shows fee name and effective amount. Admin can add fee assignment (select from definitions) or remove.

#### Scenario: Room fees section visible
- **WHEN** admin views room detail with assigned fees
- **THEN** section shows fee name and effective monthly amount

#### Scenario: No fees assigned
- **WHEN** room has no fee assignments
- **THEN** section shows "Chưa có phí dịch vụ" with add button
