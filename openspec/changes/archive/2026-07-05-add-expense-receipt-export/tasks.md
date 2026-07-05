## 1. Shared Export Utilities (Refactor)

- [x] 1.1 Add `server/utils/excel.ts` with `MONEY_FORMAT`, `TABLE_BORDER`, `viExportDate`, `styleTitleRow`, `styleTableRow`, `alignRightCells`, and `setXlsxResponse`
- [x] 1.2 Refactor `server/services/billing/export.ts` to use the shared helpers and the existing `slugifyName` from `app/utils/format/slug.ts` (remove local `slugify`)
- [x] 1.3 Add `app/composables/useExportDownload.ts` exposing `downloadBlob(url, fallbackName)`
- [x] 1.4 Refactor `useBillingPeriodWorkspace.exportXlsx` to use `useExportDownload`
- [x] 1.5 Run billing export tests to confirm no behavior change (filename, headers, sheet structure)

## 2. Category Widening

- [x] 2.1 Add migration widening the `building_expenses.category` CHECK to include `insurance`, `bank_fee`, `fire_safety`
- [x] 2.2 Regenerate/update database types
- [x] 2.3 Add the three categories and vi labels to `app/utils/constants/operations-report.ts`
- [x] 2.4 Confirm Zod `z.enum(EXPENSE_CATEGORIES)` picks up the new values across client/server

## 3. Operations Report Export

- [x] 3.1 Add `operations-report.export` capability to the owner capability set (admin inherits; manager excluded)
- [x] 3.2 Add `server/services/operations-report/export.ts` building a single-sheet workbook from report data using shared Excel helpers
- [x] 3.3 Add `GET /api/operations-report/export` route with auth, validation, capability, and scope checks; stream via `setXlsxResponse`
- [x] 3.4 Add `exportXlsx` to `useOperationsReport` using `useExportDownload`
- [x] 3.5 Add an "Xuất Excel" action on the operations report page gated by `operations-report.export`
- [x] 3.6 Add server test for export permission/scope and a filename/shape assertion

## 4. Expense Receipts

- [x] 4.1 Add migration/SQL creating a private `expense-receipts` Storage bucket with scoped RLS; document manual application
- [x] 4.2 Add repository/service methods to upload, sign-read, and remove receipt objects with content-type and size validation
- [x] 4.3 Add `POST /api/building-expenses/[id]/receipt` and `DELETE /api/building-expenses/[id]/receipt` routes with capability + scope checks
- [x] 4.4 Return a short-lived signed URL when reading an expense receipt; never expose a public URL
- [x] 4.5 Add upload control + thumbnail preview to `OperationsExpenseModal`; show a receipt indicator/link on expense rows
- [x] 4.6 Add server test for upload validation, scope enforcement, and receipt removal

## 5. Fixed-Cost Relocation

- [x] 5.1 Add a "Chi phí vận hành" section to `/buildings/[id]/settings` with fixed-cost create/end/history gated by `building-fixed-costs.write`
- [x] 5.2 Reuse or adapt `OperationsFixedCostModal`; add end-range (effective-to) editing to close a cost when rent changes
- [x] 5.3 Make the operations report fixed-cost section read-only (remove inline add/edit controls)
- [x] 5.4 Keep manager without `building-fixed-costs.write` unable to see management controls

## 6. Documentation And Verification

- [x] 6.1 Update operations-report, API, database, and auth-permissions docs (export, receipts, categories, settings relocation)
- [x] 6.2 Run `npx openspec validate --specs`
- [x] 6.3 Run focused tests and `npm run typecheck`
- [x] 6.4 Manually smoke: upload/remove a receipt, export a month, verify manager cannot export, verify fixed-cost management only in settings
