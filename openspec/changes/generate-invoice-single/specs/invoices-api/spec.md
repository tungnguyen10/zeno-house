## ADDED Requirements

### Requirement: Generate invoice for single room
`POST /api/invoices/generate` SHALL accept `{ room_id, period_start, period_end, electricity_rate, water_rate, notes? }`, assemble invoice lines (rent, utility consumption, active service fees), create invoice in `draft` status, return full invoice with items. Returns 409 if non-cancelled invoice already exists for same room + overlapping period. Requires auth + `invoices.create` permission.

#### Scenario: Invoice generated with all line items
- **WHEN** admin generates invoice for room with contract, utility readings, and service fees
- **THEN** returns 201 with invoice containing rent line, electricity line, water line, and service fee lines

#### Scenario: Missing utility readings
- **WHEN** no utility readings found for period
- **THEN** invoice created without utility lines, response includes `warnings` array

#### Scenario: Duplicate period rejected
- **WHEN** non-cancelled invoice already exists for room + overlapping period
- **THEN** returns 409 CONFLICT

### Requirement: Get invoice detail
`GET /api/invoices/:id` SHALL return full invoice with items array. Requires auth.

#### Scenario: Invoice detail returned
- **WHEN** admin fetches invoice by id
- **THEN** returns invoice header + all invoice_items

### Requirement: Issue invoice
`PATCH /api/invoices/:id/issue` SHALL change invoice status from `draft` to `issued`. Only valid when status = `draft`. Returns 409 if already issued/paid/etc. Requires auth + `invoices.update` permission.

#### Scenario: Draft invoice issued
- **WHEN** admin issues a draft invoice
- **THEN** status changes to `issued`
