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

## Workspace UI

The workspace route `/billing/[building]/[period]` has three tabs:

1. Draft grid: enter readings, review blockers, see discrepancy callouts.
2. Issue: issue eligible draft invoices.
3. Payments: collect payments, bulk collect, adjust, void/reissue.

Header overflow actions:

- audit drawer
- Excel export
- close period
- unissue period

## Issue Flow

Issuing invoices:

- requires `billing.write`
- recomputes drafts server-side
- skips contracts with existing non-void invoice for the period
- skips blocked drafts
- creates invoice and charge snapshots
- advances the period to `issued` when appropriate
- writes audit metadata

## Payment Flow

Payment operations live in `server/services/billing/payments.ts`.

Supported flows:

- single invoice payment
- bulk payments for selected invoices

Payment updates invoice paid amount, balance, and status.

## Correction Flows

There are three supported correction paths:

### Void + Reissue

Use when the invoice has no payments and the period is not closed.

Flow:

1. Void original invoice with reason.
2. Recompute fresh draft for the same contract/period.
3. Create replacement invoice.
4. Link replacement to original invoice.

### Adjustment

Use once collection has started or when replacing the invoice is not appropriate.

Rules:

- target invoice cannot be void
- closed period rejects adjustment
- negative adjustment cannot exceed paid amount
- large negative adjustments require a reason

### Period Unissue

Admin-only recovery for period-level mistakes.

Rules:

- requires `billing.unissue`
- requires reason with at least 10 characters
- blocked when period is `closed`
- voids unpaid invoices
- retains invoices with payments
- returns period to `draft` when nothing is retained, otherwise `collecting`

## Close Flow

Closing a period:

- requires `billing.close`
- allowed only from `issued` or `collecting`
- requires zero outstanding invoices
- writes audit metadata

## Export

`GET /api/billing/periods/[id]/export` returns an Excel workbook for the period. Export is available to users with `billing.read`.

## Important Files

- Page: `app/pages/billing/[building]/[period].vue`
- Period list composable: `app/composables/billing/useBillingPeriodList.ts`
- Workspace composable: `app/composables/billing/useBillingPeriodWorkspace.ts`
- Invoice actions composable: `app/composables/billing/useBillingInvoiceActions.ts`
- Draft grid: `app/components/billing/BillingDraftGridStep.vue`
- Payments: `app/components/billing/BillingPaymentsStep.vue`
- Bulk payment modal: `app/components/billing/BillingBulkPaymentModal.vue`
- Unissue modal: `app/components/billing/BillingUnissueModal.vue`
- Services: `server/services/billing/**`
- Repositories: `server/repositories/billing/**`
- Types: `app/types/billing.ts`
- Constants: `app/utils/constants/billing.ts`
- Validators: `app/utils/validators/billing.ts`
