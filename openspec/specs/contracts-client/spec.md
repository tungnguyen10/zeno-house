## Purpose

Client-side UI for managing contracts. List page with status filter, detail page, create and edit pages with `ContractForm`. Follows the same composable + page pattern as buildings, rooms, and tenants.
## Requirements
### Requirement: Contract list page
`/contracts` page SHALL display all contracts in a list. Supports filter by building and status (dropdown: all / active / expired / terminated). When no building is selected, the page SHALL list contracts from all buildings. Shows loading skeleton and empty state. Admin sees create button. Includes pagination (prev/next) when `totalPages > 1`. Each row/card shows: room number + building name, tenant full_name, start_date, end_date, monthly_rent, status badge.

#### Scenario: List loads
- **WHEN** admin navigates to /contracts
- **THEN** contracts are displayed with room, tenant, dates, rent, and status badge

#### Scenario: Filter by status
- **WHEN** admin selects 'active' from the status filter
- **THEN** list updates to show only active contracts

#### Scenario: Filter by building
- **WHEN** admin selects a building in the contracts toolbar
- **THEN** list updates to show only contracts for that building

#### Scenario: Clear building filter
- **WHEN** admin clears the selected building
- **THEN** list updates to show contracts from all buildings

#### Scenario: Empty state
- **WHEN** no contracts exist or no contracts match filter
- **THEN** empty state message displayed with create button

### Requirement: Contract detail page
`/contracts/:id` page SHALL display all contract fields: room number + building, tenant name + phone, start_date, end_date, monthly_rent, deposit, status badge, notes. Admin sees edit and delete buttons. Delete uses `UiConfirmModal`.

#### Scenario: Detail view
- **WHEN** admin navigates to /contracts/:id
- **THEN** all contract fields displayed with edit/delete actions

#### Scenario: Delete with confirmation
- **WHEN** admin clicks Xoá and confirms in UiConfirmModal
- **THEN** contract deleted, redirected to /contracts

#### Scenario: Not found
- **WHEN** contract id does not exist
- **THEN** redirected to /contracts

### Requirement: Create contract page
`/contracts/create` page SHALL use a **two-step visual layout** with numbered step indicators and a connector line:

- **Step 1 — Thông tin hợp đồng**: presents `ContractForm`. Required fields: room_id (searchable select from existing rooms without active contracts), tenant_id (searchable select from available tenants only), start_date, end_date, monthly_rent, **handover_electricity_reading**, **handover_water_reading**. Optional: deposit, status, notes, **handover_reading_date** (defaults to `start_date`). Shows API errors inline, including 409 CONFLICT for active contract on room and 422 VALIDATION_ERROR for missing handover readings.
- **Step 2 — Người ở chung (tuỳ chọn)**: presents a pending occupants panel. Admin may add roommates before submitting using an inline `ContractOccupantForm` (with `available=true` filter). Each pending occupant is displayed as a row with avatar initial, name, move-in date, billing badge ("Tính tiền" / "Không tính"), and a remove button.
- **Step 3 — Dịch vụ hàng tháng**: appears after contract is created. Shows `ContractServicesTab` loaded with the new contract's auto-cloned services. Admin can adjust per-service amount, quantity, or toggle before clicking "Xong" to proceed to contract detail.

On submit: contract is created first (atomically with the two handover readings on the server). If pending occupants exist, adds are fired in parallel (`Promise.allSettled`). A non-blocking amber warning banner is shown if any occupant add fails. After occupants, Step 3 (services) is shown before final redirect.

`excludeTenantIds` passed to `ContractOccupantForm` is a computed array of: primary `tenant_id` from form + all already-pending occupant `tenant_id`s.

`ContractForm` SHALL display a dedicated **"Số bàn giao đầu vào"** section in Step 1 containing two number inputs (Điện, Nước, unit suffix kWh / m³) and a single date input ("Ngày đọc") that defaults to `start_date`. When `room_id` changes, the form SHALL fetch the room's latest reading per meter type via `GET /api/meter-readings/latest?room_id=<id>` and pre-fill both number inputs with the returned values, showing a small reference label per input (e.g. "Số cuối: 1310 — handover_out 2026-07-31"). The admin MAY override either value. If the entered value is less than the pre-filled reference, the form SHALL display a soft amber warning under the input ("Số mới thấp hơn số cũ. Đồng hồ vừa được thay?") without blocking submit.

