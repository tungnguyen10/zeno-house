## 1. Server: display resolver foundation

- [x] 1.1 Create `server/services/billing/display.ts` exporting `BillingDisplayResolver` with batch lookup methods: `loadActors(ids)`, `loadInvoices(ids)`, `loadPeriods(ids)`, `loadTenants(ids)`, `loadRooms(ids)`, `loadContracts(ids)`. Each method memoizes within the resolver instance (per-request cache).
- [x] 1.2 Add `entityLabel(entityType, entityId, ctx)` and `entityHref(entityType, entityId, ctx)` helpers that consult cached batch results.
- [x] 1.3 Wire resolver into `server/services/billing/audit.ts` `list()` and `BillingPeriodService.getOverview()` audit slice.

## 2. Server: audit summary formatter

- [x] 2.1 Create `server/services/billing/audit-summary.ts` exporting pure `formatAuditSummary(action, metadata): string`.
- [x] 2.2 Implement formatters for actions documented in design D3 (period.opened/closed/status_changed, reading.saved, utility.override_saved, invoices.issued, invoice.voided/reissued/adjustment_created, payment.recorded, invoice.issue_attempted).
- [x] 2.3 Implement generic fallback `Hành động: <action>` when no formatter matches.
- [x] 2.4 Format dates as `DD/MM/YYYY` and currency as `1.500.000đ` using existing `app/utils/format` helpers (or duplicate minimal logic for server).

## 3. Server: enrich list endpoints

- [x] 3.1 Update `server/repositories/billing/audit.ts` list query to return `actor_id` raw; do NOT join in repo (resolver handles enrichment).
- [x] 3.2 Update `server/services/billing/audit.ts` `list()` to: fetch raw events, batch resolve actors + entities via `BillingDisplayResolver`, attach `actorName`, `actorEmail`, `entityLabel`, `entitySubLabel`, `entityHref`, `summary`.
- [x] 3.3 Update `server/services/billing/invoices.ts` list/detail to attach `tenantName`, `roomNumber`, `contractCode` via resolver.
- [x] 3.4 Update `server/services/billing/payments.ts` (or wherever payments are returned with `getWithCharges`) to attach `recordedByName`.
- [x] 3.5 Update `app/types/billing.ts` `Invoice`, `InvoicePayment`, `BillingAuditEvent` interfaces with new optional fields. Update `database.types.ts` consumers if needed.

## 4. Server: tests for resolver + formatter (smoke)

- [x] 4.1 Add minimal integration test (or manual repro script) verifying `BillingPeriodService.getOverview()` returns enriched audit events for a seeded period.
- [x] 4.2 Manually verify N+1 absence by logging Supabase query count for a period with 30+ audit events.

## 5. UI primitive: UiDrawer

- [x] 5.1 Create `app/components/ui/UiDrawer.vue` with props: `modelValue`, `title`, `width` (default `w-96`).
- [x] 5.2 Implement slide-in animation, backdrop, Esc + backdrop click to close, focus trap, `role="dialog"` + `aria-modal="true"`.
- [x] 5.3 Add `UiDrawer` to `/ui-showcase` page with example open/close.
- [x] 5.4 Document drawer in `docs/ui-patterns/design-system.md`.

## 6. UI primitive: UiToastHost + useToast

- [x] 6.1 Create `app/components/ui/UiToastHost.vue` mounted in `app/layouts/default.vue` (or `app.vue`).
- [x] 6.2 Create `app/composables/useToast.ts` with `success(message)`, `error(message)`, `info(message)`. Internal store via `useState` or simple ref.
- [x] 6.3 Position: top-right desktop, bottom-center mobile (Tailwind responsive classes). Auto-dismiss after 4s; pause on hover.
- [x] 6.4 Add toast usage to `/ui-showcase`.

## 7. Client: billing payments tab readability

- [x] 7.1 Update `app/components/billing/BillingPaymentsStep.vue` to render `tenantName` + `roomNumber` (formatted as `Võ Chí Linh · P.01`) in the contract column. Keep `contractId`/`roomId` available via row click for navigation.
- [x] 7.2 Show `recordedByName` in payment list rows.
- [x] 7.3 Adjustment modal: replace `reference_invoice_id` text input with `UiCombobox` (or `UiSelect` with search) populated from issued invoices in current period.

## 8. Client: billing audit drawer

- [x] 8.1 Update `app/components/billing/BillingAuditStep.vue` table columns: actor → `actorName` with email tooltip; entity → `entityLabel` + `entitySubLabel` (clickable when `entityHref` exists); detail → `summary`.
- [x] 8.2 Convert `BillingAuditStep` host from tab content to drawer body. Component itself stays portable.
- [x] 8.3 Remove raw `key=value` metadata dump from default render. Add a "Chi tiết kỹ thuật" expandable section that shows raw metadata JSON for debugging.

## 9. Client: workspace IA refactor

