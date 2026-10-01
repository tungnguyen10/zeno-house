## ADDED Requirements

### Requirement: Atomic checkout and settlement
The system SHALL preserve the original contract end date, record actual return date and contract-specific handover readings, release occupancy independently from financial completion, and calculate final charges without automatically recalculating rent or services.

#### Scenario: Deposit exceeds final debt
- **WHEN** held deposit is 5000000, prior outstanding debt is 200000, final electricity is 240000, water is 60000 and incidental charges are 150000
- **THEN** preview and confirmation show 4350000 refundable, allocate 650000 to invoices and do not mark the refund paid until an explicit refund record exists

#### Scenario: Concurrent confirmation
- **WHEN** confirmation is retried or two actors confirm the same preview
- **THEN** money is allocated once, stale changed inputs are rejected, and domain changes and audit commit atomically

### Requirement: Contract-specific consumption
The system SHALL keep handover identities separate per contract, use effective invoice consumption endpoints, and prevent consumption billed to an earlier occupant from being charged to a successor.

#### Scenario: Two occupants in one month
- **WHEN** one contract ends and another begins in the same room and month
- **THEN** billing exposes both contracts and uses their own handover boundaries without sharing override usage or overwriting readings

### Requirement: Protected settlement history
The system SHALL retain source-linked deposits, credit allocations and actual refunds and SHALL prevent direct mutation of allocated source receipts or ordinary termination bypasses.

#### Scenario: Ambiguous legacy data
- **WHEN** a previous handover cannot be attributed unambiguously
- **THEN** final billing is blocked pending explicit reconciliation and no inferred financial entries are created
