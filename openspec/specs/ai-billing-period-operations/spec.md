# ai-billing-period-operations Specification

## Purpose
TBD - created by archiving change add-ai-billing-period-operations. Update Purpose after archive.
## Requirements
### Requirement: Scoped building discovery and resolution
The AI assistant SHALL list and resolve buildings only within the authenticated user's allowed scope, SHALL accept UUID, slug, or exact case-insensitive name references, and SHALL never reveal an out-of-scope match.

#### Scenario: Scoped buildings are listed
- **WHEN** an authenticated user asks which buildings they can operate
- **THEN** the building-list tool returns only safe summaries for buildings in that user's scope

#### Scenario: Building reference resolves uniquely
- **WHEN** a user provides a scoped building UUID, slug, or uniquely matching exact name
- **THEN** the server resolves the same authoritative building UUID for downstream reads or planning

#### Scenario: Building name is ambiguous
- **WHEN** an exact building name matches multiple buildings in the user's scope
- **THEN** the planning tool returns scoped candidates and creates no action plan until the user clarifies

#### Scenario: Out-of-scope building is referenced
- **WHEN** a user references a building they cannot access
- **THEN** the resolver returns the same not-found outcome as an unknown reference and reveals no building metadata

### Requirement: AI billing-period context reads
The AI assistant SHALL allow authorized users to read scoped meter status and billing-period overview through registered read tools before proposing an operation.

#### Scenario: Meter status is requested by natural building reference
- **WHEN** an authorized user asks for meter status using a uniquely resolved building name or slug and month
- **THEN** the tool returns status from the existing scoped meter-reading service

#### Scenario: Billing overview is requested
- **WHEN** an authorized user requests an overview for a period they can access
- **THEN** the tool returns the existing scoped billing workspace overview

### Requirement: Period opening is planned before execution
The AI assistant SHALL expose `plan_open_billing_period` as a planning tool that validates a scoped building and month, creates a server-owned action plan for a new period, and performs no billing mutation during chat generation.

#### Scenario: New period plan is created
- **WHEN** an authorized user requests a month that has no period for a uniquely resolved scoped building
- **THEN** the server creates a pending `open_billing_period` action plan with normalized UUID/year/month payload, preview, server idempotency key, and building version

#### Scenario: Existing period is requested
- **WHEN** the requested building/month already has a billing period
- **THEN** the tool returns the existing period and creates no action plan or audit event

#### Scenario: Model emits confirmation language
- **WHEN** the model or user chat message says the opening is confirmed
- **THEN** no period is created until the owner clicks the action card and the direct confirmation endpoint accepts the plan

### Requirement: Period action card confirmation
The UI SHALL render a pending period-opening plan as an action card and SHALL send confirm or cancel directly to the authenticated action endpoints without converting the click into model text.

#### Scenario: User confirms the action card
- **WHEN** the owner clicks Confirm on a valid pending period-opening card
- **THEN** the direct endpoint revalidates policy, scope, building version, and period state before dispatching the registered executor

#### Scenario: User cancels the action card
- **WHEN** the owner clicks Cancel on a pending period-opening card
- **THEN** the plan becomes cancelled and no period or audit event is created

#### Scenario: Building changes after planning
- **WHEN** the building version no longer matches the version stored in the plan
- **THEN** confirmation returns CONFLICT, marks the plan stale, and opens no period

### Requirement: Idempotent and concurrent period execution
The period-opening executor SHALL use the server-generated plan idempotency key and the unique building/month key so retries and concurrent operations return one authoritative period without duplicate audits.

#### Scenario: Confirmation succeeds
- **WHEN** a valid pending plan is confirmed and no period exists
- **THEN** one draft period and one `period.opened` audit event are committed atomically and the action stores the durable result

#### Scenario: Confirmation is replayed
- **WHEN** a succeeded plan is confirmed again
- **THEN** the prior result is returned without running the executor or writing another audit event

#### Scenario: Another request opens the same month
- **WHEN** another authorized request creates the same building/month before or during confirmation
- **THEN** confirmation returns the existing period as an idempotent result and writes no duplicate period or audit event

#### Scenario: Two confirmations race
- **WHEN** concurrent confirmations target the same pending plan
- **THEN** at most one executor runs and both cannot create distinct periods or duplicate audits

