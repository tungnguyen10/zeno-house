## ADDED Requirements

### Requirement: Building invoice-email settings and feature gates
The system SHALL store one building-scoped automatic invoice-email setting, SHALL default it to disabled, and SHALL require both the global invoice-email feature flag and the building setting before automatic delivery can occur.

#### Scenario: Owner or admin enables automatic delivery
- **WHEN** an admin or an owner inside building scope enables automatic invoice email
- **THEN** the setting is persisted for that building and future supported invoice insertions are eligible for automatic queueing

#### Scenario: Manager reads but cannot change the setting
- **WHEN** a scoped manager opens the building setting
- **THEN** the current value is visible and an update attempt is forbidden

#### Scenario: Global feature is disabled
- **WHEN** the global invoice-email feature flag is disabled
- **THEN** email controls are unavailable and no queued delivery is dispatched

#### Scenario: Enabling is not retroactive
- **WHEN** automatic delivery is enabled for a building with existing invoices
- **THEN** no delivery is created for those existing invoices unless an authorized user explicitly sends them

### Requirement: Primary-tenant recipient policy
Every invoice email SHALL target only the normalized contact email stored for the invoice's primary tenant and SHALL snapshot that address on the delivery record.

#### Scenario: Primary tenant has a contact email
- **WHEN** an invoice delivery is queued and `tenants.email` for `invoice.tenant_id` is valid
- **THEN** that address is stored as the sole recipient without roommate CC or operator override

#### Scenario: Recipient is missing or invalid
- **WHEN** an otherwise eligible invoice has no valid primary-tenant contact email
- **THEN** the system records a terminal skipped delivery with a machine-readable recipient reason and does not fail invoice issuance or the rest of a bulk request

#### Scenario: Tenant email changes after queueing
- **WHEN** the tenant contact email changes after a delivery was queued
- **THEN** that delivery retains its original recipient and a later explicit resend snapshots the new address

### Requirement: Manual invoice-email enqueue API
The system SHALL let a user with `billing.write` enqueue one to 100 accessible active invoices by UUID or invoice code and SHALL return a per-invoice result without short-circuiting mixed outcomes.

#### Scenario: Manual single delivery is queued
- **WHEN** an authorized scoped user submits one issued, partial, paid, or overdue invoice
- **THEN** the API returns a queued delivery for the primary tenant contact email

#### Scenario: Bulk request has mixed outcomes
- **WHEN** a request includes eligible, inaccessible, void, and recipient-missing invoices
- **THEN** each identifier receives its own queued, failed, or skipped result and eligible invoices are not rolled back because another item failed

#### Scenario: Active delivery already exists
- **WHEN** the same invoice and recipient already have a queued, processing, or accepted delivery
- **THEN** the API returns that delivery as already queued and does not create another provider request

#### Scenario: Explicit resend follows a terminal outcome
- **WHEN** an authorized user sends an invoice whose prior delivery is delivered, failed, bounced, complained, or skipped
- **THEN** the system creates a new delivery with a new idempotency key and current primary-tenant contact email

#### Scenario: Manual delivery lacks permission or scope
- **WHEN** a user lacks `billing.write` or cannot access an invoice's building
- **THEN** no delivery for that invoice is created and the per-item result does not expose private invoice or recipient data

### Requirement: Durable automatic delivery outbox
The system SHALL create automatic invoice delivery work in the same database transaction as each eligible invoice insertion and SHALL never call Resend from that transaction.

#### Scenario: Automatic invoice is queued
- **WHEN** period issue, issue-and-pay, or reissue inserts an invoice for a building with automatic delivery enabled and a valid recipient
- **THEN** the transaction also creates exactly one queued automatic delivery for that invoice

#### Scenario: Automatic invoice has no recipient
- **WHEN** an eligible automatic invoice is inserted without a valid primary-tenant contact email
- **THEN** the transaction records one skipped delivery and still commits the invoice

#### Scenario: Automatic delivery is disabled for the building
- **WHEN** an invoice is inserted for a building whose automatic setting is absent or false
- **THEN** no automatic delivery record is created

#### Scenario: Transaction rolls back
- **WHEN** the surrounding invoice transaction fails after attempting automatic enqueue
- **THEN** neither the invoice nor its delivery record remains committed

### Requirement: Authoritative HTML and PDF invoice artifact
Each dispatched delivery SHALL contain an escaped Vietnamese HTML summary and an attached PDF built from authoritative invoice data without persisting the generated file.

#### Scenario: Email document is rendered
- **WHEN** a queued delivery is dispatched
- **THEN** the HTML and PDF include invoice, building, room, tenant, period, date, charge, total, paid, balance, status, due-date, and available snapshotted payment information

