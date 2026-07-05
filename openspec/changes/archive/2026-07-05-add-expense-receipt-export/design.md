## Context

Billing owns a mature Excel export in `server/services/billing/export.ts` that builds an `ExcelJS` workbook, sets response headers, and appends an audit event. The client triggers it in `useBillingPeriodWorkspace.exportXlsx` by fetching a blob and parsing the `Content-Disposition` filename. The operations report needs the same download mechanics for a different dataset, so this change factors out the reusable pieces before adding a second exporter. Separately, expenses already carry a `receipt_url` column that no code populates; landlords expect to attach a photographed receipt. Fixed costs are configuration, but today they can only be managed from the report page, blurring input vs output.

## Goals / Non-Goals

**Goals:**

- Provide a monthly operations report Excel export scoped to a single building/month.
- Store and display receipt images for building expenses.
- Remove duplication between billing export and operations export (server Excel helpers, client download, slug helper).
- Move fixed-cost management to building settings and make the report fixed-cost view read-only.
- Add missing operating-cost categories without changing report math.

**Non-Goals:**

- PDF export, print stylesheet, or multi-month/annual export (later change).
- Custom or per-building categories.
- Receipt attachments for fixed costs, recurring, or prepaid records.
- Rewriting the billing export layout or its audit semantics.

## Decisions

### Shared server Excel helpers

Create `server/utils/excel.ts` exporting: `MONEY_FORMAT`, `TABLE_BORDER`, `viExportDate`, `styleTitleRow`, `styleTableRow(row, bold, colCount)`, `alignRightCells(row, from, to)`, and `setXlsxResponse(event, buffer, fileName)`. Refactor `BillingExportService` to import these and to use the existing `slugifyName` from `app/utils/format/slug.ts` instead of its private `slugify`.

Alternatives considered:

- Leave billing export untouched and copy helpers into ops export: rejected because it doubles maintenance of formatting and header logic.
- Build a generic "workbook builder" abstraction: rejected as premature; only two callers exist, so plain helpers are enough.

### Shared client download

Create `app/composables/useExportDownload.ts` exposing `downloadBlob(url, fallbackName)` that fetches a blob, parses the `Content-Disposition` filename, and triggers a browser download. Refactor billing to consume it; operations report reuses it.

### Operations export shape

`GET /api/operations-report/export` accepts `building_id`, `period_year`, `period_month`. The service reuses `OperationsReportService.getReport` output and renders a single-sheet workbook with a titled header (building name + period), revenue-by-type rows, fixed-cost rows, expense rows, utility margin, and profit totals. Filename: `bao-cao-van-hanh-<building-slug>-<year>-<month>.xlsx`.

### Receipt storage

Use a private Supabase Storage bucket `expense-receipts`. Object path: `<building_id>/<expense_id>/<uuid>.<ext>`. Upload path: `POST /api/building-expenses/[id]/receipt` (multipart) validates content type (jpeg/png/webp) and size (<= 5MB), stores the object, and writes `receipt_url` (the storage path, not a public URL). Reads return a short-lived signed URL via the service. Removal: `DELETE /api/building-expenses/[id]/receipt` clears the column and deletes the object. Manager may upload/remove within scope (same as expense write); it does not require void rights.

Alternatives considered:

- Public bucket with direct URL: rejected because receipts are financial documents and should not be world-readable.
- Store the file inline/base64 in Postgres: rejected for size and query bloat.

### Category widening

Add `insurance`, `bank_fee`, `fire_safety` before `other` in `EXPENSE_CATEGORIES`, with vi labels, and widen the `building_expenses.category` CHECK constraint. No report grouping logic changes because breakdowns are data-driven from the category value.

### Fixed-cost relocation

Move create/end/history management UI into `/buildings/[id]/settings` under a "Chi phí vận hành" section, gated by `building-fixed-costs.write`. The operations report keeps rendering applicable fixed costs but removes the inline add/edit controls (read-only), keeping the report an output surface.

### Export capability

Add `operations-report.export` to `OWNER_CAPABILITIES` (admin inherits). Manager is excluded: managers may view on-screen but not export the financial workbook.

## Risks / Trade-offs

- Storage RLS misconfiguration could leak receipts across buildings -> scope object paths by `building_id` and enforce scope in the service before returning signed URLs; do not rely on bucket RLS alone.
- Refactoring billing export risks regressions -> keep the refactor behavior-preserving and cover with existing billing export tests plus a snapshot of header/filename.
- Signed URL expiry could break a stale UI link -> generate signed URLs on demand at render/click, not at list time.
- Widening the category enum touches the DB constraint -> ship the constraint change in the same migration as the constant update to avoid insert failures.

## Migration Plan

1. Add migration to widen `building_expenses.category` CHECK; regenerate database types.
2. Create the `expense-receipts` bucket and RLS via migration/SQL; document manual application.
3. Add `server/utils/excel.ts`; refactor `BillingExportService` to shared helpers + `slugifyName`.
4. Add `app/composables/useExportDownload.ts`; refactor `useBillingPeriodWorkspace`.
5. Add operations export service + route; add `exportXlsx` to `useOperationsReport`; add export button.
6. Add receipt upload/remove routes + service; add upload/preview UI in the expense modal and expense rows.
7. Add categories to constants/labels/validators.
8. Move fixed-cost management into building settings; make the report fixed-cost section read-only.
9. Update docs; run typecheck, focused tests, and `openspec validate --specs`.
