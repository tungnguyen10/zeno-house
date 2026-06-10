## MODIFIED Requirements

### Requirement: Create contract endpoint
`POST /api/contracts` SHALL create a new contract and persist all billing-critical terms accepted by the validator, including `payment_day`. When `building_id` is omitted, the service SHALL resolve it from `room_id` before persistence.

#### Scenario: Create with payment_day
- **WHEN** admin POSTs valid contract data with `payment_day: 5`
- **THEN** returns 201 with created contract whose `paymentDay` is 5

#### Scenario: Create without building_id
- **WHEN** admin POSTs valid contract data without `building_id`
- **THEN** the created contract stores the selected room's `building_id`

### Requirement: Delete contract endpoint
`DELETE /api/contracts/:id` SHALL delete a contract. If the deleted contract was active, the service SHALL set the associated room back to `available` unless the room is `maintenance`.

#### Scenario: Delete active contract releases room
- **WHEN** admin deletes an active contract for an occupied room
- **THEN** the contract is removed
- **AND** the room status becomes `available`

#### Scenario: Delete inactive contract does not alter active occupancy
- **WHEN** admin deletes an expired, terminated, or renewed contract
- **THEN** room status is not changed solely because of that delete

### Requirement: Update contract endpoint keeps room status consistent
`PATCH /api/contracts/:id` SHALL update contract fields and SHALL keep the associated room's `status` consistent with the contract's effective room and effective active state, in both directions. The service SHALL release the previous room and SHALL claim the new effective room as needed, except when either room is `maintenance`.

#### Scenario: Reactivation re-occupies the room
- **WHEN** admin updates a contract from `expired` or `terminated` to `active`
- **THEN** the contract's room is set to `occupied` unless the room is `maintenance`

#### Scenario: Active termination releases the room
- **WHEN** admin updates a contract from `active` to `expired` or `terminated`
- **THEN** the contract's room is set to `available` unless the room is `maintenance`

#### Scenario: Room reassignment on active contract releases old and claims new
- **WHEN** admin updates an `active` contract's `room_id` to a different room while remaining `active`
- **THEN** the previous room is set to `available` (unless `maintenance`)
- **AND** the new room is set to `occupied` (unless `maintenance`)

#### Scenario: Editing an already inactive contract does not change room status
- **WHEN** admin edits an already `expired`, `terminated`, or `renewed` contract without changing its status or room
- **THEN** the room's status is not changed

#### Scenario: Conflict guard on reactivation
- **WHEN** admin attempts to transition a contract to `active` for a room that already has another active contract
- **THEN** the request fails with 409 `CONFLICT` and the room status is not changed

### Requirement: Room is the canonical source of monthly rent
`POST /api/contracts` SHALL treat `rooms.monthly_rent` as the canonical price source. When the request body's `monthly_rent` is missing, zero, or otherwise non-positive, the service SHALL substitute `rooms.monthly_rent`. When the request body's `monthly_rent` is a positive number, it SHALL be persisted as a per-contract snapshot and SHALL NOT propagate back to the room.

#### Scenario: Fallback to room rent when input is zero
- **WHEN** admin POSTs a contract with `monthly_rent: 0` for a room whose `monthly_rent` is `4500000`
- **THEN** the created contract's `monthly_rent` is `4500000`

#### Scenario: Explicit override is preserved
- **WHEN** admin POSTs a contract with `monthly_rent: 4000000` for a room whose `monthly_rent` is `4500000`
- **THEN** the created contract's `monthly_rent` is `4000000`
- **AND** the room's `monthly_rent` remains `4500000`

#### Scenario: Refuse creation when both rents are zero
- **WHEN** admin POSTs a contract with `monthly_rent: 0` for a room whose `monthly_rent` is also `0`
- **THEN** the request fails with 409 `CONFLICT`
- **AND** the error message instructs the operator to set the room price first

### Requirement: Contract renewal via new contract
The system SHALL support creating a successor contract when terms change significantly. The old contract is marked `renewed`. The successor contract SHALL preserve billing-critical context required for the next monthly billing period. The renewal operation SHALL respect the database-level constraint `contracts_one_active_per_room` (at most one `active` contract per room) by flipping the old contract out of `active` BEFORE inserting the successor.

#### Scenario: Full renewal carries contract services
- **WHEN** admin renews with mode `new_contract`
- **THEN** enabled and disabled contract services from the old contract are copied to the successor contract with amount, quantity, enabled state, notes, and catalog references

#### Scenario: Full renewal carries active occupants
- **WHEN** admin renews with mode `new_contract`
- **THEN** active occupants from the old contract are copied to the successor contract with billing-counted state

#### Scenario: Full renewal does not copy payments
- **WHEN** admin renews with mode `new_contract`
- **THEN** deposit, prepaid rent, rent, and other historical payments are not copied to the successor contract

#### Scenario: Renewal respects one-active-per-room constraint
- **WHEN** admin renews an `active` contract with mode `new_contract` for room R
- **THEN** the old contract is first updated to `renewed` so it leaves the `active` set for room R
- **AND** the successor contract is then inserted as `active` for room R without violating `contracts_one_active_per_room`

#### Scenario: Successor insert failure rolls back old contract
- **WHEN** the successor contract insert fails after the old contract has already been flipped to `renewed`
- **THEN** the service restores the old contract back to `active` so the room is not left without an active contract
- **AND** the operation surfaces an error response

### Requirement: Renewal log row stays consistent with contract state
The system SHALL ensure `contract_renewals` log rows and the parent contract's `renewal_count` move together. Every successful renewal SHALL produce exactly one `contract_renewals` row whose `created_by` matches the acting admin's `auth.users.id`. A failed renewal SHALL NOT leave the parent contract with a bumped `renewal_count` and no matching log row.

#### Scenario: Extend mode writes log before mutating contract
- **WHEN** admin renews with mode `extend`
- **THEN** the service inserts the `contract_renewals` row first
- **AND** only then updates the contract's `end_date`, `original_end_date`, `renewal_count`, and optional `monthly_rent`
- **AND** if the contract UPDATE fails after the log was inserted, the service deletes the orphan log row so the renewal history never overstates the count

#### Scenario: Server-side auth normalization populates created_by
- **WHEN** any authenticated admin renews a contract
- **THEN** the server resolves the acting user from the JWT claim payload (where the id lives on `sub`) and exposes it as `user.id`
- **AND** the `contract_renewals` insert SHALL include a non-null `created_by` matching that id
- **AND** the request SHALL NOT fail with a `null value in column "created_by"` NOT NULL violation

### Requirement: Renewal log writes use server trust
The system SHALL persist `contract_renewals` rows from the server using the service-role client, because authorization is already verified at the service entry via the `contracts.update` capability check. Table-level RLS on `contract_renewals` SHALL remain strict (admin-only write) as defense-in-depth against any direct client access.

#### Scenario: Repository insert bypasses user-bound RLS
- **WHEN** the renewal service writes a log row
- **THEN** the repository uses the service-role Supabase client (not the user-bound client)
- **AND** the operation SHALL succeed even when the user's JWT claims do not match `contract_renewals` RLS policies

#### Scenario: Repository rollback bypasses user-bound RLS
- **WHEN** the renewal service rolls back a log row after a follow-up contract mutation fails
- **THEN** the repository deletes the log row using the service-role Supabase client
- **AND** the rollback SHALL be best-effort: a rollback failure SHALL be logged but SHALL NOT mask the original error returned to the caller