#### Scenario: Historical invoice data is used
- **WHEN** charge inputs or the current building payment profile changed after issuance
- **THEN** the email uses persisted charge lines and the invoice's payment-profile snapshot rather than recalculating charges or substituting current profile data

#### Scenario: Current collection totals are used
- **WHEN** payments changed after invoice issuance but before dispatch
- **THEN** the email and PDF show the current paid amount, balance, and derived status

#### Scenario: Private branding assets are available
- **WHEN** the invoice payment-profile snapshot references a valid private QR or logo object
- **THEN** the server downloads the exact object for rendering without exposing its storage path to the client or accepting an arbitrary asset URL

#### Scenario: Payment profile or optional branding is unavailable
- **WHEN** the invoice lacks a payment-profile snapshot or an optional logo cannot be rendered
- **THEN** the document uses the established neutral payment or branding fallback and remains sendable

#### Scenario: PDF content exceeds one page
- **WHEN** invoice content cannot fit legibly on one A4 page
- **THEN** the renderer continues onto additional pages without truncating financial data

#### Scenario: Attachment exceeds the application limit
- **WHEN** the generated PDF exceeds 10 MB
- **THEN** the delivery fails terminally before calling Resend and records an attachment-size error

### Requirement: Bounded idempotent delivery dispatcher
The system SHALL dispatch due deliveries in bounded leases, SHALL prevent duplicate sends with a stable Resend idempotency key, and SHALL retry only transient failures within 24 hours.

#### Scenario: Worker claims due jobs
- **WHEN** the scheduled worker runs while delivery is enabled
- **THEN** it atomically claims at most 20 due or stale-leased deliveries and processes at most three provider calls concurrently

#### Scenario: Resend accepts the email
- **WHEN** Resend returns a successful email ID
- **THEN** the delivery stores that ID, becomes accepted, clears its lease, and is not dispatched again

#### Scenario: Provider outcome is transient
- **WHEN** dispatch encounters a network error, HTTP 429, or HTTP 5xx
- **THEN** the same delivery and idempotency key are retried after 1 minute, 5 minutes, 30 minutes, 2 hours, and 6 hours up to six total provider calls

#### Scenario: Provider outcome is permanent
- **WHEN** dispatch encounters invalid authentication, sender/domain, recipient, attachment, configuration, or request validation
- **THEN** the delivery becomes terminally failed without an automatic retry

#### Scenario: Processing lease is abandoned
- **WHEN** a processing delivery has held its lease for more than 10 minutes without acceptance
- **THEN** a later worker can reclaim it and reuse the same idempotency key

#### Scenario: Global feature or configuration is unavailable
- **WHEN** the feature flag is off or required dispatch secrets are absent
- **THEN** the worker sends nothing, preserves queued jobs, and reports a safe skipped reason

### Requirement: Verified Resend delivery webhooks
The system SHALL verify and deduplicate Resend webhook events before updating a delivery and SHALL prevent older events from regressing newer provider state.

#### Scenario: Valid delivery event is received
- **WHEN** a correctly signed `email.sent`, `email.delivered`, `email.failed`, `email.bounced`, or `email.complained` event references a stored Resend email ID
- **THEN** the event is recorded and the matching delivery advances to the corresponding allowed state

#### Scenario: Webhook signature is invalid
- **WHEN** a webhook lacks required Svix headers or fails signature verification against the configured secret
- **THEN** the request is rejected and no delivery or webhook-event row is changed

#### Scenario: Webhook is delivered more than once
- **WHEN** an already processed `svix_id` is received again
- **THEN** the endpoint acknowledges it without applying the event twice

#### Scenario: Webhooks arrive out of order
- **WHEN** an older sent or delivered event arrives after a newer terminal event
- **THEN** the event can be retained for diagnosis but does not regress the delivery state

#### Scenario: Complaint or bounce follows delivery
- **WHEN** a newer complained or bounced event follows a delivered event
- **THEN** the later terminal outcome supersedes delivered and is not automatically retried

### Requirement: Scoped delivery history and audit
The system SHALL expose scoped delivery history for an invoice and SHALL record concise billing audit events for queue and terminal outcomes.

#### Scenario: Authorized user views delivery history
- **WHEN** a user with `billing.read` and building scope opens an invoice's email history
- **THEN** the API returns newest-first recipient, source, state, attempts, safe error summary, and provider timestamps without secrets or private asset paths

#### Scenario: User lacks invoice scope
- **WHEN** a user requests delivery history for an out-of-scope invoice identifier
- **THEN** the API returns the established not-found response without revealing whether the invoice or recipient exists

#### Scenario: Delivery lifecycle is audited
- **WHEN** a delivery is queued, delivered, or reaches a final failure, bounce, or complaint
- **THEN** billing audit records `invoice.email_queued`, `invoice.email_delivered`, or `invoice.email_failed` against the invoice with safe source and outcome metadata

