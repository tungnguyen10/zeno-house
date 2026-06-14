# Tasks

## 0. Prerequisite Design System Adoption

- [x] 0.1 Complete `adopt-operational-design-system` before implementing billing UI screens
- [x] 0.2 Confirm compact `UiInput`, `UiSelect`, and `UiTextarea` are available for dense billing rows
- [x] 0.3 Confirm searchable select primitive is available for building/room/tenant/contract/invoice selection
- [x] 0.4 Confirm `UiTable`, `UiTabs`, `UiMetric`, `UiToolbar`, `UiSection`, `UiAlert`, `UiStatusBadge`, `UiModal`, and optional `UiDrawer` cover the billing workspace needs (UiDrawer omitted per spec — billing will use `UiModal` for confirmation/correction surfaces)
- [x] 0.5 Confirm `/ui-showcase` demonstrates the primitives/states that billing will rely on (UiPageHeader, UiCombobox, UiTable density, UiStatusBadge with `context="period|invoice|correction"` already shown)
- [x] 0.6 Document any remaining primitive gap before starting billing UI, rather than building a billing-only duplicate component (no gap; `UiDrawer` is optional and not used in v1 billing UI)

## 1. Supabase Manual SQL

- [x] 1.1 Prepare a single SQL script for Supabase Dashboard SQL Editor; do not rely on `supabase db push` (`supabase/migrations/20260611000000_billing_runtime.sql`)
- [x] 1.2 Add preflight checks confirming the 6 billing tables do not already exist (header preflight block)
- [x] 1.3 Create `billing_periods` with constraints, indexes, trigger, and RLS
- [x] 1.4 Create `invoices` with constraints, indexes, trigger, and RLS
- [x] 1.5 Create `invoice_charges` with constraints, indexes, and RLS
- [x] 1.6 Create `invoice_payments` with constraints, indexes, trigger, and RLS
- [x] 1.7 Create `billing_utility_usages` with constraints, indexes, trigger, and RLS
- [x] 1.8 Create `billing_audit_events` with constraints, indexes, and RLS
- [x] 1.9 Add post-apply verification queries for columns, constraints, indexes, triggers, and RLS
- [x] 1.10 Add rollback notes for all 6 tables
- [x] 1.11 After manual SQL is applied, regenerate Supabase database types **(types regenerated; mapper `app/utils/mappers/meter-readings.ts` adjusted for nullable `created_at`/`updated_at`)**

## 2. Billing Domain API

- [x] 2.1 Add billing permissions: `billing.read`, `billing.write`, `billing.close`
- [x] 2.2 Add repository/service for billing periods
- [x] 2.3 Add draft calculation service that builds recomputable invoice drafts from existing source tables
- [x] 2.4 Add blockers/warnings model for missing readings, missing rates, negative consumption, duplicate invoices, and tiered electricity
- [x] 2.5 Add endpoint to list billing periods with filters for building, year/month, status, and debt state
- [x] 2.6 Add endpoint to open/get a billing period by building + period
- [x] 2.7 Add endpoint to fetch workspace overview
- [x] 2.8 Add endpoint to fetch draft charges
- [x] 2.9 Add endpoint to issue invoices transactionally
- [x] 2.10 Add endpoint to void an issued unpaid invoice with reason, actor, timestamp, and audit event
- [x] 2.11 Add endpoint to reissue a replacement invoice linked to the voided invoice
- [x] 2.12 Add endpoint/service for adjustment charge creation on current/future invoices when the original invoice already has payments or belongs to a closed period
- [x] 2.13 Add endpoint to record invoice payments and update paid/balance/status transactionally
- [x] 2.14 Add endpoint to close a period with `billing.close`
- [x] 2.15 Add utility usage override service for meter replacement/reset/correction cases
- [x] 2.16 Add billing audit event writer and append events for open period, status change, reading save, utility override, issue attempt, invoice issue, void, reissue, adjustment, payment record, and close period
- [x] 2.17 Ensure issued invoice charges store calculation metadata needed to reconstruct monthly snapshots

