## ADDED Requirements

### Requirement: Contract status follows defined lifecycle
The system SHALL enforce a contract status lifecycle: `pending → active → expired | terminated`. Migration 003 adds `pending_signature` and `renewed` to the enum for future use. The `draft` status does NOT exist — do not add it. Invalid transitions are rejected by the API.

#### Scenario: Active contract cannot be set back to pending

- **WHEN** the API receives a status update from `active` to `pending`
- **THEN** the server returns HTTP 400 with an invalid transition message

#### Scenario: Creating contract sets room to occupied
- **WHEN** a contract with status `active` is created for a room
- **THEN** the room's status changes to `occupied` in the same transaction

#### Scenario: Terminating contract frees room
- **WHEN** `POST /api/contracts/[id]/terminate` is called
- **THEN** the contract status is set to `terminated` and the room status is set to `available`

### Requirement: Expiry warnings appear for contracts ending within threshold
The system SHALL highlight contracts expiring within 7, 30, or 60 days on the contracts list page with visual indicators.

#### Scenario: Contract expiring in 5 days shows urgent warning
- **WHEN** a contract's `end_date` is 5 days from today
- **THEN** the contract card shows a red "Sắp hết hạn" badge

#### Scenario: Contract expiring in 25 days shows caution
- **WHEN** a contract's `end_date` is 25 days from today
- **THEN** the contract card shows a yellow warning indicator

### Requirement: Renew creates a new linked contract
The system SHALL allow renewing a contract by creating a new contract record starting the day after the original ends, with `previous_contract_id` set to the original.

#### Scenario: Renewed contract starts day after old ends
- **WHEN** `renewContract(id)` is called on a contract ending 2026-05-31
- **THEN** a new contract is created with `start_date = 2026-06-01` and `previous_contract_id = id`

### Requirement: PDF export button is a disabled placeholder
The system SHALL show a "Tải PDF" button on the contract detail page that is visually present but disabled with a tooltip "Sắp có".

#### Scenario: PDF button is disabled
- **WHEN** a user views a contract detail page
- **THEN** a "Tải PDF" button is visible, disabled, and shows "Sắp có" on hover
