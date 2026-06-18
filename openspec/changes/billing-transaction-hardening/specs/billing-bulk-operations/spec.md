## ADDED Requirements

### Requirement: Bulk payment rollback is guaranteed by persistence layer
Bulk payment recording SHALL rely on a persistence-layer transaction or equivalent database-atomic mechanism rather than best-effort service rollback.

#### Scenario: Later row fails after earlier row attempted
- **WHEN** a later payment row in a bulk request fails after earlier rows were attempted
- **THEN** the persistence layer rolls back all rows in the batch and the API returns the failed index/reason

#### Scenario: Rollback failure is not user-visible as partial success
- **WHEN** the bulk payment operation fails
- **THEN** the user never sees a partial success state for that batch
