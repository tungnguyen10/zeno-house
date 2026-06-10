## MODIFIED Requirements

### Requirement: Handover readings section in contract detail
The contract detail page SHALL include a "Số bàn giao" section showing handover meter readings (electricity + water) for the contracted room. Handover readings are contract lifecycle data used for onboarding/offboarding and first-month billing fallback; they are not the monthly meter reading workflow.

#### Scenario: Section always shows two rows
- **WHEN** navigating to `/contracts/:id`
- **THEN** section shows one row for electricity and one for water, regardless of whether readings exist yet

#### Scenario: Save handover-in reading
- **WHEN** admin enters a value and blurs the input
- **THEN** system creates/updates a `meter_readings` row with `reading_type = 'handover_in'`, `room_id`, `meter_type`, and the contract start month

#### Scenario: Handover-out readings
- **WHEN** contract status is `terminated` or `expired`
- **THEN** section also shows handover_out row per meter type

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

