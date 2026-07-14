## MODIFIED Requirements

### Requirement: Invoice correction API
The API SHALL support controlled invoice corrections through versioned, atomic void, reissue, and adjustment operations. Direct adjustment of paid invoices via API remains available for backward compatibility but is not surfaced in the workspace UI.

#### Scenario: Void unpaid invoice
- **WHEN** a user with sufficient permission voids an issued invoice with no active payments and the expected invoice version matches
- **THEN** the invoice status change and `invoice.voided` audit event commit in one transaction with a correlation ID

#### Scenario: Reissue replacement invoice
- **WHEN** a voided invoice has a ready fresh draft and no active replacement
- **THEN** the replacement invoice, charge snapshots, supersession links, and `invoice.reissued` audit event commit in one transaction sharing the prior void correlation when available

#### Scenario: Void with active payments rejected
- **WHEN** a void targets an invoice with active payments
- **THEN** the API rejects with 409 CONFLICT and instructs the operator to use the explicit payment/correction workflow

#### Scenario: Paid adjustment is atomic
- **WHEN** an authorized caller adds a valid adjustment to a partial or paid invoice using the current expected version
- **THEN** the adjustment charge, recomputed invoice totals/status, and audit event commit atomically

#### Scenario: Correction version is stale
- **WHEN** the invoice, replacement state, payment state, or bound draft changes after the caller previewed it
- **THEN** the API returns 409 CONFLICT and leaves invoice, charge, link, payment, and audit state unchanged

#### Scenario: Closed period direct mutation rejected
- **WHEN** a correction targets a closed period without an explicitly supported correction rule
- **THEN** the API rejects void, reissue, or adjustment and persists no change

#### Scenario: Adjustment endpoint remains
- **WHEN** an integration POSTs to the existing adjustment endpoint
- **THEN** the API continues to accept valid input through the same atomic service contract while the workspace UI does not surface this path

## ADDED Requirements

### Requirement: Invoice issue operation is idempotent by server operation key
The invoice issue transaction SHALL accept a server-owned operation key, SHALL return the prior authoritative issue result when that key is replayed, and SHALL preserve the one-active-invoice-per-period-and-contract invariant under concurrent requests.

#### Scenario: Operation key is replayed
- **WHEN** a completed issue transaction is called again with the same operation key
- **THEN** it returns the invoices created by the first call without duplicating invoices, charges, period transitions, or audits

#### Scenario: Concurrent issue targets overlap
- **WHEN** concurrent issue operations target the same period and contract
- **THEN** at most one active invoice is committed and the losing operation resolves without partial financial state
