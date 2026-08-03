## ADDED Requirements

### Requirement: AI payment planning is scoped and server authoritative
The AI assistant SHALL plan full-balance payments only for non-void issued invoices in one authorized building and one selected billing period, SHALL accept either 1–200 exact room references or all unpaid rooms, and SHALL derive amount and payment date on the server.

#### Scenario: One scoped building is implicit
- **WHEN** an authorized user omits a building and has exactly one building in scope
- **THEN** the planner selects that building and resolves the requested rooms only within it

#### Scenario: Multiple scoped buildings are ambiguous
- **WHEN** an authorized user omits a building and has more than one building in scope
- **THEN** the planner requests building clarification before looking up any room and creates no action

#### Scenario: Explicit room list is normalized
- **WHEN** a user supplies duplicate or whitespace-padded exact room references within the 200-reference limit
- **THEN** the planner trims and deduplicates the references and classifies each unique room within the selected building

#### Scenario: All unpaid rooms are requested
- **WHEN** an authorized user selects all unpaid rooms for a building and period
- **THEN** the planner includes every non-void issued invoice with positive balance in that period and no invoice from another period or building

#### Scenario: Payment authority is derived from current state
- **WHEN** an eligible invoice has a remaining balance and the model omits method
- **THEN** the action uses the complete current balance, the owning user-message date in `Asia/Ho_Chi_Minh`, and payment method `cash`

### Requirement: AI payment planning classifies every requested target
The planner SHALL classify targets as eligible, already paid, without an invoice, invalid room, or blocked; SHALL include only eligible targets in an action; and SHALL expose skipped classifications as preview warnings.

#### Scenario: Mixed room list contains eligible and skipped rows
- **WHEN** a room list contains an unpaid issued invoice, a paid invoice, and a room without an invoice
- **THEN** the planner creates one action for only the unpaid issued invoice and reports the other classifications without changing data

#### Scenario: No target is eligible
- **WHEN** every requested target is paid, missing, invalid, or blocked
- **THEN** the planner returns an explanatory result and creates no action plan

#### Scenario: Selected period has no invoice
- **WHEN** a room has no effective invoice in the explicit or newest non-closed selected period
- **THEN** the planner reports no invoice and does not search an older period

#### Scenario: Period is closed or invoice is not collectible
- **WHEN** the selected period is closed or an invoice is draft or void
- **THEN** the planner classifies the target as blocked and creates no payment for it

### Requirement: AI payment confirmation is atomic and snapshot bound
The system SHALL confirm `record_invoice_payments` only through the owned action endpoint, SHALL revalidate every eligible invoice and its period against the canonical preview snapshot, and SHALL commit the complete eligible batch or nothing.

#### Scenario: Current batch is confirmed
- **WHEN** the action owner with `billing.write` confirms a current payment plan within building scope while all switches are enabled
- **THEN** one full-balance payment per invoice, invoice paid states, the optional `issued` to `collecting` transition, and correlated audits commit atomically

#### Scenario: One invoice changes before confirmation
- **WHEN** any planned invoice version, balance, status, void state, or period state differs from the preview
- **THEN** the complete action becomes stale and no planned payment is recorded

#### Scenario: Action text claims confirmation
- **WHEN** a user or model message says the payment is confirmed
- **THEN** no payment is recorded until the authenticated action-card confirmation endpoint is called

#### Scenario: Payment execution is disabled
- **WHEN** planning, global mutation execution, or invoice-payment execution is disabled
- **THEN** the planner or executor fails closed without recording a payment

### Requirement: AI payment batches are transactionally idempotent
The payment transaction SHALL use the action plan idempotency key as its correlation ID, SHALL lock and validate all targets before writes, SHALL calculate amounts from locked balances, and SHALL return the prior authoritative result when the correlation is replayed.

#### Scenario: Confirmation is replayed after commit
- **WHEN** the same correlation is executed after its payment transaction committed
- **THEN** the RPC returns the original batch result and creates no duplicate payment, state transition, or audit event

#### Scenario: Concurrent confirmation changes one target
- **WHEN** a concurrent process changes or pays any target before the batch locks and validates it
- **THEN** the entire transaction fails with a classified conflict and records no partial batch

#### Scenario: Browser role invokes payment RPC
- **WHEN** `anon` or `authenticated` attempts to execute the AI payment RPC directly
- **THEN** database grants deny execution while `service_role` remains allowed

### Requirement: AI payment actions provide operator feedback
While confirmation is pending, the action card SHALL show the room count, total collection amount, date, method, eligible invoice list, and skipped-target counts without raw JSON. After successful confirmation, the card SHALL collapse those details into a compact succeeded state, and the client SHALL show a success or replay toast.

#### Scenario: Single payment succeeds
- **WHEN** confirmation records one room payment
- **THEN** the card becomes succeeded and the toast identifies the room and formatted collected amount

#### Scenario: Batch payment succeeds
- **WHEN** confirmation records multiple room payments
- **THEN** the card becomes succeeded and the toast reports the room count and formatted aggregate amount

#### Scenario: Successful payment details collapse
- **WHEN** a payment action reaches succeeded state
- **THEN** the card hides the financial preview, eligible invoice list, and skipped warnings while retaining a compact success record

#### Scenario: Later chat turns preserve action position
- **WHEN** the user sends one or more messages after a payment action is created or completed
- **THEN** the action card remains attached to the assistant response that created it and does not move below later messages

#### Scenario: Idempotent result is returned
- **WHEN** confirmation returns `meta.replayed` as true
- **THEN** the toast states that the collections were recorded previously

#### Scenario: Confirmation fails
- **WHEN** confirmation is stale, actively leased, or fails in the payment transaction
- **THEN** the card retains inline error state, the client emits an error toast, and no success toast appears
