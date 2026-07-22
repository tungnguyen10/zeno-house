## ADDED Requirements

### Requirement: Current-page invoice email selection
When invoice email is globally enabled, the cross-period invoice browser SHALL support manual single and bulk email enqueue for active invoices from the currently loaded page only.

#### Scenario: Select emailable invoices on desktop or mobile
- **WHEN** the current page contains active and void invoices
- **THEN** desktop rows and mobile cards expose email selection only for issued, partial, paid, or overdue invoices

#### Scenario: Selected invoices are queued
- **WHEN** the user selects one or more active invoices and confirms **Gửi email**
- **THEN** the client submits at most 100 current-page invoice identifiers and shows queued, already-queued, skipped, and failed counts from the per-item response

#### Scenario: Browse result changes
- **WHEN** filters, pagination, or refreshed results replace the current page
- **THEN** the prior email selection is cleared along with existing page-bound action selection

#### Scenario: Email feature is disabled
- **WHEN** the global invoice-email feature flag is off
- **THEN** invoice browse shows no email action and preserves existing print and navigation behavior

### Requirement: Invoice email action and delivery history
Invoice detail SHALL show the primary contact recipient, manual send or resend action, and newest-first delivery history without adding invoice mutation controls.

#### Scenario: Invoice has no delivery history
- **WHEN** an authorized user opens an active invoice with a valid primary contact email and no prior delivery
- **THEN** detail shows **Gửi email**, the recipient address, and an empty delivery-history state

#### Scenario: Invoice has an active delivery
- **WHEN** the latest delivery is queued, processing, or accepted
- **THEN** detail displays that state and prevents a duplicate manual request

#### Scenario: Invoice has a terminal delivery
- **WHEN** the latest delivery is delivered, failed, bounced, complained, or skipped
- **THEN** detail displays its safe outcome and offers **Gửi lại** when the invoice remains active and the user has `billing.write`

#### Scenario: Recipient is unavailable
- **WHEN** the primary tenant contact email is missing or invalid
- **THEN** detail explains why delivery cannot be queued and provides no free-form recipient field

#### Scenario: Detail is read-only for billing mutations
- **WHEN** email actions and history are added to invoice detail
- **THEN** existing prohibition on payment, void, and adjustment actions in the browse drawer remains unchanged

