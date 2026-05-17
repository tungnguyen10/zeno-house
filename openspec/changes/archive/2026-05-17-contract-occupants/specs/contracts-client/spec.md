## MODIFIED Requirements

### Requirement: Contract detail page
`/contracts/:id` page SHALL display all contract fields: room number + building, tenant name + phone, start_date, end_date, monthly_rent, deposit, status badge, notes. Admin sees edit and delete buttons. Delete uses `UiConfirmModal`.

The page SHALL additionally display an **"Người ở" section** that shows:
- Primary tenant at the top (name, role badge "Người thuê chính")
- List of roommates (role = 'roommate') with move_in_date; moved-out occupants shown with muted style and move_out_date
- Section header shows active occupant count vs `occupantCount` from contract (e.g. `2/2`). When count exceeds `occupantCount`, badge shown in amber with ⚠ — soft warning, does not block adding more
- Admin sees "Thêm người ở" button and per-row "Ghi nhận rời" (move-out) and "Xoá" actions
- Manager sees the list only (read-only)

#### Scenario: Detail view
- **WHEN** admin navigates to /contracts/:id
- **THEN** all contract fields displayed with edit/delete actions and occupants section

#### Scenario: Delete with confirmation
- **WHEN** admin clicks Xoá and confirms in UiConfirmModal
- **THEN** contract deleted, redirected to /contracts

#### Scenario: Not found
- **WHEN** contract id does not exist
- **THEN** redirected to /contracts

#### Scenario: Occupants section shows roommates
- **WHEN** contract has roommates
- **THEN** each roommate listed with name, move_in_date, and status (active / moved out)

#### Scenario: Admin adds roommate
- **WHEN** admin clicks "Thêm người ở" and submits valid form
- **THEN** new occupant appears in list

#### Scenario: Admin records move-out
- **WHEN** admin clicks "Ghi nhận rời" on an active roommate
- **THEN** move-out date prompt appears and on confirm occupant shows as moved-out

#### Scenario: Admin deletes occupant
- **WHEN** admin clicks "Xoá" on an occupant and confirms
- **THEN** occupant record removed from list
