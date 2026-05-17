## MODIFIED Requirements

### Requirement: Create contract
POST /api/contracts SHALL create a new contract with validated input. When status is `active` (or status is omitted), the API SHALL additionally verify:
1. No other active contract exists for the same room
2. The primary tenant (`tenant_id`) is not already standing as primary on another active contract
3. The primary tenant is not currently an active occupant (no move_out_date) in another contract

#### Scenario: Create success
- **WHEN** admin posts valid contract data and tenant has no active occupancy elsewhere
- **THEN** contract is created and returned

#### Scenario: Room already has active contract
- **WHEN** admin posts room_id that already has an active contract
- **THEN** CONFLICT error returned: "Phòng này đã có hợp đồng đang hiệu lực"

#### Scenario: Tenant already primary on another contract
- **WHEN** admin posts tenant_id that is already tenant_id of another active contract
- **THEN** CONFLICT error returned: "Khách thuê này đang đứng tên hợp đồng tại phòng khác"

#### Scenario: Tenant already active occupant elsewhere
- **WHEN** admin posts tenant_id that is currently an active occupant in another contract
- **THEN** CONFLICT error returned: "Khách thuê này đang ở theo hợp đồng khác"
