## Purpose

Physical return, final-month billing, pilot deposit/credit settlement, and actual refund recording.

## Requirements

### Requirement: Atomic checkout and settlement
The system SHALL preserve the signed end date, record the actual return date and reason, and atomically terminate the contract, close all active occupant stays, record physical final meter readings, release the room, and audit the transition. Direct status and bulk termination SHALL not bypass return. Financial completion MAY wait for a closed billing period.

#### Scenario: Physical return before financial reconciliation
- **WHEN** a contract is returned while its final-month billing period is closed
- **THEN** room and occupants are released in one transaction, the signed end date is unchanged, and issuing final charges remains blocked until reconciliation

#### Scenario: Missing meter evidence
- **WHEN** a metered utility lacks a physical final reading or a reconciled billed/handover-in baseline
- **THEN** return is rejected without partial contract, room, occupant, reading, or audit changes; an estimated usage value alone cannot substitute for the final reading

### Requirement: Per-line final-month calculation
The system SHALL freeze rent, services, fixed/per-person utility prices, and occupancy pricing inputs at return. Each unbilled recurring line SHALL default to inclusive-day proration through the actual return date; an authorized operator MAY select full-month billing or waive that line with a reason. Metered utilities SHALL charge from the last billed reading to the physical final reading, and incidental fees SHALL remain distinct. Existing issued or paid invoice lines SHALL remain unchanged and SHALL not be billed twice.

#### Scenario: Individual charge modes
- **WHEN** rent is full month, one service is prorated, and another service is waived with a reason
- **THEN** the final quote shows those amounts independently, and a stale concurrent edit cannot overwrite saved modes

#### Scenario: Standard final bill
- **WHEN** a returned contract belongs to a building outside the pilot
- **THEN** it remains visible in the final-month invoice queue until a dedicated operation posts only missing charges, without allocating deposit or approved credit

#### Scenario: Deposit exceeds final debt
- **WHEN** held deposit is 5000000, prior outstanding debt is 200000, prorated final rent is 646000, electricity is 240000, water is 60000, and incidental charges are 150000
- **THEN** pilot preview and confirmation show 3704000 refundable, allocate 1296000 to oldest invoice debt first, and do not mark the refund paid until an explicit refund record exists

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

#### Scenario: Checkout returned under an earlier schema
- **WHEN** an existing returned checkout is upgraded to the new schema
- **THEN** its statement, allocations, receipts and refunds remain unchanged, it is identified as read-only history, and it does not enter the new final-billing queue or receive an automatic pilot settlement
