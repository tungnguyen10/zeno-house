## MODIFIED Requirements

### Requirement: Draft charges API
The API SHALL provide server-authoritative draft invoice previews before issue and SHALL make the same scoped calculation available to the AI read tool with a deterministic derived explanation.

#### Scenario: Draft charges requested
- **WHEN** the workspace or AI tool requests draft charges for an accessible period
- **THEN** the API returns per-contract draft invoices with line items, totals, warnings, and blockers

#### Scenario: AI explanation requested
- **WHEN** the AI tool receives the draft response
- **THEN** it derives summary counts, totals, blocker/warning groups, and next-step categories from the server response without recalculating charge amounts

#### Scenario: Utility override used
- **WHEN** a period-scoped utility usage override exists for a room and meter type
- **THEN** the draft charge uses the override billable usage and includes override metadata

#### Scenario: Unsupported tiered electricity
- **WHEN** a building uses tiered electricity pricing
- **THEN** the API returns a blocker instead of silently calculating electricity charges

### Requirement: Billing audit — meter readings coverage
The billing API SHALL capture meter reading saves as billing audit events. `MeterReadingService.create`, `bulkCreate`, and `update` SHALL persist each reading change and its corresponding `reading.saved` audit event in the same database transaction.

#### Scenario: Save meter reading emits audit event
- **WHEN** a meter reading is saved by `MeterReadingService`
- **THEN** the committed `reading.saved` audit event includes `entity_type: 'meter_reading'`, the reading ID, nullable matching billing period ID, before/after snapshots, and `metadata.count: 1`

#### Scenario: Audit persistence fails
- **WHEN** the transaction cannot insert a required `reading.saved` audit event
- **THEN** its reading mutation and every other row in the same batch are rolled back

## ADDED Requirements

### Requirement: Utility usage override writes are atomic, locked, and versioned
The billing service SHALL persist utility usage override saves and their audit events atomically, SHALL compare the expected existing override version or absence, and SHALL reject override mutations for a closed period or a room with a non-void invoice in that period.

#### Scenario: New override is saved
- **WHEN** an authorized direct API or confirmed AI action saves an override where no override was expected and the room is editable
- **THEN** the override and one `utility_override.saved` audit event commit together

#### Scenario: Existing override is updated
- **WHEN** the caller supplies the current override `updated_at` version
- **THEN** the override and its before/after audit snapshot update atomically

#### Scenario: Override version is stale
- **WHEN** the stored override is absent or has a different version than expected
- **THEN** the service returns 409 CONFLICT and persists no override or audit change

#### Scenario: Override is billing-locked
- **WHEN** the period is closed or the room has a non-void invoice in that period
- **THEN** save and delete paths reject the mutation and preserve existing billing data
