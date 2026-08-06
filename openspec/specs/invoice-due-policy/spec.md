# invoice-due-policy Specification

## Purpose
TBD - created by archiving change unify-invoice-due-dates. Update Purpose after archive.
## Requirements
### Requirement: Server-owned invoice due schedule
The system SHALL resolve each new invoice schedule using explicit batch override, contract payment due day, building payment due day, then a four-calendar-day system fallback, in that order. Calendar calculations SHALL use `Asia/Ho_Chi_Minh`.

#### Scenario: Contract overrides building
- **WHEN** a contract and its building define different payment due days and no batch override is supplied
- **THEN** the invoice uses the contract payment due day

#### Scenario: Building supplies inherited day
- **WHEN** the contract due day is null and the building defines a payment due day
- **THEN** the invoice uses the building payment due day

#### Scenario: System fallback applies
- **WHEN** the contract and building due days are null and no override is supplied
- **THEN** the invoice is due four calendar days after the calculation date

#### Scenario: Explicit batch override wins
- **WHEN** a valid batch override is supplied
- **THEN** every selected invoice uses the override date while retaining the building grace duration

### Requirement: Due-day calendar resolution
A configured payment due day SHALL resolve to its next occurrence on or after the calculation date. A day unavailable in the target month SHALL clamp to that month's final calendar day.

#### Scenario: Configured day remains in current month
- **WHEN** the calculation date is August 5 and the effective due day is 10
- **THEN** the due date is August 10

#### Scenario: Configured day rolls forward
- **WHEN** the calculation date is August 11 and the effective due day is 10
- **THEN** the due date is September 10

#### Scenario: Short month clamps configured day
- **WHEN** the effective due day is 31 and its next target month is February 2028
- **THEN** the due date is February 29, 2028

#### Scenario: Past override rejected
- **WHEN** a batch override is earlier than the calculation date
- **THEN** validation rejects the preview and no invoice is issued

### Requirement: Grace and overdue schedule are immutable
Each issued invoice SHALL snapshot the building grace duration and SHALL derive its overdue date from the snapshotted due date plus grace duration. Later source edits SHALL NOT change the invoice schedule.

#### Scenario: Grace delays overdue state
- **WHEN** an unpaid issued invoice is past its due date but not past its overdue date
- **THEN** it remains issued and is identified as being within its grace interval

#### Scenario: Invoice becomes overdue after grace
- **WHEN** an unpaid issued invoice is past its overdue date
- **THEN** derived invoice status is overdue

#### Scenario: Building edit does not rewrite invoice
- **WHEN** a building due day or grace duration changes after issue
- **THEN** the existing invoice due date, grace duration, and overdue date remain unchanged