#### Scenario: Create success (no pending occupants)
- **WHEN** admin fills required fields including handover readings and submits
- **THEN** contract created with the two handover readings persisted, redirected to detail page

#### Scenario: Create success (with pending occupants)
- **WHEN** admin fills required fields, adds occupants in Step 2, and submits
- **THEN** contract created (with handover readings), occupant adds fired in parallel, Step 3 (services) shown for adjustment

#### Scenario: Services adjustment in Step 3
- **WHEN** Step 3 is shown after contract creation
- **THEN** `ContractServicesTab` displays auto-cloned services; admin can adjust then click "Xong" to navigate to detail page

#### Scenario: Occupant add partial failure
- **WHEN** contract created but one or more occupant adds fail
- **THEN** amber warning banner shown; redirect still proceeds to detail page

#### Scenario: Validation error
- **WHEN** admin submits without required fields, including handover readings
- **THEN** field-level error messages shown, no API call made

#### Scenario: Active contract conflict
- **WHEN** admin submits for a room that already has an active contract
- **THEN** error displayed inline: "Phòng này đã có hợp đồng đang hiệu lực"

#### Scenario: Pending occupant excluded from picker
- **WHEN** admin selects an occupant and then opens the add form again
- **THEN** already-added occupant and the primary tenant do not appear in picker

#### Scenario: Handover readings pre-filled from last reading
- **WHEN** admin selects a `room_id` that has prior `meter_readings`
- **THEN** the electricity and water number inputs are populated with the room's latest reading per meter type, and a reference label shows the source `reading_type` and `reading_date`

#### Scenario: Handover readings empty for brand new room
- **WHEN** admin selects a `room_id` that has no prior `meter_readings`
- **THEN** the electricity and water inputs remain empty and the reference label is omitted

#### Scenario: Lower-than-previous soft warning
- **WHEN** admin enters a handover value lower than the pre-filled reference
- **THEN** a soft amber warning is displayed under the input; the submit button remains enabled

### Requirement: Edit contract page
`/contracts/:id/edit` page SHALL pre-fill `ContractForm` with existing data. On success redirects to `/contracts/:id`.

#### Scenario: Edit success
- **WHEN** admin edits and saves
- **THEN** contract updated, redirected to detail page

#### Scenario: Redirect if not found
- **WHEN** contract id does not exist
- **THEN** redirected to /contracts

### Requirement: Contract composables
`useContractList` SHALL expose: `contracts`, `total`, `totalPages`, `page`, `statusFilter`, `buildingFilter`, `isLoading`, `error`, `refresh`. Reset `page` to 1 when `statusFilter` or `buildingFilter` changes. `useContractDetail(id)` SHALL mirror `useBuildingDetail` pattern with reactive id ref. `useContractForm` SHALL handle create/edit with Zod client-side validation matching server rules.

#### Scenario: Filters reset pagination
- **WHEN** user changes status or building filter
- **THEN** page resets to 1 automatically

#### Scenario: useContractDetail reactive id
- **WHEN** id ref changes
- **THEN** composable re-fetches contract data

### Requirement: Sidebar navigation
AppSidebar SHALL include a "Hợp đồng" nav item linking to `/contracts`.

#### Scenario: Sidebar shows contracts link
- **WHEN** admin views sidebar
- **THEN** "Hợp đồng" item visible and links to /contracts

### Requirement: Handover readings section in contract detail
The contract detail page SHALL include a "Số bàn giao" section showing handover meter readings (electricity + water) for the contracted room. Readings are identified by `room_id + meter_type` — no device lookup required. Handover readings are contract lifecycle data used for onboarding/offboarding and first-month billing fallback; they are not the monthly meter reading workflow.

#### Scenario: Section always shows two rows
- **WHEN** navigating to `/contracts/:id`
- **THEN** section shows one row for electricity and one for water, regardless of whether readings exist yet

