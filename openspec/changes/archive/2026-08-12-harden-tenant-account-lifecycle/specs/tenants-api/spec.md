## MODIFIED Requirements

### Requirement: DELETE /api/tenants/:id performs safe-delete with conflict check
`server/api/tenants/[id].delete.ts` SHALL check blocking references before hard-delete. If the tenant has any portal account link, active primary contract, or active occupancy, the endpoint SHALL respond `409 CONFLICT` with blocker counts. A linked account SHALL be explicitly revoked before tenant hard-delete so cascade cannot create an orphan Auth identity. If no blockers exist, the tenant SHALL be hard-deleted and the endpoint SHALL respond `204`.

#### Scenario: Conflict response when portal account exists
- **WHEN** an operator deletes a tenant with a `tenant_user_links` row
- **THEN** the response is 409 and identifies the portal account blocker

#### Scenario: Conflict response when active contract exists
- **WHEN** admin deletes a tenant who is primary on one active contract
- **THEN** the response is 409 with the active-contract count

#### Scenario: Conflict response when active occupant exists
- **WHEN** admin deletes a tenant who has one active occupancy
- **THEN** the response is 409 with the active-occupancy count

#### Scenario: Successful hard-delete without blockers
- **WHEN** admin deletes a tenant with no portal account, active contract, or active occupancy
- **THEN** the tenant row is removed and the response is 204