- [x] 9.1 Build `app/components/billing/BillingKpiStrip.vue` from existing `BillingOverviewStep.vue` content (reuse the metric blocks). Component is `position: sticky; top: ...` below header.
- [x] 9.2 Refactor `app/pages/billing/[building]/[period].vue`:
  - [x] 9.2.1 Remove tabs `Tổng quan`, `Nhật ký`, `Chốt kỳ` from `tabsModel`
  - [x] 9.2.2 Render `<BillingKpiStrip>` between `UiPageHeader` and `<UiTabs>`
  - [x] 9.2.3 Add `[Nhật ký]` button to `UiPageHeader` actions slot, opens `<UiDrawer>` with `<BillingAuditStep>` body
  - [x] 9.2.4 Add kebab menu button (`UiDropdownMenu` or equivalent) in `UiPageHeader` with `Chốt kỳ` item — disable for non-admin or when period not eligible; opens close-period confirmation modal containing `<BillingCloseStep>` body
- [x] 9.3 Verify only 3 tabs render: `Chỉ số & hoá đơn nháp`, `Phát hành`, `Thanh toán & công nợ`.

## 10. Client: draft grid polish

- [x] 10.1 In `BillingDraftGridStep.vue`, hide save bar (`<UiActionBar>` or sticky footer) when `period.status` is `issued`/`collecting`/`closed`.
- [x] 10.2 Replace or remove the no-op `Áp dụng cho dòng trống` button: implement it to fill the batch date into local state for cells where `current_reading_date` is empty, OR delete the button entirely. Decide during implementation; default = delete unless implementation is trivial.

## 11. Client: toast on mutations

- [x] 11.1 Wire `useToast` into composables (or page) for: issue invoices, record payment, void invoice, reissue invoice, create adjustment, save reading override.
- [x] 11.2 Surface server error messages via `error()` toast.

## 12. Cleanup

- [x] 12.1 Search for imports/usages of `BillingOverviewStep.vue`. If only the workspace page imported it, delete the file. If still used, leave with a TODO and create follow-up issue.
- [x] 12.2 Verify `BillingCloseStep.vue` still has a single mount point (kebab modal) and no leftover tab references.
- [x] 12.3 Run `npm run lint`, `npm run typecheck`. Fix any drift.
- [x] 12.4 Smoke-test every billing tab + drawer + kebab manually with a seeded period.

## 13. Documentation

- [x] 13.1 Update `docs/ui-patterns/design-system.md` with `UiDrawer`, kebab menu pattern, toast pattern.
- [x] 13.2 Update `docs/project-status.md` v0.2.5 cleanup section noting readability + IA polish landed.

## 14. Draft–issued discrepancy callout

- [x] 14.1 Server: extend draft response per contract with `existingInvoice: { id, totalAmount, paidAmount, status } | null`. Source: `activeInvoiceByContract` already computed in `server/services/billing/drafts.ts`.
- [x] 14.2 Types: add `existingInvoice` field to `BillingDraftInvoice` in `app/types/billing.ts` (optional).
- [x] 14.3 Build `app/components/billing/BillingDraftDiscrepancyCallout.vue`:
  - [x] 14.3.1 Props: `draft: BillingDraftInvoice`, `period: BillingPeriod`.
  - [x] 14.3.2 Computed `delta = draft.totals.draftTotal − draft.existingInvoice.totalAmount`.
  - [x] 14.3.3 Render only when `existingInvoice` exists and `|delta| >= 1000`.
  - [x] 14.3.4 Two CTA buttons with disabled rules per spec (paid → disable Void; closed → hide both).
  - [x] 14.3.5 Emit `intent:adjustment` with `{ invoiceId, amount: -delta, label }` and `intent:void-reissue` with `{ invoiceId }`.
- [x] 14.4 Mount `BillingDraftDiscrepancyCallout` inside `BillingDraftGridStep.vue` row expanded panel, near warnings section.
- [x] 14.5 Bubble intent events from `BillingDraftGridStep` up to `app/pages/billing/[building]/[period].vue`:
  - [x] 14.5.1 On `intent:adjustment` — switch tab to `payments`, focus invoice row, open adjustment modal pre-filled.
  - [x] 14.5.2 On `intent:void-reissue` — switch tab to `payments`, focus invoice row, open void modal; after void success show toast hint "Vào tab Chỉ số & hoá đơn nháp để phát hành lại".
- [x] 14.6 Update `BillingPaymentsStep.vue` to accept inbound intent (prop or shared store) and open the corresponding modal with prefilled fields.
- [x] 14.7 Adjust `useBillingInvoiceActions` adjustment payload helper to accept `referenceInvoiceId` + `label` shortcut so the prefill is one-liner.
- [x] 14.8 Smoke test: override electricity → row expanded shows callout with delta → click "Tạo điều chỉnh" → adjustment modal opens with `amount = -delta` and reference set → submit → invoice total updates → callout disappears.
