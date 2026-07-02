# Billing And Monthly Operations

Billing is the highest-risk workflow in the app. It is implemented as a monthly period workspace per building.

## User Routes

- `/billing`: period queue and filters.
- `/billing/[building]/[period]`: monthly workspace, where `period` is `YYYY-MM`.
- `/billing/invoices/[id]`: invoice detail by `invoice_code` or id.

## Core Concepts

| Concept | Meaning |
| --- | --- |
| Billing period | One building/month operational period. |
| Draft invoice | Server-computed preview for an active contract. |
| Invoice | Issued snapshot of draft lines and totals. |
| Charge | Invoice line item. |
| Payment | Collection event applied to invoice balance. |
| Utility usage override | Manual billable-usage override for meter issues. |
| Audit event | Append-only record of billing actions. |

## Period Statuses

- `draft`
- `readings`
- `review`
- `issued`
- `collecting`
- `closed`

The current service code mostly transitions through draft/open, issued/collecting, and closed. Older or future statuses remain part of the type surface.

## Invoice Statuses

- `draft`
- `issued`
- `partial`
- `paid`
- `overdue`
- `void`

## Draft Calculation

Draft calculation lives in `server/services/billing/drafts.ts`.

It computes per active contract:

- prorated rent
- electricity
- water
- enabled contract services
- discount
- surcharge

Electricity and water use building pricing config:

- electricity: `per_kwh`, `fixed`, or blocked `tiered`
- water: `per_m3`, `per_person`, or `fixed_per_room`

Readings source order:

1. Current monthly reading.
2. Previous monthly reading.
3. Handover fallback when previous monthly reading is missing.
4. Explicit utility usage override when consumption needs correction.

Common blockers:

- missing current reading
- missing previous reading
- negative consumption
- missing electricity/water rate
- unsupported tiered electricity
- duplicate active invoice

Common warnings:

- handover fallback used
- utility override applied
- occupant count fallback to contract value

## Period Queue Metrics

Period list, workspace overview, draft calculation, and draft grid use the same server-side billing core definitions:

- billable contracts are overlapping contracts whose status is not `terminated`
- required reading progress is based on billable contract rooms and building pricing
- electricity requires a current monthly reading only for `per_kwh`
- water requires a current monthly reading only for `per_m3`
- `per_person` and `fixed_per_room` water do not add required reading work
- a saved utility usage override counts as complete for the matching room/meter

## Workspace UI

The workspace route `/billing/[building]/[period]` has **two tabs** (simplified from three in v0.2):

1. **Soạn kỳ** (draft-grid): enter readings, review blockers, bulk-issue ready rows, auto-issue-and-collect individual rows (when flag enabled).
2. **Thu tiền & công nợ** (payments): collect payments, bulk collect, void/reissue, undo individual payments.

Header overflow actions (`Hành động ▾`):

- audit drawer — with recent-24h badge when activity present
- Excel export
- close period (`Chốt kỳ`)
- unissue period (`Huỷ phát hành kỳ`)
- reopen period (`Mở lại kỳ`) — admin only, from `closed` back to `collecting`

## Issue Flow

Issuing invoices:

- requires `billing.write`
- recomputes drafts server-side
- skips contracts with existing non-void invoice for the period
- skips blocked drafts
- creates invoice and charge snapshots
- advances the period to `issued` when appropriate
- writes audit metadata

### Bulk Issue

Select multiple `ready` rows in the draft grid → "Phát hành (N)" button issues all selected contracts in one request.

### Auto-Issue and Collect (feature-flagged)

Each `ready` row in the draft grid shows an "Đã thu" button when `NUXT_PUBLIC_BILLING_AUTO_ISSUE_ENABLED=true`. Clicking it opens a modal to confirm payment details, then calls `POST /api/billing/periods/[id]/issue-and-pay` which atomically issues the invoice and records a full payment in one PL/pgSQL transaction (`public.issue_and_pay` RPC). The period advances to `collecting` on first success.

## Payment Flow

Payment operations live in `server/services/billing/payments.ts`.

Supported flows:

- single invoice payment
- bulk payments for selected invoices
- undo a recorded payment (`DELETE /api/billing/invoices/[id]/payments/[paymentId]`): soft-deletes the payment, recomputes `paid`/`balance`/`status`, emits `payment.undone` audit event. Blocked when period is `closed`.

