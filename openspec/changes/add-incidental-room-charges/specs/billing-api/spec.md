## ADDED Requirements

### Requirement: Billing API manages incidental charges
The API SHALL expose list, create, update, and delete endpoints below `/api/billing/periods/[id]/incidental-charges` and SHALL return DTOs rather than database rows.

#### Scenario: List period charges
- **WHEN** a user with `billing.read` requests incidental charges for an in-scope period
- **THEN** the API returns all period charge DTOs in deterministic creation order

#### Scenario: Create validated charge
- **WHEN** a user with `billing.write` posts `contract_id`, trimmed `label`, positive integer `amount`, optional `note`, and UUID `operation_id`
- **THEN** the API returns the created charge and the authoritative refreshed timestamp

#### Scenario: Update or delete with version
- **WHEN** a user patches a charge or deletes it with the current `expected_updated_at`
- **THEN** the API performs the mutation and returns the updated charge or deletion result
