## ADDED Requirements

### Requirement: Invoice print-data API
The billing API SHALL provide a batch endpoint that returns printable snapshot data for 1 to 100 active invoice UUIDs.

#### Scenario: Authorized cross-period print data
- **WHEN** a caller with `billing.read` requests active invoice IDs within assigned building scope
- **THEN** the API returns enriched invoices, persisted charges, periods, and building identity in deduplicated request order

#### Scenario: Batch queries remain bounded
- **WHEN** the request grows from one to 100 invoices
- **THEN** invoice, period, building, display enrichment, and charge data are loaded through bounded batch operations rather than one detail request per invoice

#### Scenario: Any requested invoice is invalid
- **WHEN** an invoice is missing, outside building scope, or void
- **THEN** the whole request fails with 404, 403, or 409 respectively and returns no partial data

### Requirement: Invoice print-audit API
The billing API SHALL provide an invoice-centric audit endpoint accepting the same 1 to 100 active invoice UUIDs.

#### Scenario: Batch print intent recorded
- **WHEN** an authorized caller records print intent for active invoices
- **THEN** one `invoice.printed` event is appended per invoice using its billing period and one shared correlation ID

#### Scenario: Duplicate IDs submitted
- **WHEN** the request repeats an invoice ID
- **THEN** the endpoint records that invoice once

## REMOVED Requirements

### Requirement: Period-scoped invoice print audit endpoint
**Reason**: Printing is now shared across invoice surfaces and may span billing periods, so a period-scoped endpoint cannot represent the selected batch.

**Migration**: Replace `POST /api/billing/periods/[id]/invoices-printed` with `POST /api/billing/invoices/printed` and include the selected invoice UUIDs only.
