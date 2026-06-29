## ADDED Requirements

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
