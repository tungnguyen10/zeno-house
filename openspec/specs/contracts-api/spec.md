## Purpose

Server-side API for contracts. CRUD endpoints with Zod validation, auth guard, and 409 CONFLICT protection when a room already has an active contract.
## Requirements
### Requirement: List contracts endpoint
`GET /api/contracts` SHALL return a paginated list of contracts. Query params: `room_id` (optional UUID filter), `tenant_id` (optional UUID filter), `building_id` (optional UUID filter), `status` (optional, one of `active` | `expired` | `terminated`), `page` (default 1), `limit` (default 20). Response: `{ data: Contract[], meta: { total, page, limit, totalPages } }`. Requires authenticated session with admin or manager role.

#### Scenario: List all contracts
- **WHEN** admin calls GET /api/contracts
- **THEN** returns array of contracts with pagination meta

#### Scenario: Filter by room
- **WHEN** admin calls GET /api/contracts?room_id=<uuid>
- **THEN** returns only contracts for that room

#### Scenario: Filter by building
- **WHEN** admin calls GET /api/contracts?building_id=<uuid>
- **THEN** returns only contracts for that building

#### Scenario: Filter by status
- **WHEN** admin calls GET /api/contracts?status=active
- **THEN** returns only contracts with status 'active'

#### Scenario: Unauthenticated request
- **WHEN** request has no valid session
- **THEN** returns 401 UNAUTHENTICATED

### Requirement: Get contract by id endpoint
`GET /api/contracts/:identifier` SHALL accept either a UUID or a `contract_code` value as the path parameter. When `identifier` is not a UUID, the server SHALL look up by `contract_code` column. Returns a single contract including joined `room` (room_number, floor, building name) and `tenant` (full_name, phone). Returns 404 NOT_FOUND if not found.

#### Scenario: Contract found by UUID
- **WHEN** admin calls GET /api/contracts/:uuid with valid UUID
- **THEN** returns contract with nested room and tenant summary fields

#### Scenario: Contract found by code
- **WHEN** admin calls GET /api/contracts/hd-zhpn-2026-0001
- **THEN** returns contract with nested room and tenant summary fields

#### Scenario: Contract not found
- **WHEN** identifier matches neither UUID nor contract_code
- **THEN** returns 404 NOT_FOUND

### Requirement: Create contract endpoint
`POST /api/contracts` SHALL create a new contract together with its initial handover meter readings in a single atomic operation. Body validated with Zod: `room_id` (required UUID), `tenant_id` (required UUID), `start_date` (required date string YYYY-MM-DD), `end_date` (required date string YYYY-MM-DD, must be after start_date), `monthly_rent` (required number ≥ 0), `deposit` (optional number ≥ 0, default 0), `payment_day` (optional smallint 1–31, null means inherit from building), `status` (optional, default `active`), `notes` (optional string), **`handover_electricity_reading` (required number ≥ 0)**, **`handover_water_reading` (required number ≥ 0)**, **`handover_reading_date` (optional date string YYYY-MM-DD, defaults to `start_date`)**. When `building_id` is omitted, the service SHALL resolve it from `room_id` before persistence. The service SHALL persist all billing-critical terms accepted by the validator, including `payment_day`. The service SHALL additionally insert two `meter_readings` rows with `reading_type = 'handover_in'`, one for `meter_type = 'electricity'` and one for `meter_type = 'water'`, using the provided values, `handover_reading_date`, and the `period_year`/`period_month` derived from `handover_reading_date`. The contract insert and both reading inserts SHALL be performed inside a single database transaction; if any insert fails, all three are rolled back and the API SHALL NOT return 201. Returns 201 with created contract.

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

### Requirement: Renewal does not collect handover readings
`POST /api/contracts/:id/renew` SHALL NOT accept handover reading fields and SHALL NOT create `meter_readings` rows. Renewals continue an existing meter line.

#### Scenario: Renewal request ignores handover fields
- **WHEN** admin POSTs to `/api/contracts/:id/renew` with `handover_electricity_reading` in the body
- **THEN** the field is ignored and no `meter_readings` row is created for the renewal

### Requirement: Update contract endpoint
`PATCH /api/contracts/:id` SHALL update an existing contract. All fields optional (partial update). Business rule: if status changes to `active` and room already has another active contract, return 409 CONFLICT. Returns updated contract. Returns 404 if not found.

