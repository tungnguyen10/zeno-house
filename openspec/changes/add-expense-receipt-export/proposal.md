## Why

The operations report can record building expenses and fixed costs, but operators cannot attach proof of payment or take the numbers out of the app. Landlords habitually photograph receipts and need to hand a monthly figure to an accountant or owner. Billing already exports an Excel workbook through `BillingExportService`, so this change reuses that machinery for the operations report instead of duplicating it, and adds receipt image storage for expenses. It also relocates fixed-cost management to building settings (configuration) so the report stays an output surface, and widens the expense category enum with a few missing operating costs.

## What Changes

- Add receipt image upload for building expenses backed by a Supabase Storage bucket, with capability + building-scope enforcement and a preview in the expense UI.
- Add an Excel export of the monthly operations report (revenue, fixed costs, monthly expenses, utility margin, profit) for a selected building/month.
- Extract shared server Excel helpers (`server/utils/excel.ts`) and a shared client download composable (`app/composables/useExportDownload.ts`), and refactor billing export to consume them without behavior change.
- Reuse the existing `slugifyName` helper in billing export instead of the local duplicated `slugify`.
- Add expense categories `insurance`, `bank_fee`, and `fire_safety` to the enum, constants, labels, and validators.
- Relocate fixed-cost management (create/end/history) into `/buildings/[id]/settings` under a "Chi phí vận hành" section; the operations report shows applicable fixed costs read-only.
- Add an `operations-report.export` capability granted to admin/owner only.

## Capabilities

### New Capabilities

- `operations-report-export`: Excel export of the monthly operations report with capability + scope enforcement and shared export utilities.
- `expense-receipts`: Receipt image upload/storage/retrieval for building expenses with capability + scope enforcement.

### Modified Capabilities

- `operations-report`: Widen the expense category set, move fixed-cost management to building settings, and make the report's fixed-cost section read-only.

## Impact

- Database: no new tables. New Supabase Storage bucket `expense-receipts` with RLS; widened `building_expenses.category` CHECK constraint; regenerated database types.
- Server: new upload and export API routes/services; shared `server/utils/excel.ts`; billing export refactored to shared helpers and `slugifyName`.
- Client: new `useExportDownload` composable; receipt upload + preview in `OperationsExpenseModal`; export button on the operations report page; fixed-cost management moved into building settings.
- Docs/specs: new export/receipt capabilities; updates to operations-report, API, database, and auth-permissions docs.
