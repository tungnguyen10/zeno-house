## ADDED Requirements

### Requirement: Issued invoice printing belongs to collection workflow
The monthly workspace SHALL expose invoice printing in **Thu tiền & công nợ** and SHALL NOT expose printing from the **Soạn kỳ** draft grid.

#### Scenario: Draft composition has no print action
- **WHEN** the operator is entering readings or reviewing draft rows in **Soạn kỳ**
- **THEN** no invoice print action or print-specific selection label is shown

#### Scenario: Collection tab supports single print
- **WHEN** the operator opens the drawer for an active invoice in **Thu tiền & công nợ**
- **THEN** the drawer provides **In phiếu** using the shared invoice print route

#### Scenario: Collection tab supports bulk print
- **WHEN** the operator selects active invoices, including in a closed period
- **THEN** the sticky action bar allows the selected invoices to be printed

#### Scenario: Mixed selection cannot be bulk paid
- **WHEN** the print selection includes a paid invoice or another invoice ineligible for bulk payment
- **THEN** **In phiếu** remains available
- **AND** **Ghi thu hàng loạt** is disabled with eligibility guidance

## MODIFIED Requirements

### Requirement: Billing audit history
The system SHALL append audit events for billing-critical workspace actions with structured, queryable metadata supporting before/after diffs and correlation grouping, including print-dialog intent for issued invoice artifacts initiated from invoice surfaces.

#### Scenario: Period action audited
- **WHEN** a billing period is opened, status-changed, closed, or reopened
- **THEN** the system appends a billing audit event with actor, action, period, timestamp, and `metadata.trigger` of `manual`, `auto_from_issue`, or `auto_from_payment`

#### Scenario: Reading save audited with diff
- **WHEN** readings are saved from the billing workspace
- **THEN** the system appends `reading.saved` events that include `previous_value` and `new_value` in metadata to support diff rendering

#### Scenario: Utility override audited
- **WHEN** a utility usage override is created, updated, or cleared
- **THEN** the system appends `utility_override.saved` or `utility_override.cleared` with before/after metadata

#### Scenario: Invoice issue audited
- **WHEN** invoices are issued either through bulk issue or auto-issue-on-payment
- **THEN** the system appends `invoices.issued` per invoice, sharing a single `correlation_id` per atomic operation

#### Scenario: Payment action audited
- **WHEN** a payment is recorded, edited, or undone
- **THEN** the system appends `invoice.payment_recorded`, `payment.edited`, or `payment.undone` with actor, invoice ID, amount, method, and before/after when applicable

#### Scenario: Bulk payment audited with children
- **WHEN** a bulk payment is recorded across N invoices
- **THEN** the system appends one parent `payments.bulk_recorded` event and N child `invoice.payment_recorded` events sharing the parent's `correlation_id`

#### Scenario: Auto-issue + payment shares correlation
- **WHEN** the user triggers auto-issue-on-payment on a draft row
- **THEN** the resulting `invoices.issued` event and `invoice.payment_recorded` event share one `correlation_id`

#### Scenario: Print dialog intent audited
- **WHEN** an operator presses **In ngay** for one or more active invoices from an invoice surface
- **THEN** the system appends one `invoice.printed` event per invoice with actor, invoice ID, corresponding period ID, timestamp, and a shared batch correlation ID