#### Scenario: Update success
- **WHEN** admin PATCHes valid partial data
- **THEN** returns updated contract

#### Scenario: Terminate contract
- **WHEN** admin PATCHes `{ status: 'terminated' }`
- **THEN** contract status updated to 'terminated'; returns updated contract

#### Scenario: Update non-existent contract
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND

### Requirement: Delete contract endpoint
`DELETE /api/contracts/:id` SHALL delete a contract. Returns 204 on success. Returns 404 if not found. If the deleted contract was active, the service SHALL set the associated room back to `available` unless the room is `maintenance`.

#### Scenario: Delete success
- **WHEN** admin DELETEs existing contract
- **THEN** contract removed, returns 204

#### Scenario: Delete non-existent
- **WHEN** id does not exist
- **THEN** returns 404 NOT_FOUND

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

### Requirement: Contract code generation uses building code
The server contract creation logic SHALL generate `contract_code` using the format `hd-{buildingCode}-{year}-{seq}`. The `buildingCode` SHALL be resolved from the contracted room's building. Sequence SHALL be scoped to `{buildingCode}-{year}` prefix.

#### Scenario: Code generated on create
- **WHEN** a contract is created for room in building with code `zhpn` and `start_date = 2026-09-01`
- **THEN** the generated `contract_code` is `hd-zhpn-2026-0001` (or next in sequence)

#### Scenario: Sequence scoped per building per year
- **WHEN** contracts exist for `zhpn` in 2026 up to `hd-zhpn-2026-0003`
- **THEN** the next contract for `zhpn` in 2026 gets `hd-zhpn-2026-0004`

#### Scenario: Different building gets independent sequence
- **WHEN** building `hnt` has no contracts in 2026
- **THEN** first contract for `hnt` in 2026 gets `hd-hnt-2026-0001` regardless of `zhpn` sequence

### Requirement: GET /api/contracts validates query with Zod
`server/api/contracts/index.get.ts` SHALL validate the incoming query with `contractListQuerySchema` (`page`, `limit`, `q?`, `building_id?`, `room_id?`, `tenant_id?`, `status?: ('active'|'expired'|'terminated'|'renewed')[]`, `sort?: 'start_date'|'end_date'|'created_at'|'monthly_rent'`, `order?: 'asc'|'desc'`). Invalid query SHALL yield `422 VALIDATION_ERROR`. The endpoint SHALL preserve the existing `{ data, meta }` envelope.

#### Scenario: Valid query passes
- **WHEN** authenticated user calls `GET /api/contracts?q=A101&status=active&sort=start_date&order=desc`
- **THEN** the request validates successfully and the service is invoked with parsed options

#### Scenario: Invalid sort field rejected
- **WHEN** request includes `?sort=secret`
- **THEN** response 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Invalid status value rejected
- **WHEN** request includes `?status=draft`
- **THEN** response 422 with `error.code === 'VALIDATION_ERROR'`

---

### Requirement: GET /api/contracts supports search, sort, and multi-status filter
`server/api/contracts/index.get.ts` SHALL accept query params `q`, `sort`, `order`, `status[]` in addition to existing `building_id`, `room_id`, `tenant_id`, `page`, `limit`. When `status` is omitted, results SHALL include all statuses (default order: `created_at desc`). Search `q` SHALL match `contract_code` or the joined `tenants.full_name` / `rooms.room_number` (case-insensitive).

#### Scenario: Search across contract_code, tenant name, room number
- **WHEN** authenticated user calls `GET /api/contracts?q=nguyen`
- **THEN** response includes contracts whose `contract_code`, primary tenant `full_name`, or room `room_number` contains "nguyen"

#### Scenario: Multi-status filter
- **WHEN** authenticated user calls `GET /api/contracts?status=active&status=expired`
- **THEN** response includes contracts with either status

#### Scenario: Default includes all statuses
- **WHEN** authenticated user calls `GET /api/contracts` with no `status` param
- **THEN** response includes contracts of all statuses (active, expired, terminated, renewed)

#### Scenario: Sort by start_date descending
- **WHEN** authenticated user calls `GET /api/contracts?sort=start_date&order=desc`
- **THEN** response data is ordered by `start_date` descending