## 3. Billing Workspace UI

- [x] 3.1 Update `/billing` into a billing period list and monthly work queue using `UiPageHeader`, `UiToolbar`, `UiMetric`, `UiTable`, `UiStatusBadge`, `UiAlert`, `UiSkeleton`, and `UiEmptyState`
- [x] 3.2 Add filters for building, month/year, status, and debt state using design-system controls and searchable select where needed
- [x] 3.3 Add create/open period action from `/billing`
- [x] 3.4 Add workspace route scoped by `buildingId + YYYY-MM` with `UiPageHeader`, period status badge context, and role-aware primary actions
- [x] 3.5 Add workspace navigation with `UiTabs` for overview, readings, review charges, issue invoices, payments/debt, audit, and close period
- [x] 3.6 Add overview step with `UiMetric` totals for period status, coverage, missing readings, draft total, issued total, paid total, and debt total
- [x] 3.7 Embed bulk meter reading entry in the Readings step using selected period from the workspace route and compact primitive inputs for editable rows
- [x] 3.8 Add utility usage override UI for meter replacement/reset using modal/drawer pattern, compact controls, required reason, source context, and note
- [x] 3.9 Add Review Charges step with `UiTable` per-room/per-contract line item preview, numeric alignment, blockers, warnings, and contextual status badges
- [x] 3.10 Add Issue Invoices action with `UiModal`/confirmation, blocker alerts, and idempotency handling
- [x] 3.11 Add invoice correction UI for void/reissue when invoice has no payments, including source context and required reason
- [x] 3.12 Add adjustment UI for paid invoice or closed-period correction, including original invoice reference and current/future period target
- [x] 3.13 Add Payments/Debt step with `UiTable` for recording payments and showing paid/partial/unpaid/overdue using invoice status context
- [x] 3.14 Add billing audit step with dense list/table of actor, action, entity, timestamp, and metadata summary
- [x] 3.15 Add Close Period step with role-aware action, confirmation surface, locked-state messaging, and `billing.close` permission handling
- [x] 3.16 Ensure billing UI introduces no raw `input`, `select`, `textarea`, `table`, or `button` markup except documented exceptions or primitive internals

## 4. Boundary Updates

- [x] 4.1 Keep contract payments as contract-level deposit/prepaid/legacy records
- [x] 4.2 Ensure monthly invoice payments use `invoice_payments`
- [x] 4.3 Ensure room detail does not become a monthly billing entry point
- [x] 4.4 Ensure building detail only links into `/billing`

## 5. Verification

- [x] 5.1 Validate OpenSpec change with `openspec validate monthly-operations-workspace --strict`
- [x] 5.2 Run typecheck/lint/test commands available in the project
- [x] 5.3 Verify manager/admin permission behavior for billing endpoints
- [x] 5.4 Verify Supabase RLS is enabled for all new tables
- [x] 5.5 Verify a happy path: open period -> enter readings -> review charges -> issue invoices -> record partial/full payment -> close period
- [x] 5.6 Verify blockers prevent issuing when required readings/rates are missing
- [x] 5.7 Verify issued invoices remain unchanged after later edits to contract/service/reading source data
- [x] 5.8 Verify audit events exist for all billing-critical actions in the happy path
- [x] 5.9 Verify meter replacement calculation uses utility usage override and snapshots previous/current/replacement values into invoice charge metadata
- [x] 5.10 Verify correction flow: pre-issue edit recalculates draft, unpaid issued invoice can be voided/reissued, paid invoice correction creates adjustment, closed period blocks normal edits
- [x] 5.11 Verify `adopt-operational-design-system` is complete before billing UI implementation is considered complete
- [x] 5.12 Run raw UI scans on billing pages/components for `<input`, `<select`, `<textarea`, `<table`, and `<button`; resolve or document every remaining match
- [x] 5.13 Verify `/billing` and representative workspace tabs render correctly at desktop and mobile widths without text overflow, card nesting, or overlapping controls
- [x] 5.14 Verify billing status badges use explicit period/invoice/correction context

