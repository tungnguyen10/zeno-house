## ADDED Requirements

### Requirement: Batch generate invoices endpoint
`POST /api/invoices/generate-batch` SHALL accept `{ period_start, period_end, electricity_rate, water_rate, building_id? }`. Generates invoices for all rooms with active contracts in scope. Returns `{ generated, skipped, errors, results: Array<{ room_id, room_number, status: 'success'|'skipped'|'error', invoice_id?, skip_reason?, error_message? }> }`. Always returns 200 unless server error. Requires auth + `invoices.create` permission.

#### Scenario: Batch generates for all eligible rooms
- **WHEN** admin runs batch for a period with multiple rooms having contracts
- **THEN** invoices created for all eligible rooms, results array shows per-room status

#### Scenario: Skips rooms without sufficient data
- **WHEN** a room has no active contract
- **THEN** that room appears in results with status='skipped' and skip_reason

#### Scenario: Single room error does not fail batch
- **WHEN** one room has a generate error (e.g., duplicate invoice)
- **THEN** batch continues, that room has status='error', others succeed