#### Scenario: Combined filters and pagination
- **WHEN** request is `GET /api/contracts?building_id=<uuid>&q=A&status=active&sort=start_date&order=desc&page=2&limit=10`
- **THEN** response data is the second page of 10 results matching all filters

---

### Requirement: DELETE /api/contracts/:id performs safe-delete with conflict matrix
`server/api/contracts/[id].delete.ts` SHALL by default check for blocking references before deleting:
1. If contract `status='active'`: 409 with `error.details === { reason: 'ACTIVE_CONTRACT' }`.
2. If contract has any `billing_periods` referencing it (issued or higher): 409 with `error.details.issuedBillingPeriods: number`.
3. If contract has any `invoices` with status `paid` or `partial`: 409 with `error.details.paidPayments: number`.
4. If contract has any `meter_readings` of type other than `handover_in` / `handover_out`: 409 with `error.details.nonHandoverMeterReadings: number`.

If all checks pass, the endpoint SHALL cascade-delete sub-resources (occupants, payments, renewals, contract_services, handover meter readings) then delete the contract row and respond `204`. The response body for any 409 SHALL include `error.code === 'CONFLICT'` and an aggregated `error.details` object combining all violated checks.

#### Scenario: Conflict response when contract is active
- **WHEN** admin sends DELETE on a contract with `status='active'`
- **THEN** response is 409 with `error.code === 'CONFLICT'` and `error.details.reason === 'ACTIVE_CONTRACT'`

#### Scenario: Conflict response when issued billing periods exist
- **WHEN** admin sends DELETE on a terminated contract that has 2 billing periods referencing it
- **THEN** response is 409 with `error.details.issuedBillingPeriods === 2`

#### Scenario: Conflict response when paid invoices exist
- **WHEN** admin sends DELETE on a terminated contract with 1 paid invoice
- **THEN** response is 409 with `error.details.paidPayments === 1`

#### Scenario: Conflict response when non-handover meter readings exist
- **WHEN** admin sends DELETE on a terminated contract with 3 monthly meter readings
- **THEN** response is 409 with `error.details.nonHandoverMeterReadings === 3`

#### Scenario: Aggregate conflict response
- **WHEN** admin sends DELETE on a contract violating multiple checks
- **THEN** response is 409 with `error.details` containing all violated counts in one object

#### Scenario: Successful hard-delete when no blockers
- **WHEN** admin sends DELETE on a never-active contract with 0 billing periods, 0 paid invoices, and only handover readings
- **THEN** response is 204; the contract row plus its sub-resources are removed from the database

---

