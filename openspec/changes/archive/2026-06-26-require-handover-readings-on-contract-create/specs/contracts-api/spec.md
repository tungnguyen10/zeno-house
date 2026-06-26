## MODIFIED Requirements

### Requirement: Create contract endpoint
`POST /api/contracts` SHALL create a new contract together with its initial handover meter readings in a single atomic operation. Body validated with Zod: `room_id` (required UUID), `tenant_id` (required UUID), `start_date` (required date string YYYY-MM-DD), `end_date` (required date string YYYY-MM-DD, must be after start_date), `monthly_rent` (required number ≥ 0), `deposit` (optional number ≥ 0, default 0), `payment_day` (optional smallint 1–31, null means inherit from building), `status` (optional, default `active`), `notes` (optional string), **`handover_electricity_reading` (required number ≥ 0)**, **`handover_water_reading` (required number ≥ 0)**, **`handover_reading_date` (optional date string YYYY-MM-DD, defaults to `start_date`)**. When `building_id` is omitted, the service SHALL resolve it from `room_id` before persistence. The service SHALL persist all billing-critical terms accepted by the validator, including `payment_day`. The service SHALL additionally insert two `meter_readings` rows with `reading_type = 'handover_in'`, one for `meter_type = 'electricity'` and one for `meter_type = 'water'`, using the provided values, `handover_reading_date`, and the `period_year`/`period_month` derived from `handover_reading_date`. The contract insert and both reading inserts SHALL be performed inside a single database transaction; if any insert fails, all three are rolled back and the API SHALL NOT return 201. Returns 201 with the created contract.

When status is `active` (or omitted), the API SHALL additionally verify:
1. No other active contract exists for the same room
2. The primary tenant (`tenant_id`) is not already standing as primary on another active contract
3. The primary tenant is not currently an active occupant (no `move_out_date`) in another contract

#### Scenario: Create success
- **WHEN** admin POSTs valid contract data including handover readings and tenant has no active occupancy elsewhere
- **THEN** returns 201 with created contract
- **AND** two `meter_readings` rows exist for the room with `reading_type = 'handover_in'` (one electricity, one water) carrying the submitted values

#### Scenario: Create with payment_day
- **WHEN** admin POSTs valid contract data with `payment_day: 5`
- **THEN** returns 201 with created contract whose `paymentDay` is 5

#### Scenario: Create without building_id
- **WHEN** admin POSTs valid contract data without `building_id`
- **THEN** the created contract stores the selected room's `building_id`

#### Scenario: Missing handover readings
- **WHEN** admin POSTs without `handover_electricity_reading` or `handover_water_reading`
- **THEN** returns 422 VALIDATION_ERROR with field details
- **AND** no contract row is created

#### Scenario: Handover reading date defaults to start_date
- **WHEN** admin POSTs valid contract data without `handover_reading_date`
- **THEN** the two `meter_readings` rows are persisted with `reading_date = start_date`

#### Scenario: Handover reading insert fails — full rollback
- **WHEN** the contract insert succeeds but a meter reading insert fails (e.g. unique conflict on `(room_id, meter_type, period_year, period_month, reading_type)`)
- **THEN** returns 409 CONFLICT
- **AND** no contract row remains and no partial meter reading row remains

#### Scenario: Missing required fields
- **WHEN** admin POSTs without room_id, tenant_id, start_date, end_date, or monthly_rent
- **THEN** returns 422 VALIDATION_ERROR with field details

#### Scenario: end_date before start_date
- **WHEN** admin POSTs with end_date ≤ start_date
- **THEN** returns 422 VALIDATION_ERROR

#### Scenario: Room already has active contract
- **WHEN** admin POSTs for a room that already has status='active' contract
- **THEN** returns 409 CONFLICT: "Phòng này đã có hợp đồng đang hiệu lực"

#### Scenario: Tenant already primary on another contract
- **WHEN** admin POSTs tenant_id that is already tenant_id of another active contract
- **THEN** returns 409 CONFLICT: "Khách thuê này đang đứng tên hợp đồng tại phòng khác"

#### Scenario: Tenant already active occupant elsewhere
- **WHEN** admin POSTs tenant_id that is currently an active occupant in another contract
- **THEN** returns 409 CONFLICT: "Khách thuê này đang ở theo hợp đồng khác"

## ADDED Requirements

### Requirement: Renewal does not collect handover readings
`POST /api/contracts/:id/renew` SHALL NOT accept handover reading fields and SHALL NOT create `meter_readings` rows. Renewals continue an existing meter line.

#### Scenario: Renewal request ignores handover fields
- **WHEN** admin POSTs to `/api/contracts/:id/renew` with `handover_electricity_reading` in the body
- **THEN** the field is ignored and no `meter_readings` row is created for the renewal
