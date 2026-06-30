## ADDED Requirements

### Requirement: Billing audit — meter readings coverage
**Context**: `billing-api` spec defines audit requirements for billing operations. Meter reading saves MUST be captured.

`MeterReadingService.create`, `bulkCreate`, and `update` SHALL each append a `reading.saved` audit event to `billing_audit_events`.

#### Scenario: Save meter reading emits audit event
- **WHEN** a meter reading is saved (create or update) via `MeterReadingService`
- **THEN** a `reading.saved` audit event is appended to `billing_audit_events` with:
  - `entity_type: 'meter_reading'`
  - `entity_id: <reading_id>`
  - `billing_period_id: <period_id>` (nullable if no billing period exists for that month)
  - `before_data: null` (new reading) or previous reading snapshot (update)
  - `after_data`: saved reading snapshot
  - `metadata.count: 1`

### Requirement: Billing audit — invoice reissue snapshot
**Context**: `billing-api` spec requires consistent before/after snapshots on all mutating events.

The `invoice.reissued` audit event SHALL include full before/after snapshots consistent with other invoice mutation events.

#### Scenario: Invoice reissued event has full snapshot
- **WHEN** an invoice is reissued (void + reissue flow)
- **THEN** the `invoice.reissued` audit event MUST include:
  - `before_data`: the voided invoice snapshot
  - `after_data`: the new invoice snapshot
  - `metadata` retains existing fields (reason, replacement_for_invoice_id, etc.)
