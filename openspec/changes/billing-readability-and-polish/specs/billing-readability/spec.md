## ADDED Requirements

### Requirement: Invoice DTO display name enrichment
The `Invoice` DTO returned from list and detail endpoints SHALL include human-readable display fields alongside raw UIDs.

#### Scenario: List endpoint returns tenant name and room number
- **WHEN** `GET /api/billing/periods/:id/invoices` is called
- **THEN** each invoice in the response includes `tenantName`, `roomNumber`, and `contractCode` (nullable when source data is missing)

#### Scenario: Detail endpoint returns enriched invoice
- **WHEN** `GET /api/billing/invoices/:id` is called
- **THEN** the response includes `tenantName`, `roomNumber`, and `contractCode` for the invoice

#### Scenario: Raw UID fields preserved
- **WHEN** an enriched invoice is returned
- **THEN** the original `contractId`, `roomId`, `tenantId` UID fields remain in the DTO so callers can navigate, copy, or debug

### Requirement: Invoice payment DTO display name enrichment
The `InvoicePayment` DTO SHALL include the recorder display name.

#### Scenario: Payment list returns recorder name
- **WHEN** payments are returned from `GET /api/billing/invoices/:id/payments` or as part of `getWithCharges`
- **THEN** each payment includes `recordedByName` (nullable when actor is system or has no display name)

### Requirement: Audit event DTO enrichment
The `BillingAuditEvent` DTO returned from list endpoints SHALL include actor display info, an entity label resolved from `entity_type` + `entity_id`, and a Vietnamese summary string derived from `action` and `metadata`.

#### Scenario: Audit list includes actor name
- **WHEN** `GET /api/billing/periods/:id/audit` is called
- **THEN** each event includes `actorName` (nullable when actor is system) and `actorEmail` (nullable, used for tooltips)

#### Scenario: Audit list includes entity label
- **WHEN** an audit event references an entity (`billing_period`, `invoice`, `invoice_payment`, `meter_reading`, `billing_utility_usage`)
- **THEN** the response includes `entityLabel` and `entitySubLabel` resolved against the current entity record (e.g. `entityLabel = "Hoá đơn P01 · Võ Chí Linh"`, `entitySubLabel = "06/2026 · 1.500.000đ"`)

#### Scenario: Audit list includes navigable href
- **WHEN** an audit event entity is still reachable
- **THEN** `entityHref` returns a workspace-relative URL (e.g. `/billing/<building>/2026-06`); when the entity has been deleted, `entityHref` is null

#### Scenario: Audit list includes Vietnamese summary
- **WHEN** an audit event is returned
- **THEN** the response includes a `summary` string formatted from action + metadata (e.g. action `invoices.issued` with metadata `{issued_count: 2, due_date: "2026-06-25"}` produces `summary = "Phát hành 2 hoá đơn, hạn 25/06/2026"`)

#### Scenario: Unknown action falls back gracefully
- **WHEN** an audit event has an action not covered by the formatter
- **THEN** `summary` returns a generic fallback such as `"Hành động: <action>"` rather than failing the request

### Requirement: Audit summary formatter is a pure function
The audit summary formatter SHALL be a pure server-side function over `(action, metadata)` with no I/O.

#### Scenario: Formatter is testable in isolation
- **WHEN** the formatter is called with a known action + metadata pair
- **THEN** it returns a deterministic Vietnamese string without database, network, or filesystem access

#### Scenario: Formatter handles missing metadata fields
- **WHEN** the formatter is called with action `payment.recorded` but metadata is missing `payment_method`
- **THEN** the formatter returns `"Ghi thu <amount>đ"` without the optional method clause and without raising an error

### Requirement: Display resolver batches lookups
The display resolver responsible for enriching list endpoints SHALL batch lookups per entity type to avoid N+1 queries.

#### Scenario: One lookup per entity type per request
- **WHEN** an audit list contains 30 events referencing 5 invoices, 3 periods, and 2 actors
- **THEN** the resolver issues at most one batch query for actors, one for invoices, one for periods (and corresponding tenant/room joins) — not one query per event

### Requirement: UI never displays UIDs in primary columns
Billing UI components SHALL not render raw UUIDs in primary columns of invoices, payments, or audit lists.

#### Scenario: Payments table shows tenant name and room number
- **WHEN** `BillingPaymentsStep` renders the invoice table
- **THEN** the "Hợp đồng" column shows `tenantName` and `roomNumber` (or contract code), not `contractId` / `roomId`

#### Scenario: Audit table shows actor name
- **WHEN** the audit list renders the actor column
- **THEN** it shows `actorName` (or "Hệ thống" when actor is null), not `actorId` UUID

#### Scenario: Audit detail column shows summary
- **WHEN** the audit list renders the detail column
- **THEN** it shows `summary` formatted Vietnamese text, not raw `metadata` key=value dump

#### Scenario: Optional UID access for power users
- **WHEN** a payment or audit row needs raw UID for debugging
- **THEN** it is available via row click into a detail surface, copy action, or developer tooling — but is not the default visual

### Requirement: Draft surfaces existing invoice context
The draft response per contract SHALL include the active (non-void) issued invoice for that contract when one exists.

#### Scenario: Draft includes existingInvoice when invoice has been issued
- **WHEN** a draft row is computed for a contract that already has an active issued invoice in the period
- **THEN** the response includes `existingInvoice: { id, totalAmount, paidAmount, status }` for that draft

#### Scenario: Draft existingInvoice null when no active invoice
- **WHEN** the contract has no issued invoice for the period, or the only invoice is voided
- **THEN** `existingInvoice` is null

### Requirement: Draft–issued discrepancy callout
The draft grid SHALL surface a discrepancy callout when a draft total differs materially from the corresponding issued invoice total, and SHALL guide the user to the correct correction flow.

#### Scenario: Callout shown when delta is significant
- **WHEN** a draft row has an `existingInvoice` and `|draft total − existingInvoice.totalAmount| ≥ 1000`
- **THEN** the row expanded panel renders a warning callout that displays the issued amount, the new draft amount, and the signed delta

#### Scenario: Callout hidden when delta is negligible
- **WHEN** the delta is less than 1000 (rounding noise) or no issued invoice exists
- **THEN** no discrepancy callout is rendered for that row

#### Scenario: Callout offers Adjustment CTA
- **WHEN** the callout is visible and the period is not closed
- **THEN** a primary CTA labelled "Tạo điều chỉnh" opens the adjustment modal pre-filled with `reference_invoice_id` set to the issued invoice and `amount` set to the negative of the delta

#### Scenario: Callout offers Void+Reissue CTA when no payments
- **WHEN** the callout is visible, the period is not closed, and the issued invoice has zero successful payments
- **THEN** a secondary CTA labelled "Hủy + Phát hành lại" opens the void modal for that invoice and on success surfaces a hint to reissue from the draft tab

#### Scenario: Void+Reissue disabled when payments exist
- **WHEN** the issued invoice has at least one successful payment
- **THEN** the "Hủy + Phát hành lại" CTA is disabled with a tooltip explaining that paid invoices must be corrected via Adjustment

#### Scenario: Both CTAs hidden when period closed
- **WHEN** the period status is `closed`
- **THEN** the callout still renders the discrepancy text but hides both CTAs and explains that the period is closed