Payment updates invoice paid amount, balance, and status.

## Correction Flows

There are two supported workspace correction paths. Adjustment APIs remain only for legacy/back-office compatibility and are not exposed in the billing workspace.

### Void + Reissue

Use when the invoice has no payments and the period is not closed.

Flow:

1. Void original invoice with reason.
2. Recompute fresh draft for the same contract/period.
3. Create replacement invoice.
4. Link replacement to original invoice.

### Paid Invoice Correction

Use when an invoice already has a payment and the period is not closed.

Flow:

1. Undo the payment.
2. Void the invoice with reason.
3. Correct readings or billing inputs.
4. Reissue the invoice.
5. Record the payment again.

### Period Unissue

Admin-only recovery for period-level mistakes.

Rules:

- requires `billing.unissue`
- requires reason with at least 10 characters
- blocked when period is `closed`
- voids unpaid invoices
- retains invoices with payments
- returns period to `draft` when nothing is retained, otherwise `collecting`

## Reopen Flow

Reopening a closed period:

- requires `billing.close`
- requires a reason with at least 10 characters
- only allowed from `closed` status
- transitions `closed → collecting`
- clears `closed_at`
- writes `period.reopened` audit event with `{ reason, prior_status, trigger: 'manual' }`

## Close Flow

Closing a period:

- requires `billing.close`
- allowed only from `issued` or `collecting`
- requires zero outstanding invoices
- writes audit metadata

## Export

`GET /api/billing/periods/[id]/export` returns an Excel workbook for the period. Export is available to users with `billing.read`.

## Audit Drawer

The audit drawer is opened via the `Hành động ▾` menu. It shows the full history of billing actions for the period.

Features:

- **Grouped by time**: today, yesterday, last 7 days, then by calendar month.
- **Category icons & colors**: create (emerald), edit (amber), destructive (rose), status (sky), other (slate).
- **Diff view**: `reading.saved`, `payment.undone`, and `utility_override.saved` events render an inline before → after delta.
- **Correlation grouping**: click "Xem cùng nhóm" on any event to filter to events sharing the same transaction.
- **Quick open**: `→ Mở` link navigates to the related invoice.
- **Filter bar**: multi-select actor, category chips, date range, free-text search (300ms debounce), "Chỉ critical" toggle.
- **Pagination**: "Tải thêm" loads the next page of events via cursor.
- **CSV export**: client-side, UTF-8 BOM, filename `audit-<period>-<date>.csv`.
- **Recent badge**: the `Hành động ▾` button shows a count badge for events in the last 24h.

Backed by `GET /api/billing/periods/[id]/audit` (supports actor/category/from/to/q/correlation_id/cursor/limit).

## Important Files

- Page: `app/pages/billing/[building]/[period].vue`
- Period list composable: `app/composables/billing/useBillingPeriodList.ts`
- Workspace composable: `app/composables/billing/useBillingPeriodWorkspace.ts`
- Audit list composable: `app/composables/billing/useBillingAuditList.ts`
- Recent audit count composable: `app/composables/billing/useRecentAuditCount.ts`
- Invoice actions composable: `app/composables/billing/useBillingInvoiceActions.ts`
- Draft grid: `app/components/billing/BillingDraftGridStep.vue`
- Payments: `app/components/billing/BillingPaymentsStep.vue`
- Auto-issue modal: `app/components/billing/BillingAutoIssueModal.vue`
- Audit drawer: `app/components/billing/BillingAuditDrawer.vue`
- Audit entry: `app/components/billing/BillingAuditEntry.vue`
- Unissue modal: `app/components/billing/BillingUnissueModal.vue`
- Services: `server/services/billing/**`
- Repositories: `server/repositories/billing/**`
- Types: `app/types/billing.ts`
- Constants: `app/utils/constants/billing.ts`
- Validators: `app/utils/validators/billing.ts`
- Audit grouping: `app/utils/billing/audit-grouping.ts`
- Audit category visuals: `app/utils/billing/audit-category.ts`
- Audit entity link: `app/utils/billing/audit-entity-link.ts`
