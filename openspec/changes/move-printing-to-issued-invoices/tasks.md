## 1. Invoice print server contract

- [x] 1.1 Add failing validator and service tests for 1–100 UUIDs, ordered deduplication, active-status validation, permission, cross-building scope, and bounded batch loading
- [x] 1.2 Add the invoice print request schema, print DTO, batch repository helpers, invoice print service, and print-data endpoint
- [x] 1.3 Add failing audit tests, then implement invoice-centric print audit with correct period IDs and one shared correlation ID

## 2. Shared print route and artifact

- [x] 2.1 Add failing tests for the shared route helper and invoice snapshot print card formatting
- [x] 2.2 Implement `/dashboard/invoices/print`, the shared open-window helper, and a neutral invoice snapshot card with two-up A4 print styling
- [x] 2.3 Remove the legacy building/period print route and period-scoped print-audit endpoint after callers migrate

## 3. Monthly collection workflow

- [x] 3.1 Add failing component tests for active-invoice print selection, closed-period printing, mixed payment eligibility, and drawer single-print intent
- [x] 3.2 Move print selection/actions into `BillingPaymentsStep` and remove print event, button, and print-specific copy from `BillingDraftGridStep` and its page parent

## 4. Cross-period invoice browser

- [x] 4.1 Add failing desktop/mobile component tests for active-only selection, single print, current-page bulk print, and selection reset
- [x] 4.2 Implement invoice browser checkboxes, accessible mobile card controls, sticky print action bar, and drawer print intent

## 5. Documentation and verification

- [x] 5.1 Update accepted specs, billing feature docs, API inventory, and project status to describe invoice-centric printing
- [x] 5.2 Run focused tests, OpenSpec validation, typecheck, full tests, lint, and desktop/mobile/A4 visual review
