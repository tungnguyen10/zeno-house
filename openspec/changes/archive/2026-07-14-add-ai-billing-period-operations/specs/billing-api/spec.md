## MODIFIED Requirements

### Requirement: Open or get billing period
The API SHALL open or retrieve a billing period by building and `YYYY-MM`, SHALL commit a newly created period and its `period.opened` audit event atomically, and SHALL treat retries or concurrent opens as an idempotent retrieval of the authoritative period.

#### Scenario: Period exists
- **WHEN** the API receives building_id and period for an existing period
- **THEN** it returns the existing billing period without appending another opened audit event

#### Scenario: Period does not exist
- **WHEN** the API receives building_id and period for a new period
- **THEN** it atomically creates a draft billing period and exactly one `period.opened` audit event

#### Scenario: Concurrent period opens
- **WHEN** two authorized requests open the same building, year, and month concurrently
- **THEN** both resolve to one authoritative period and no duplicate audit event is created

#### Scenario: Audit insert fails
- **WHEN** the creation audit cannot be inserted in the transaction
- **THEN** the new billing period is rolled back and the operation fails without partial success
