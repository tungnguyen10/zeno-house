## ADDED Requirements

### Requirement: Pending approval tenant lookup is complete
The approval UI SHALL provide server-backed searchable tenant selection and SHALL not limit tenant approval to the first fixed page of tenant records. Linked tenants SHALL remain unavailable.

#### Scenario: Tenant is outside first page
- **WHEN** admin searches for an unlinked tenant outside the first 100 records
- **THEN** that tenant can be selected for approval

### Requirement: Access-request creation audit has stable attribution
The one-time access-request creation audit SHALL attribute the event to the requesting Auth identity or to an explicit system actor, never to whichever operator first lists the request.

#### Scenario: Admin observes request first
- **WHEN** admin list access causes a missing creation audit to be materialized
- **THEN** the creation event actor remains the requesting identity or system, not the admin
