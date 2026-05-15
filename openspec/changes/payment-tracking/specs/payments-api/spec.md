## ADDED Requirements

### Requirement: Record payment
`POST /api/payments` SHALL accept `{ invoice_id, amount, payment_method, payment_date, notes? }`, validate invoice is in `issued`|`partial`|`overdue` status, insert payment, recalculate and update invoice status (partial/paid), return payment + updated invoice status. Requires auth + `payments.create` permission.

#### Scenario: Payment recorded and invoice status updated
- **WHEN** admin records payment that brings total to full amount
- **THEN** payment created and invoice.status changes to `paid`

#### Scenario: Partial payment updates status to partial
- **WHEN** payment amount < remaining balance
- **THEN** invoice.status = `partial`

#### Scenario: Payment on draft invoice rejected
- **WHEN** invoice.status = `draft`
- **THEN** returns 409 CONFLICT

### Requirement: List payments for invoice
`GET /api/payments?invoiceId=<id>` SHALL return all payments for the invoice ordered by payment_date DESC. Requires auth.

#### Scenario: Payments listed for invoice
- **WHEN** admin fetches payments for an invoice
- **THEN** returns array ordered by payment_date DESC

### Requirement: Delete payment
`DELETE /api/payments/:id` SHALL delete the payment and recalculate invoice status. Admin only. Returns updated invoice status.

#### Scenario: Delete recalculates invoice status
- **WHEN** admin deletes a payment
- **THEN** invoice.status recalculated from remaining payments
