## ADDED Requirements

### Requirement: Billing incidental charge source table
The database SHALL store period-scoped incidental charge source rows with billing period, contract, room, positive integer amount, label, optional note, globally unique operation id, actor, timestamps, indexes, and RLS.

#### Scenario: Source table constraints
- **WHEN** a row has a missing relation, blank label, non-positive/non-integer amount, or duplicate operation id
- **THEN** the database rejects the row

#### Scenario: Source table is protected
- **WHEN** an untrusted Data API role attempts unrestricted write access
- **THEN** RLS and grants prevent bypass of the server-owned transaction path

### Requirement: Incidental writes and audits are atomic
Create, update, and delete RPCs SHALL lock and validate billing state, mutate one incidental source row, and persist the matching audit event in one transaction.

#### Scenario: Audit insert fails
- **WHEN** an incidental mutation cannot persist its required audit event
- **THEN** the source-row mutation rolls back

### Requirement: Invoice charges support incidental snapshots
The invoice charge constraint SHALL accept `incidental` while preserving every existing charge type and historical row.

#### Scenario: Issued incidental snapshot
- **WHEN** an invoice is issued from a draft containing an incidental line
- **THEN** `invoice_charges` stores its label, amount, source type/id, and period/contract metadata