## 6. Optimize Billing Draft Grid

- [x] 6.1 Capture `optimize-billing-draft-grid` as the finishing scope inside `monthly-operations-workspace`, not as a separate archived change
- [x] 6.2 Define draft-grid DTO types for `BillingDraftGridResponse`, `BillingDraftGridRow`, and `BillingDraftGridUtilityCell`
- [x] 6.3 Add draft-grid API/read model endpoint by composing existing period, room, meter reading, utility override, invoice, and draft calculation data
- [x] 6.4 Keep draft-grid API composition in service/API code; do not introduce a new repository layer for this optimization
- [x] 6.5 Ensure draft-grid required reading counts are derived from active billing contracts and pricing rules that require meter readings, not from `rooms.status = 'occupied'` alone
- [x] 6.6 Include optional vacant baseline rows in the read model without creating draft invoices or blocking issue
- [x] 6.7 Include issued/closed editability state in each draft-grid row and utility cell
- [x] 6.8 Include override metadata and warning context in utility cells when `billing_utility_usages` applies
- [x] 6.9 Implement `BillingDraftGridStep` using `UiTable`, compact controls, `UiStatusBadge`, `UiAlert`, `UiModal`, and design-system layout primitives
- [x] 6.10 Render desktop columns: TT, Chi tiết, Phòng, Khách thuê, Số điện mới, Số nước mới, Tiền điện, Tiền nước, Phòng/Dịch vụ, Tổng nháp, Trạng thái, Thao tác
- [x] 6.11 Render mobile row layout that avoids full horizontal table scanning and preserves edit/read/recompute actions
- [x] 6.12 Add toolbar with batch reading date, `Áp dụng cho dòng trống`, and filters for `Cần xử lý`, `Tất cả`, `Phòng trống`, `Có lỗi`, and `Đã sẵn sàng`
- [x] 6.13 Apply reading date defaults: existing date preserved, current period defaults to today, past period defaults to last day of the period
- [x] 6.14 Track local unsaved reading changes and submit only changed meter readings on `Lưu & tính lại`
- [x] 6.15 Refresh draft-grid read model and overview totals after saving readings or utility overrides
- [x] 6.16 Preserve selected filter and expanded row state across draft-grid refresh when possible
- [x] 6.17 Add row details expansion for full invoice line items, blockers, warnings, and override actions
- [x] 6.18 Add utility override modal from a row/utility cell with previous/current values, old meter final, new meter start, billable usage, reason, and note
- [x] 6.19 Replace `BillingReadingsStep` and `BillingDraftReviewStep` wiring in the workspace with `BillingDraftGridStep`
- [x] 6.20 Drop separate `Nhập chỉ số` and `Soát hoá đơn` tabs from workspace navigation; add one `Chỉ số & hoá đơn nháp` tab
- [x] 6.21 Keep `Phát hành` as a separate tab for v1 and make it reflect the same draft-grid/draft blocker state
- [x] 6.22 Ensure period states `issued`, `collecting`, `partial/paid invoice rows`, and `closed` render draft-grid rows as read-only
- [x] 6.23 Verify active-contract room happy path: enter electricity/water readings, save/recompute, see utility amounts and draft total, then issue from `Phát hành`
- [x] 6.24 Verify vacant room baseline: optional reading can be saved, no invoice is created, and missing vacant readings do not block issue
- [x] 6.25 Verify blocker row: missing utility pricing or required reading shows blocker in the row and prevents issue
- [x] 6.26 Verify electricity override row: negative/replacement case saves override, recomputes billable usage, shows warning, and snapshots override metadata when issued
- [x] 6.27 Verify issued period behavior: draft-grid rows are read-only and correction guidance points to void/reissue or adjustment flow
- [x] 6.28 Verify closed period behavior: all normal reading inputs and override actions are disabled
- [x] 6.29 Verify desktop and mobile draft-grid layouts for text overflow, overlapping controls, and scannability
- [x] 6.30 Update OpenSpec validation and task status after the draft-grid optimization is implemented
