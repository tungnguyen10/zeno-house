## MODIFIED Requirements

### Requirement: Issue invoices API
The API SHALL require a server-authoritative preview before issuing invoice snapshots transactionally. Preview and confirm SHALL accept selected contract IDs plus optional `due_date_override`; omitting the override SHALL resolve a schedule per invoice from server-owned contract and building state.

#### Scenario: Automatic issue preview requested
- **WHEN** an authorized caller posts contract IDs without `due_date_override`
- **THEN** the API returns draft documents with per-invoice due, grace, and overdue values, `calculation_date`, a canonical snapshot hash, and a server-owned operation ID

#### Scenario: Shared override preview requested
- **WHEN** an authorized caller posts a valid `due_date_override`
- **THEN** every issuable document uses that due date and the response identifies the shared override

#### Scenario: Preview snapshot binds schedule state
- **WHEN** the preview snapshot is calculated
- **THEN** its hash binds calculation date, override, contract and building due settings, resolved per-invoice schedules, canonical financial state, blockers, warnings, existing invoices, and payment-profile version

#### Scenario: Schedule becomes stale
- **WHEN** the local calculation date or any bound contract/building schedule input changes before confirm
- **THEN** confirm returns `409 CONFLICT` and creates no invoice, charge, period transition, or success audit event

#### Scenario: Per-invoice schedules commit atomically
- **WHEN** the confirmation matches the preview
- **THEN** one transaction stores each target invoice with its own server-owned due and grace values plus its charge snapshot

#### Scenario: Client financial or schedule payload is rejected
- **WHEN** a caller supplies client-owned charge lines, totals, per-invoice dates, or grace durations
- **THEN** strict boundary validation rejects the request
