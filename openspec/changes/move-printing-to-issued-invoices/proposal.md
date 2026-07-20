## Why

Invoice printing currently starts from the draft-composition grid and rebuilds printable content from draft calculations. That placement allows unfinished billing rows to be printed and prevents the cross-period invoice browser from printing the issued invoice snapshot that operators actually recognize as complete.

## What Changes

- Move single and bulk print entry points to the issued-invoice surfaces: the monthly **Thu tiền & công nợ** tab and `/dashboard/invoices`.
- Introduce one invoice-centric print route and batch read API shared by both surfaces.
- Render printable documents from persisted invoice and charge snapshots, with current paid and balance totals.
- Permit printing active `issued`, `partial`, `paid`, and derived `overdue` invoices; reject `void` invoices.
- Preserve one `invoice.printed` audit event per invoice when the operator opens the browser print dialog.
- **BREAKING** Remove the draft-row print route and the period-scoped `invoices-printed` endpoint after all internal callers migrate.

## Capabilities

### New Capabilities

- `invoice-printing`: Shared invoice-centric print selection, batch data retrieval, printable artifact layout, status eligibility, and audit behavior.

### Modified Capabilities

- `invoices-browse`: Add single and current-page bulk print actions to the cross-period invoice browser and allow print in its read-only drawer.
- `monthly-operations-workspace`: Remove draft-grid printing and add single and bulk printing to the issued-invoice collection tab.
- `billing-api`: Replace the period-scoped print audit ping with invoice-centric batch print-data and print-audit endpoints.

## Impact

- Affects billing invoice services and repositories, API routes, DTOs, validators, route helpers, print-only pages/components, the monthly payment table, and the cross-period invoice list/drawer.
- Updates billing feature documentation, API inventory, project status, and accepted specs.
- Adds no database migration or dependency.
