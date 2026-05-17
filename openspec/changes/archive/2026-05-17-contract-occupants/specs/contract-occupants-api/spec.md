## ADDED Requirements

### Requirement: List occupants of a contract
The API SHALL provide an endpoint to list all occupants of a contract, ordered by move_in_date ascending. Each occupant record SHALL include tenant name and phone (joined from tenants table).

#### Scenario: Admin lists occupants
- **WHEN** admin calls GET /api/contracts/:id/occupants
- **THEN** all occupant records for the contract are returned with tenant name and phone

#### Scenario: Manager lists occupants
- **WHEN** manager calls GET /api/contracts/:id/occupants
- **THEN** occupants are returned (read-only access)

#### Scenario: Contract not found
- **WHEN** contract id does not exist
- **THEN** NOT_FOUND error returned

### Requirement: Add occupant to a contract
The API SHALL allow adding a new roommate occupant to a contract. Role is always `roommate` — the primary tenant is determined by `contracts.tenant_id` and cannot be set via this endpoint. The API SHALL enforce single active occupancy per tenant across all contracts.

#### Scenario: Add roommate
- **WHEN** admin posts a valid occupant payload (tenant_id, move_in_date, billing_counted)
- **THEN** occupant record created with role='roommate' and returned with tenant name and phone

#### Scenario: Tenant is the contract primary tenant
- **WHEN** admin posts tenant_id that matches the contract's own tenant_id
- **THEN** CONFLICT error returned: "Người thuê chính đã là đại diện hợp đồng"

#### Scenario: Tenant already primary on another active contract
- **WHEN** admin posts tenant_id that is tenant_id of another active contract
- **THEN** CONFLICT error returned: "Đang đứng tên hợp đồng tại phòng khác"

#### Scenario: Tenant already active occupant in another contract
- **WHEN** admin posts tenant_id that has no move_out_date in another contract's occupants
- **THEN** CONFLICT error returned: "Đang ở theo hợp đồng khác"

#### Scenario: Duplicate active occupant in same contract
- **WHEN** admin posts tenant_id already in this contract's active occupants
- **THEN** CONFLICT error returned

### Requirement: Active occupancy uniqueness enforced at DB level
The database SHALL enforce a partial unique index on `contract_occupants(tenant_id) WHERE move_out_date IS NULL`, ensuring atomic uniqueness even under concurrent requests.

#### Scenario: Concurrent add rejected
- **WHEN** two concurrent requests attempt to add the same tenant to different contracts
- **THEN** the database rejects the second insert with a unique constraint violation

### Requirement: Record move-out for an occupant
The API SHALL allow setting a move_out_date on an occupant record. Only admin can perform this action. Once moved out, the tenant is free to be added to another contract.

#### Scenario: Move-out recorded
- **WHEN** admin patches /api/contracts/:id/occupants/:occupantId with move_out_date
- **THEN** occupant record updated with the provided move_out_date

#### Scenario: Already moved out
- **WHEN** admin sets move_out_date on an occupant that already has move_out_date
- **THEN** update is allowed (admin can correct the date)

### Requirement: Delete occupant record
The API SHALL allow admin to delete an occupant record permanently (for data correction). Manager cannot delete.

#### Scenario: Admin deletes occupant
- **WHEN** admin calls DELETE /api/contracts/:id/occupants/:occupantId
- **THEN** record is deleted and 204 returned

#### Scenario: Manager cannot delete
- **WHEN** manager calls DELETE /api/contracts/:id/occupants/:occupantId
- **THEN** FORBIDDEN error returned

