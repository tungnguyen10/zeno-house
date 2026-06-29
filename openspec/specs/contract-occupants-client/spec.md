## Purpose

Client-side composable, form component, and UI for managing contract occupants (roommates). Occupants are displayed on the contract detail page and can be added inline. Pending occupants can also be collected before contract creation.

## Requirements

### Requirement: Occupant list composable
`useContractOccupants(contractId: MaybeRef<string>)` SHALL fetch and expose the list of occupants for a contract. State is updated immediately after each mutation using the API response (no optimistic update — response includes joined tenant name).

Exposed: `occupants`, `isLoading`, `error`, `addOccupant(input)`, `moveOut(occupantId, input)`, `removeOccupant(occupantId)`, `refresh`.

#### Scenario: Fetch occupants
- **WHEN** composable is initialized with a contractId
- **THEN** occupants list is populated from API with tenantName and tenantPhone on each record

#### Scenario: Add occupant
- **WHEN** addOccupant(input) called with valid data
- **THEN** new occupant with tenantName appears in list immediately (from API response)

#### Scenario: Move-out
- **WHEN** moveOut(occupantId, { move_out_date }) called
- **THEN** occupant record in local state updated with move_out_date

#### Scenario: Remove occupant
- **WHEN** removeOccupant(occupantId) called
- **THEN** occupant removed from list

### Requirement: Occupant form component
`ContractOccupantForm` SHALL provide a form to add a new roommate. Role is always `roommate` — no role selector shown.

**Fields:** tenant searchable select, move_in_date (defaults today), billing_counted (checkbox, defaults true).

**Props:**
- `excludeTenantIds?: string[]` — tenant IDs to hide from picker (primary tenant + already-added occupants)
- `available?: boolean` — when true, server query filters to only tenants not in any active contract or active occupancy
- `loading?: boolean`, `apiError?: string | null`

**Emits:** `submit(ContractOccupantAddInput)`, `cancel`.

#### Scenario: Excluded tenants not in picker
- **WHEN** form rendered with excludeTenantIds containing a tenant id
- **THEN** that tenant does not appear in the picker regardless of search

#### Scenario: Available-only filter
- **WHEN** available=true
- **THEN** server query includes available=true; tenants in active contracts or active occupancies are excluded

#### Scenario: Valid submit
- **WHEN** all required fields filled and form submitted
- **THEN** submit event emitted with role='roommate' hardcoded

#### Scenario: Validation error
- **WHEN** tenant not selected and form submitted
- **THEN** field-level error shown, no submit event emitted

### Requirement: Contract detail — occupants section
The `/contracts/:id` page SHALL include a "Người ở" section displaying:
- Primary tenant at the top with "Người thuê chính" badge
- Roommates list with name, move_in_date; moved-out occupants shown muted with move_out_date
- Section header shows `active / occupantCount` counter (e.g. `2/2`) where `active` = 1 primary tenant + active roommates (rows where `role='roommate'` and `move_out_date IS NULL`). When `active >= contract.occupantCount`, counter renders in amber and the "Thêm người ở" button is disabled.
- Admin: "Thêm người ở" button opens inline `ContractOccupantForm`; disabled when occupant limit reached
- Admin: per-row "Ghi nhận rời" (move-out date prompt) and "Xoá" (confirm modal)
- Manager: read-only

#### Scenario: Occupant count within limit
- **WHEN** active occupants < occupantCount
- **THEN** counter shown in muted style (X/Y) and "Thêm người ở" button is enabled

#### Scenario: Occupant count at limit
- **WHEN** active occupants == occupantCount
- **THEN** counter shown in amber; "Thêm người ở" button is disabled with tooltip explaining the limit

#### Scenario: Admin adds roommate
- **WHEN** admin clicks "Thêm người ở" and submits valid form
- **THEN** new occupant appears in list immediately

#### Scenario: Server rejects roommate that would exceed limit
- **WHEN** the POST request would push the active count above `occupantCount`
- **THEN** the API SHALL return 409 `CONFLICT` and the form SHALL render the server message inline (no occupant inserted)

#### Scenario: Admin records move-out
- **WHEN** admin clicks "Ghi nhận rời" on an active roommate
- **THEN** move-out date prompt shown; on confirm occupant shows as moved-out

#### Scenario: Admin deletes occupant
- **WHEN** admin clicks "Xoá" on an occupant and confirms
- **THEN** occupant removed from list
