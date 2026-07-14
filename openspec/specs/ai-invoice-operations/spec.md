# ai-invoice-operations Specification

## Purpose
Define the authoritative planning, confirmation, transaction, runtime-safety, and retention requirements for AI-assisted invoice issue and correction operations.

## Requirements
### Requirement: Invoice issue preview is server authoritative
The AI assistant SHALL build invoice issue previews only from the scoped billing draft service and SHALL NOT accept model-supplied invoice totals, charge lines, or authoritative target state.

#### Scenario: Ready drafts are previewed
- **WHEN** an authorized user requests issue preview for an accessible period and optional contract selection
- **THEN** the planner returns server-computed invoice counts, per-contract totals, due date, warnings, blockers, and aggregate total

#### Scenario: Draft contains blockers
- **WHEN** any selected draft has a billing blocker
- **THEN** the planner reports the blocker and creates no issue action for that blocked target

#### Scenario: Model supplies alternate totals
- **WHEN** model or user content contains invoice totals or charge lines that differ from the billing service
- **THEN** those values are not accepted as tool authority and do not enter the action payload

### Requirement: Invoice issue confirmation is snapshot bound
The AI assistant SHALL store a canonical hash of the previewed period and draft inputs and SHALL issue only when confirmation-time calculation produces the same target snapshot.

#### Scenario: Unchanged preview is confirmed
- **WHEN** the owner confirms an issue action and the period, targets, draft lines, totals, blockers, and existing invoice state still match
- **THEN** the existing atomic issue transaction commits invoices, charges, period status, and audit rows and stores the durable result

#### Scenario: Preview becomes stale
- **WHEN** any selected billing input or invoice state changes after preview
- **THEN** confirmation returns 409 CONFLICT, marks the action stale, and issues no invoice

#### Scenario: Issue confirmation is retried
- **WHEN** the same confirmed issue operation is retried
- **THEN** it returns the prior authoritative invoices and creates no duplicate invoice, charge, period transition, or audit event

### Requirement: Unpaid invoice void is planned and versioned
The AI assistant SHALL expose voiding only as a confirmed plan for an unpaid non-void invoice in an editable period, with an explicit reason and expected invoice version.

#### Scenario: Valid void is confirmed
- **WHEN** the owner confirms a current void plan with sufficient correction capability
- **THEN** the invoice status change and `invoice.voided` audit event commit atomically under one correlation ID

#### Scenario: Invoice gains payment before confirmation
- **WHEN** the invoice becomes partial or paid after the void preview
- **THEN** confirmation returns a stale conflict and preserves the invoice and payments

#### Scenario: Chat text claims void confirmation
- **WHEN** user or model text says to confirm the void
- **THEN** no invoice changes until the direct action-card endpoint is invoked

### Requirement: Voided invoice reissue uses a fresh bound draft
The AI assistant SHALL plan reissue only for a void invoice, SHALL calculate a fresh draft for the same contract and period, and SHALL bind confirmation to the void invoice and draft versions.

#### Scenario: Reissue succeeds
- **WHEN** the owner confirms a current reissue plan with no blocker or active replacement
- **THEN** the replacement invoice, charge snapshots, supersession links, and `invoice.reissued` audit commit atomically and share the void operation correlation when available

#### Scenario: Active replacement exists
- **WHEN** another non-void invoice exists for the same period and contract at confirmation
- **THEN** reissue returns a conflict and creates no replacement or link

#### Scenario: Reissue draft changes
- **WHEN** the fresh server draft no longer matches the preview
- **THEN** the plan becomes stale and no replacement invoice is created

### Requirement: Paid invoice correction is an explicit adjustment plan
The AI assistant SHALL correct partial or paid invoices only through a bounded adjustment plan that shows the authoritative before/after total and balance and SHALL NOT implicitly undo payments or issue refunds.

#### Scenario: Paid adjustment is confirmed
- **WHEN** the owner confirms a valid adjustment with label, integer amount, and reason against the current invoice version
- **THEN** the adjustment charge, invoice totals/status, and audit event commit atomically

#### Scenario: Adjustment would violate billing rules
- **WHEN** the amount, resulting total/balance, invoice state, or period state is invalid
- **THEN** the planner or executor rejects the change and preserves invoice, charge, payment, and audit data

#### Scenario: User asks to remove a payment implicitly
- **WHEN** conversational correction would require payment undo or refund
- **THEN** the assistant explains the explicit payment workflow and creates no hidden payment mutation

### Requirement: Invoice tools and executors remain policy controlled
The server SHALL register every invoice planner and executor deny-by-default, SHALL enforce its capability and building scope at planning and confirmation, and SHALL apply current server mutation switches to existing action cards.

#### Scenario: User lacks correction capability
- **WHEN** a user without `billing.corrections` requests void, reissue, or paid adjustment
- **THEN** those planners and executors are unavailable and no action is created

#### Scenario: Invoice mutation kill switch is enabled
- **WHEN** invoice mutation execution is disabled after a plan was created
- **THEN** confirmation rejects the action without invoking an invoice service

#### Scenario: Out-of-scope invoice is referenced
- **WHEN** a user references an invoice outside assigned building scope
- **THEN** the system reveals no invoice details and creates no action
