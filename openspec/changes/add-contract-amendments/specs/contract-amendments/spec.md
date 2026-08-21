## ADDED Requirements

### Requirement: Structured amendment records
The system SHALL store each contract amendment with a contract-scoped sequence, title, trimmed public content, effective date, strict structured change set, lifecycle status, immutable publication snapshots, actor attribution, and lifecycle timestamps. The change set SHALL allow only monthly rent, deposit, payment due day, occupant count, discount amount, and surcharge amount; at least one key SHALL be present.

#### Scenario: Explicitly restore building due-day inheritance
- **WHEN** a draft contains `payment_due_day: null`
- **THEN** the change set preserves the key and publication snapshots the effective due-day override as null

#### Scenario: Unsupported field is submitted
- **WHEN** a draft change set contains room, tenant, status, dates, notes, or an unknown key
- **THEN** strict validation rejects the request without persisting the amendment

### Requirement: Amendment lifecycle
Draft amendments SHALL be editable and deletable with optimistic concurrency. Publishing SHALL require an active contract, a non-past effective date no later than contract end, no existing non-void invoice in the effective month, and no other scheduled amendment. Published amendments SHALL be immutable; a scheduled amendment MAY only be cancelled with a non-empty reason, and an applied amendment SHALL only be corrected by a later amendment.

#### Scenario: Draft update is stale
- **WHEN** `expectedUpdatedAt` does not match the stored draft version
- **THEN** the update is rejected with a conflict and the stored draft is unchanged

#### Scenario: Amendment is effective today
- **WHEN** an authorized user publishes a valid draft whose effective date is today
- **THEN** publication and application occur atomically and the amendment becomes applied

#### Scenario: Amendment is effective in the future
- **WHEN** an authorized user publishes a valid future draft
- **THEN** immutable before/after snapshots are stored and the amendment becomes scheduled

#### Scenario: Effective month is already invoiced
- **WHEN** a non-void invoice exists for the contract and effective month
- **THEN** publication is rejected and no amendment or contract state changes

### Requirement: Billing-safe effective dates
An amendment that changes monthly rent, payment due day, occupant count, discount amount, or surcharge amount SHALL use the first day of a month. Deposit-only amendments MAY use any non-past date.

#### Scenario: Recurring term changes mid-month
- **WHEN** a draft with a recurring-term change is published with an effective date whose day is not 1
- **THEN** publication is rejected with a field validation error

### Requirement: Atomic due application
The system SHALL expose an idempotent server-only RPC that locks due scheduled amendments and their contracts, applies each snapshotted after-state to `contracts`, marks the amendment applied, and writes correlated amendment and contract audit events in the same transaction.

#### Scenario: Worker retries an applied amendment
- **WHEN** the due-application operation is repeated after a successful commit
- **THEN** no contract field, status, or audit row is duplicated

#### Scenario: One amendment application fails
- **WHEN** an amendment cannot pass locked-state validation
- **THEN** that amendment's contract update, status transition, and audit writes all roll back

### Requirement: Amendment authorization and scope
Internal reads SHALL require `contracts.read`; draft and lifecycle mutations SHALL require `contracts.update`. Owner access SHALL be constrained to assigned buildings, admin access SHALL be global, and manager/tenant mutation attempts SHALL be denied. Browser roles SHALL have no direct table privileges.

#### Scenario: Owner publishes inside scope
- **WHEN** an owner with `contracts.update` publishes an amendment for an assigned building
- **THEN** the operation succeeds

#### Scenario: Owner targets another building
- **WHEN** an owner targets a contract outside assigned building scope
- **THEN** the service returns the standard scoped not-found response

### Requirement: Amendment management API
The server SHALL expose list/create, draft update/delete, publish, and cancel endpoints under `/api/contracts/:identifier/amendments`. Contract identifiers SHALL follow the existing UUID-or-contract-code resolution policy, while amendment identifiers SHALL be UUIDs.

#### Scenario: List contract amendments
- **WHEN** an authorized internal user requests a contract's amendments
- **THEN** the response returns newest sequence first using the standard success envelope

#### Scenario: Cancel scheduled amendment
- **WHEN** an authorized user submits a non-empty cancellation reason for a scheduled amendment
- **THEN** it becomes cancelled, retains its snapshots, and records the actor, reason, and audit event
