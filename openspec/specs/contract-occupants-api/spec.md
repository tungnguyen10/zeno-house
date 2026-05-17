## Purpose

Server-side API for managing contract occupants (roommates). Nested under `/api/contracts/:id/occupants`. Enforces single active occupancy per tenant across all contracts via service-layer guards and a DB partial unique index.

## Requirements

### Requirement: List occupants of a contract
`GET /api/contracts/:id/occupants` SHALL return all occupant records for the contract, ordered by `move_in_date` ascending. Each record includes tenant name and phone joined from the `tenants` table.

#### Scenario: Admin lists occupants
- **WHEN** admin calls GET /api/contracts/:id/occupants
- **THEN** all occupant records returned with tenantName and tenantPhone

#### Scenario: Manager lists occupants
- **WHEN** manager calls GET /api/contracts/:id/occupants
- **THEN** occupants returned (read-only access)

#### Scenario: Contract not found
- **WHEN** contract id does not exist
- **THEN** NOT_FOUND error returned

### Requirement: Add occupant to a contract
`POST /api/contracts/:id/occupants` SHALL create a new roommate occupant. Role is always `roommate` — the primary tenant is determined by `contracts.tenant_id` and cannot be added via this endpoint. Requires `contracts.update` permission.

The API SHALL enforce single active occupancy per tenant:
1. `tenant_id` cannot match the contract's own `tenant_id`
2. Tenant cannot be the primary tenant on any other active contract
3. Tenant cannot be an active occupant (no `move_out_date`) in any other contract
4. Tenant cannot already be an active occupant in this same contract

#### Scenario: Add roommate success
- **WHEN** admin POSTs a valid occupant payload (tenant_id, move_in_date, billing_counted)
- **THEN** occupant created with role='roommate', returned with tenantName and tenantPhone

#### Scenario: Tenant is the contract's primary tenant
- **WHEN** admin POSTs tenant_id matching the contract's own tenant_id
- **THEN** 409 CONFLICT: "Người thuê chính đã là đại diện hợp đồng"

#### Scenario: Tenant already primary on another active contract
- **WHEN** admin POSTs tenant_id that is tenant_id of another active contract
- **THEN** 409 CONFLICT: "Đang đứng tên hợp đồng tại phòng khác"

#### Scenario: Tenant already active occupant in another contract
- **WHEN** admin POSTs tenant_id with no move_out_date in another contract's occupants
- **THEN** 409 CONFLICT: "Đang ở theo hợp đồng khác"

#### Scenario: Duplicate active occupant in same contract
- **WHEN** admin POSTs tenant_id already active in this contract's occupants
- **THEN** 409 CONFLICT returned

### Requirement: Active occupancy uniqueness enforced at DB level
A partial unique index `contract_occupants_active_tenant_unique ON contract_occupants(tenant_id) WHERE move_out_date IS NULL` ensures atomic uniqueness even under concurrent requests.

#### Scenario: Concurrent add rejected
- **WHEN** two concurrent requests attempt to add the same tenant to different contracts
- **THEN** the database rejects the second insert with a unique constraint violation

### Requirement: Record move-out for an occupant
`PATCH /api/contracts/:id/occupants/:occupantId` SHALL set a `move_out_date` on an occupant record. Requires `contracts.delete` permission (admin only). Once moved out the tenant is free to be added to another contract.

#### Scenario: Move-out recorded
- **WHEN** admin PATCHes with a valid move_out_date
- **THEN** occupant record updated with the provided move_out_date

#### Scenario: Correct existing move-out date
- **WHEN** admin PATCHes an occupant that already has move_out_date
- **THEN** update is allowed (admin can correct the date)

### Requirement: Delete occupant record
`DELETE /api/contracts/:id/occupants/:occupantId` SHALL permanently delete an occupant record (for data correction). Returns 204. Requires `contracts.delete` permission (admin only).

#### Scenario: Admin deletes occupant
- **WHEN** admin calls DELETE on a valid occupantId
- **THEN** record deleted, 204 returned

#### Scenario: Manager cannot delete
- **WHEN** manager calls DELETE
- **THEN** 403 FORBIDDEN returned