#### Scenario: Save handover-in reading
- **WHEN** admin enters a value and blurs the input
- **THEN** system creates/updates a `meter_readings` row with `reading_type = 'handover_in'`, `room_id`, `meter_type`, and the contract start month

#### Scenario: Handover-out readings
- **WHEN** contract status is 'terminated' or 'expired'
- **THEN** section also shows handover_out row per meter type

#### Scenario: Saved indicator
- **WHEN** a reading already exists for a meter type
- **THEN** a ✓ indicator is shown; on re-save the value is updated (upsert)

#### Scenario: Monthly readings are not entered here
- **WHEN** user needs to enter monthly electricity or water readings
- **THEN** the UI directs them to the Monthly Billing Workspace rather than the handover section

### Requirement: Contract form rent is prefilled from selected room
The contract create/edit form SHALL automatically populate the `monthly_rent` input from the selected room's `monthly_rent` whenever a room is selected or switched. The user MAY override the prefilled value before submitting; any override SHALL persist only on the contract and SHALL NOT propagate back to the room.

#### Scenario: Selecting a room sets the rent input
- **WHEN** the user selects a room with `monthly_rent = 4500000`
- **THEN** the form's monthly rent input is set to `4500000`

#### Scenario: Switching rooms replaces the rent input
- **WHEN** the user switches to a different room with a different `monthly_rent`
- **THEN** the form's monthly rent input is replaced with the new room's `monthly_rent`

#### Scenario: User override is preserved on submit
- **WHEN** the user edits the prefilled rent value before submitting
- **THEN** the contract is created/updated with the user's overridden value
- **AND** the selected room's `monthly_rent` is not changed

#### Scenario: Helper text discloses the rent source
- **WHEN** a room is selected
- **THEN** the form displays helper text indicating the value defaulted from the room and may be overridden

### Requirement: Contract links prefer stable codes
Contract UI links SHALL prefer stable contract codes or slugs when available, while preserving UUID contract detail links.

#### Scenario: Contract link uses code
- **WHEN** a contract has code `hd-2026-0001`
- **THEN** the preferred detail link is `/contracts/hd-2026-0001`

#### Scenario: Contract link falls back to id
- **WHEN** a contract has no stable code
- **THEN** the UI links to `/contracts/<id>`

### Requirement: Contract URLs do not derive from tenant names
Contract routes SHALL NOT use tenant-name-derived slugs.

#### Scenario: Contract with tenant name
- **WHEN** UI renders a contract for tenant Nguyen Van A
- **THEN** the contract URL does not include a slug derived from `Nguyen Van A`

### Requirement: useContractList accepts filter/sort/URL-sync refs
`useContractList()` SHALL expose reactive refs for `q: string`, `status: ContractStatus[]`, `sort: 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'`, `order: 'asc' | 'desc'`, `roomFilter: string`, `tenantFilter: string` in addition to existing `buildingFilter`, `statusFilter`, `page`, `limit`. These refs SHALL be two-way synchronized with `useRoute().query` so that updating a ref pushes to URL and navigating with new query updates the refs. Changes to `q`, `status`, `sort`, `buildingFilter`, `roomFilter`, or `tenantFilter` SHALL reset `page` to 1.

#### Scenario: Query refs initialize from URL
- **WHEN** composable mounts on `/contracts?q=A101&status=active&sort=start_date&order=desc&page=2`
- **THEN** `q.value === 'A101'`, `status.value === ['active']`, `sort.value === 'start_date'`, `order.value === 'desc'`, `page.value === 2`

#### Scenario: Updating a ref pushes to URL
- **WHEN** consumer assigns `q.value = 'tran'`
- **THEN** the route query updates to include `q=tran` and `page=1`

#### Scenario: Refetch on filter change
- **WHEN** any of `q`, `status`, `sort`, `order` change
- **THEN** `useFetch` automatically refetches `/api/contracts` with the new query params

---

