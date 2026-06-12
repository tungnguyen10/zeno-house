## 1. Permission and reason policy

- [ ] 1.1 Add capability `billing.unissue` to permission registry (`server/utils/permissions.ts` or equivalent). Default: admin only.
- [ ] 1.2 Document capability in `openspec/specs/user-auth` reference / project status notes.
- [ ] 1.3 Implement reason validator helper (`server/utils/billing/reason.ts`) — `assertReason(reason, minLength = 10)` throws `VALIDATION_ERROR`.
- [ ] 1.4 Wire reason validator into existing service paths: `voidInvoice`, `reissueInvoice`, `saveOverride`, `createAdjustment` (when amount < 0 and abs >= 100000).
- [ ] 1.5 Update audit summary formatter (from change 1) to surface reason cleanly for `*.voided`, `*.reissued`, `period.unissued`, `utility.override_saved` actions.

## 2. Server: bulk payment endpoint

- [ ] 2.1 Add Zod schema `bulkPaymentsBodySchema` in `server/utils/validators/billing.ts`.
- [ ] 2.2 Implement `BillingPaymentsService.recordBatch(payments, actor)`:
  - [ ] 2.2.1 Validate non-empty array, each item via `recordPaymentSchema`.
  - [ ] 2.2.2 Track inserted payment IDs; on failure, delete inserted payments (rollback marker).
  - [ ] 2.2.3 Append single `payments.bulk_recorded` audit event with `{ count, total_amount, invoice_ids }`.
- [ ] 2.3 Implement endpoint `server/api/billing/invoices/bulk-payments.post.ts`:
  - [ ] 2.3.1 Permission guard `billing.write`.
  - [ ] 2.3.2 Parse + validate body, call service, return summary.
  - [ ] 2.3.3 Map domain errors to HTTP (CONFLICT, VALIDATION_ERROR).

## 3. Server: unissue endpoint

- [ ] 3.1 Implement `BillingPeriodService.unissue(periodId, reason, actor)`:
  - [ ] 3.1.1 Validate reason ≥10 (use helper from 1.3).
  - [ ] 3.1.2 Permission guard `billing.unissue`.
  - [ ] 3.1.3 Block if status `closed` → throw CONFLICT.
  - [ ] 3.1.4 Load invoices; partition `voidTargets` (no successful payments) vs `retained` (≥1 payment).
  - [ ] 3.1.5 Loop voidTargets calling `voidInvoice(reason)`.
  - [ ] 3.1.6 Update period status: `drafted` if retained empty else `collecting`.
  - [ ] 3.1.7 Append `period.unissued` audit event with full metadata.
- [ ] 3.2 Implement endpoint `server/api/billing/periods/[id]/unissue.post.ts`:
  - [ ] 3.2.1 Parse `{ reason }` body via Zod.
  - [ ] 3.2.2 Call service, return `{ voided, retained, status }`.

## 4. Server: Excel export

- [ ] 4.1 Add `exceljs` to dependencies (server-only, not in client bundle).
- [ ] 4.2 Implement `BillingExportService.buildPeriodWorkbook(periodId, ctx)`:
  - [ ] 4.2.1 Fetch period summary, invoices (enriched), payments (enriched).
  - [ ] 4.2.2 Build sheet `Hoá đơn` with column headers + rows per design D3.
  - [ ] 4.2.3 Build sheet `Thanh toán`.
  - [ ] 4.2.4 Build sheet `Tổng hợp` with KPI rows + highlight counts.
  - [ ] 4.2.5 Apply basic styling (header bold, currency format).
- [ ] 4.3 Implement endpoint `server/api/billing/periods/[id]/export.get.ts`:
  - [ ] 4.3.1 Permission guard `billing.read`.
  - [ ] 4.3.2 Stream workbook to response with correct Content-Type and Content-Disposition filename pattern.

## 5. Server: refresh batching

- [ ] 5.1 Update `BillingDraftService.getGrid(periodId)` (or equivalent) to return a single response containing grid rows + KPI strip metrics + draft preview state, so client only needs one GET after save.
- [ ] 5.2 Update API endpoint `GET /api/billing/periods/:id/grid` (or wherever current `loadGrid` calls) to include the merged payload.
- [ ] 5.3 Keep older `overview` / `drafts` endpoints functional (no breaking change) — only client switches to merged endpoint.

