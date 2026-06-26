## ADDED Requirements

### Requirement: Billing actor display enrichment
Billing read DTOs SHALL resolve billing actor and payment recorder display values when user display data is available.

#### Scenario: Audit actor name resolved
- **WHEN** an audit event has an actor id that exists in the configured user display source
- **THEN** the audit DTO includes `actorName` and `actorEmail` for UI rendering

#### Scenario: Payment recorder name resolved
- **WHEN** an invoice payment has a recorded-by user that exists in the configured user display source
- **THEN** the payment DTO includes `recordedByName`

#### Scenario: Missing actor falls back safely
- **WHEN** an actor id cannot be resolved
- **THEN** the API keeps the raw actor id and returns null display fields without throwing
