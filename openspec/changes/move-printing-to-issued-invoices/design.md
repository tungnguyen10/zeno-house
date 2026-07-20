## Context

The existing print flow starts in `BillingDraftGridStep`, passes draft row keys through a building/period route, reloads the draft grid, and renders draft lines. It cannot be reused from the cross-period invoice browser and does not guarantee that an issued document uses persisted invoice charge snapshots. The invoice surfaces already expose issued invoices, charge detail APIs, selection patterns, and `billing.read` scope checks.

## Goals / Non-Goals

**Goals:**

- Make printing an issued-invoice capability shared by the monthly collection tab and cross-period invoice browser.
- Support single and current-result bulk printing of up to 100 active invoices.
- Render persisted invoice and charge snapshots while showing current paid and balance totals.
- Preserve per-invoice audit events without blocking the native print dialog.
- Keep desktop, mobile, and A4 layouts accessible and operationally dense.

**Non-Goals:**

- Printing draft or void invoices.
- Selecting invoices across server-pagination pages.
- Proving that paper/PDF output completed after the native print dialog opened.
- Adding a database migration, dependency, tenant-portal print action, or alternate receipt template.

## Decisions

### One invoice-centric route and two batch endpoints

Use `/dashboard/invoices/print?ids=<uuid,...>` for every entry point. The print page posts IDs to `print-data` for an all-or-nothing snapshot and posts the same IDs to `printed` immediately before `window.print()`. This avoids two rendering implementations and avoids N detail requests for bulk printing. Keeping audit separate prevents merely previewing a document from creating an audit event.

### Batch validation is strict and ordered

The request accepts 1–100 UUIDs. The service deduplicates while preserving request order, loads invoices/periods/buildings/charges in bounded batch queries, verifies `billing.read` and every building scope, and rejects the whole request for missing, inaccessible, or void invoices. Partial results would let an operator believe the original selection was printed when it was not.

### Printed content uses invoice snapshots

Each print item contains an enriched persisted invoice, its persisted charge rows, the billing period, and building identity. Charge amounts and meter metadata therefore remain the issued snapshot; `paidAmount` and `balanceAmount` come from the current invoice row so the printed debt summary reflects the time of preview.

### Selection has print semantics first on invoice surfaces

Every non-void invoice is selectable even when the period is closed. The collection tab retains its bulk-payment action, but enables it only when every selected invoice satisfies the existing payment eligibility rules. Single printing lives in detail drawers; bulk printing uses the established sticky action bar. The browse page clears selection when its page of results changes.

### Audit records print-dialog intent

The audit endpoint appends one `invoice.printed` event per invoice with the corresponding period ID and one shared correlation ID. The request is fire-and-forget so logging failures do not block printing. Browser APIs cannot distinguish completed printing from canceling the dialog, so this action means the operator pressed **In ngay**.

## Risks / Trade-offs

- [Long ID query strings] → Limit each batch to 100 IDs and provide explicit UI feedback above the limit.
- [Invoice becomes void after preview] → Revalidate status in both print-data and audit services; the print preview itself remains the last successfully loaded snapshot.
- [Mixed print/payment selection is confusing] → Keep print available and show bulk payment disabled with a concrete eligibility explanation.
- [Removal breaks saved legacy print URLs] → Treat the old route as internal-only and remove it with its only callers; document the breaking internal route change.
- [A4 overflow from many charge lines] → Preserve fixed two-up cards, hide overflow consistently, and test representative meter/service/adjustment content.

## Migration Plan

1. Add invoice print DTO, validation, service, and endpoints with tests.
2. Add the shared route/card/helper and migrate both invoice surfaces.
3. Remove the draft-grid event, legacy route, and period-scoped audit endpoint.
4. Update specs/docs and run narrow plus full verification.
5. Roll back by reverting the change; no data migration or irreversible state is introduced.

## Open Questions

None. Product scope, eligible statuses, selection behavior, template semantics, batch limit, and audit behavior are approved.