## 6. Client: draft grid bulk paste + auto-save

- [ ] 6.1 In `BillingDraftGridStep.vue`, add `paste` event listener on new-reading inputs.
- [ ] 6.2 Implement clipboard parser util `app/utils/billing/clipboard.ts` — splits by newline, normalizes decimal separator, returns `string[]`.
- [ ] 6.3 Apply parsed values to focused cell + downstream editable cells; highlight class `bg-amber-100/40` for 1.5s.
- [ ] 6.4 Replace explicit "Lưu nháp" button with debounced (800ms) auto-save per row; show per-row save state indicator.
- [ ] 6.5 Implement keyboard nav: `Tab`, `Shift+Tab`, `Enter`, `Shift+Enter` per spec.
- [ ] 6.6 After successful save, refresh via single `loadGrid()` (no more parallel `loadOverview` + `loadDrafts`).

## 7. Client: inline 2-line mobile row

- [ ] 7.1 Remove `hideOnMobile: true` flags from draft grid columns.
- [ ] 7.2 Add `MobileDraftRow.vue` (or template variant) showing 2-line layout per design D9.
- [ ] 7.3 Switch between desktop table and mobile row using Tailwind `md:` responsive classes.

## 8. Client: bulk payment

- [ ] 8.1 Add checkbox column to `BillingPaymentsStep.vue` table; show only when row has remaining balance.
- [ ] 8.2 Add header select-all checkbox.
- [ ] 8.3 Render sticky bulk action bar with selected count + "Ghi thu hàng loạt" button.
- [ ] 8.4 Build `BillingBulkPaymentModal.vue`:
  - [ ] 8.4.1 Common fields: payment method, payment date, note.
  - [ ] 8.4.2 Per-row inline editor for amount (default = balance).
  - [ ] 8.4.3 Submit calls `POST /api/billing/invoices/bulk-payments`.
  - [ ] 8.4.4 On 409 with `details.failed_index`, highlight the failing row and toast error.
- [ ] 8.5 Add composable method `useBillingPeriodWorkspace().recordBulkPayment(...)`.

## 9. Client: unissue UI

- [ ] 9.1 Add kebab item "Hủy phát hành kỳ" to `app/pages/billing/[building]/[period].vue` workspace header (admin only, hidden otherwise).
- [ ] 9.2 Build `BillingUnissueModal.vue`:
  - [ ] 9.2.1 Show preview: "Sẽ huỷ N hoá đơn, giữ M hoá đơn đã thanh toán" using current period state.
  - [ ] 9.2.2 Reason textarea with live counter and ≥10 validation.
  - [ ] 9.2.3 Danger button "Xác nhận huỷ phát hành"; submit calls endpoint.
  - [ ] 9.2.4 On success, toast + reload workspace.
- [ ] 9.3 Disable kebab item when period status is `closed`; show tooltip explaining reason.

## 10. Client: Excel export

- [ ] 10.1 Add "Xuất Excel" button to workspace header actions or kebab menu.
- [ ] 10.2 Implement download flow: call endpoint, surface progress, handle download via blob URL.
- [ ] 10.3 Toast on failure with server message; loading state on button.

## 11. Tests + smoke

- [ ] 11.1 Add unit tests for `assertReason` helper (covered by `billing-test-baseline` change if active; otherwise add minimal tests here).
- [ ] 11.2 Add integration smoke (manual or scripted) for: bulk payment success, bulk payment partial failure, unissue with retained paid invoices, Excel download, bulk paste 30 rows.
- [ ] 11.3 Run `npm run lint`, `npm run typecheck` after each major step.

## 12. Documentation

- [ ] 12.1 Update `docs/ui-patterns/design-system.md` with bulk-select pattern, inline 2-line row pattern.
- [ ] 12.2 Document `billing.unissue` capability in `docs/architecture/rules.md` permissions section.
- [ ] 12.3 Update `docs/project-status.md` with new endpoints and capability.
