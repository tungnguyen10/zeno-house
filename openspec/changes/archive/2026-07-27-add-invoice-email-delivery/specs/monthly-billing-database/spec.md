## ADDED Requirements

### Requirement: Atomic automatic invoice-email enqueue
Every invoice creation transaction SHALL atomically create the automatic invoice-email outbox result required by the building setting without calling an external provider or blocking issuance for recipient problems.

#### Scenario: Period issuance queues delivery atomically
- **WHEN** period issuance inserts one or more invoices for an auto-send building
- **THEN** every inserted invoice commits with exactly one queued or recipient-skipped automatic delivery

#### Scenario: Issue-and-pay queues delivery atomically
- **WHEN** issue-and-pay inserts and pays an invoice for an auto-send building
- **THEN** the paid invoice and its queued or recipient-skipped automatic delivery commit in the same transaction

#### Scenario: Reissue queues replacement delivery atomically
- **WHEN** reissue inserts a replacement invoice for an auto-send building
- **THEN** only the replacement invoice receives its own queued or recipient-skipped automatic delivery and the void invoice remains unchanged

#### Scenario: Automatic enqueue is disabled
- **WHEN** an invoice is inserted for a building without an enabled automatic setting
- **THEN** the invoice transaction preserves existing behavior and creates no automatic delivery

#### Scenario: Invoice transaction fails
- **WHEN** any supported invoice creation transaction rolls back
- **THEN** its automatic delivery insert and related queue audit also roll back