### Requirement: DELETE /api/contracts/:id supports force soft-delete
`server/api/contracts/[id].delete.ts` SHALL accept query param `?force=true`. When present and the caller is admin, the endpoint SHALL:
- If status `active`, terminate it first (set `status='terminated'`, release room + tenant) via the existing terminate logic.
- Skip the active-contract check (#1) but STILL enforce checks #2, #3, #4 (billing, payment, meter-reading history is never destroyed).
- If checks pass, hard-delete the contract row and cascade-clean safe-deletable sub-resources, returning `200` with `{ data: Contract }` (the terminated contract before delete).

#### Scenario: Force terminates then deletes contract with no billing
- **WHEN** admin sends DELETE `/api/contracts/:id?force=true` on an active contract with no billing history
- **THEN** the contract is terminated, then deleted; response is 200 with `{ data }` containing the terminated DTO

#### Scenario: Force still blocked by billing
- **WHEN** admin sends DELETE `/api/contracts/:id?force=true` on an active contract with 1 issued billing period
- **THEN** response is 409 with `error.details.issuedBillingPeriods === 1` (terminate may have run, but delete is blocked)

#### Scenario: Manager cannot force
- **WHEN** user with role `manager` sends DELETE with `?force=true`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

---

### Requirement: POST /api/contracts/bulk performs bulk action with per-item result
`server/api/contracts/bulk.post.ts` SHALL require admin auth, validate body with `contractBulkActionSchema` (`{ action: 'terminate' | 'delete', ids: string[], reason?: string }`), iterate over the IDs applying the action via the service, and return `{ data: { succeeded: string[], failed: { id: string, reason: string }[] } }` with status 200. The endpoint SHALL NOT short-circuit on first failure.

#### Scenario: Bulk terminate
- **WHEN** admin posts `{ action: 'terminate', ids: ['a','b'] }` for 2 active contracts
- **THEN** both contracts become `status='terminated'`, rooms and tenants are released, response is `{ data: { succeeded: ['a','b'], failed: [] } }`

#### Scenario: Bulk delete with mixed results
- **WHEN** admin posts `{ action: 'delete', ids: ['empty','with-billing','active'] }`
- **THEN** response is `{ data: { succeeded: ['empty'], failed: [{ id:'with-billing', reason:'has_billing_history' }, { id:'active', reason:'ACTIVE_CONTRACT' }] } }`

#### Scenario: Manager forbidden
- **WHEN** user with role `manager` posts to `/api/contracts/bulk`
- **THEN** response is 403 with `error.code === 'FORBIDDEN'`

#### Scenario: Validation error on empty ids
- **WHEN** body is `{ action: 'terminate', ids: [] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'`

#### Scenario: Invalid action rejected
- **WHEN** body is `{ action: 'renew', ids: ['a'] }`
- **THEN** response is 422 with `error.code === 'VALIDATION_ERROR'`

---

### Requirement: Contracts service supports filter/sort/bulk/safe-delete
`server/services/contracts/index.ts` SHALL expose:
- `list(event, user, opts)` accepting `{ page, limit, q?, building_id?, room_id?, tenant_id?, status?, sort?, order? }` and forwarding to repository.
- `remove(event, user, id, { force })` performing the conflict matrix check; when `force`, terminate-then-delete with billing/payment/meter history still enforced.
- `bulkAction(event, user, { action, ids })` iterating per item, catching errors, returning `{ succeeded, failed }`.
Each method SHALL re-check permissions using `can(user, capability)`.

#### Scenario: list forwards filters to repository
- **WHEN** `ContractService.list(event, user, { q:'x', status:['active'], sort:'start_date' })` is called
- **THEN** repository `findAll` receives the same filter options

#### Scenario: remove enforces conflict matrix
- **WHEN** `ContractService.remove(event, user, id, { force: false })` is called on a contract with paid invoices
- **THEN** the service throws CONFLICT with `paidPayments` in details

#### Scenario: bulkAction continues past per-item failures
- **WHEN** `ContractService.bulkAction(event, user, { action:'delete', ids:['a','b'] })` and `a` throws conflict
- **THEN** result includes `a` in failed with reason and `b` is still attempted

---

### Requirement: Contracts repository supports search, sort, and counts
`server/repositories/contracts/index.ts` SHALL extend:
- `findAll({ page, limit, q?, building_id?, room_id?, tenant_id?, status?, sort?, order? })` builds a Supabase query with `ilike` for `q` on `contract_code` and via foreign-table on `tenants.full_name` and `rooms.room_number`, `in` filter for `status`, `order` clause for the chosen sort field.
- `countBillingPeriodsForContract(id)` returns the number of billing_periods referencing the contract.
- `countPaidInvoicesForContract(id)` returns the number of invoices with `status` in `('paid','partial')`.
- `countNonHandoverMeterReadingsForContract(id)` returns the number of meter_readings not of type `handover_in` or `handover_out`.

#### Scenario: findAll applies ilike across joined fields
- **WHEN** `findAll({ q: 'nguy' })` is called
- **THEN** the Supabase query uses an `.or()` clause covering `contract_code.ilike.%nguy%` and foreign-table filters for `tenants.full_name.ilike.*` and `rooms.room_number.ilike.*`

#### Scenario: countBillingPeriodsForContract returns count
- **WHEN** contract has 3 billing_periods referencing it
- **THEN** the count returns `3`

#### Scenario: countNonHandoverMeterReadingsForContract excludes handover types
- **WHEN** contract has 2 handover readings and 5 monthly readings
- **THEN** the count returns `5`

#### Scenario: countPaidInvoicesForContract handles zero
- **WHEN** contract has no paid invoices
- **THEN** the count returns `0`

### Requirement: contracts-api - mutation audit
Contract service mutation methods SHALL write audit events to `audit_events`.

#### Scenario: ContractService mutations emit audit events
- **WHEN** any mutation method on `ContractService` is called
- **THEN** an audit event is written to `audit_events`
