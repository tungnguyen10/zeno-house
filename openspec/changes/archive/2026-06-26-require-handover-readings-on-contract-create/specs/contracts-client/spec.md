## MODIFIED Requirements

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