### Requirement: useContractForm exposes dirty state and draft persistence
`useContractForm()` SHALL expose `isDirty: ComputedRef<boolean>` indicating whether `formData` has diverged from the initial snapshot. It SHALL also expose `restoreDraft()`, `clearDraft()`, `hasDraft: ComputedRef<boolean>`. The composable SHALL persist `formData` to `localStorage` under key `contract-form:create` (wizard state including `currentStep`, pending occupants array, and selected services) or `contract-form:edit:<id>` with 500ms debounce after a change, and clear the entry after `submitCreate`/`submitUpdate` succeeds. The draft payload SHALL include a `draftVersion: number` so mismatched-version drafts can be detected.

#### Scenario: isDirty becomes true on field change
- **WHEN** consumer changes any field in `formData`
- **THEN** `isDirty.value === true`

#### Scenario: hasDraft reflects localStorage presence
- **WHEN** a draft exists for the current key
- **THEN** `hasDraft.value === true`

#### Scenario: restoreDraft populates formData and wizard state
- **WHEN** `restoreDraft()` is called and a wizard draft exists with `currentStep=2`, pending occupants, selected services
- **THEN** `formData` is replaced with the draft values, the wizard navigates to step 2, and `isDirty` recomputes against the new baseline

#### Scenario: Draft cleared after successful submit
- **WHEN** `submitCreate(data)` resolves successfully
- **THEN** the localStorage entry is removed and `hasDraft.value === false`

#### Scenario: Draft version mismatch
- **WHEN** `restoreDraft()` is called and the stored `draftVersion` differs from the current code version
- **THEN** an alert is shown indicating "Bản nháp cũ không tương thích" and `restoreDraft()` does not overwrite formData

---

### Requirement: useContractBulkActions composable
`app/composables/contracts/useContractBulkActions.ts` SHALL expose `selectedIds: Ref<string[]>`, `isSelected(id): boolean`, `toggle(id)`, `selectAll(ids: string[])`, `clear()`, and `runAction(action: 'terminate' | 'delete', opts?: { reason?: string }): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }>`. `runAction` SHALL call `POST /api/contracts/bulk` and return the parsed response; on success it SHALL clear selection.

#### Scenario: Toggle adds and removes IDs
- **WHEN** consumer calls `toggle('id-1')` then `toggle('id-1')`
- **THEN** `selectedIds.value` ends as `[]`

#### Scenario: selectAll replaces selection with provided IDs
- **WHEN** `selectAll(['a','b','c'])` is called
- **THEN** `selectedIds.value === ['a','b','c']`

#### Scenario: runAction returns partial-success shape
- **WHEN** `runAction('delete')` is called with 3 IDs and 1 fails
- **THEN** the promise resolves with `{ succeeded: [...], failed: [{ id, reason }] }`

#### Scenario: Selection clears after successful action
- **WHEN** `runAction('terminate')` resolves
- **THEN** `selectedIds.value === []`

---

### Requirement: Contracts validators include list-query and bulk-action schemas
`app/utils/validators/contracts.ts` SHALL export `contractListQuerySchema` (page, limit, q, building_id, room_id, tenant_id, status[], sort, order — all optional with defaults) and `contractBulkActionSchema` (action enum, ids min 1, reason optional). Both schemas SHALL be shared between client (URL parse, request body) and server (validation entry).

#### Scenario: contractListQuerySchema parses URL-shaped data
- **WHEN** `contractListQuerySchema.safeParse({ q: 'x', status: ['active'], sort: 'start_date', order: 'desc' })` is called
- **THEN** `success === true` with parsed values

#### Scenario: contractListQuerySchema accepts missing fields
- **WHEN** `contractListQuerySchema.safeParse({})` is called
- **THEN** `success === true` with defaults applied (`page=1`, `limit=20`, no filters)

#### Scenario: contractBulkActionSchema rejects empty IDs
- **WHEN** `contractBulkActionSchema.safeParse({ action: 'terminate', ids: [] })` is called
- **THEN** `success === false` with error on `ids`

#### Scenario: contractBulkActionSchema rejects invalid action
- **WHEN** `contractBulkActionSchema.safeParse({ action: 'renew', ids: ['x'] })` is called
- **THEN** `success === false` with error on `action`

