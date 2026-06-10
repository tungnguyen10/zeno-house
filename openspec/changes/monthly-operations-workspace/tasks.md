# Tasks

## 1. Supabase Manual SQL

- [ ] 1.1 Prepare a single SQL script for Supabase Dashboard SQL Editor; do not rely on `supabase db push`
- [ ] 1.2 Add preflight checks confirming the 6 billing tables do not already exist
- [ ] 1.3 Create `billing_periods` with constraints, indexes, trigger, and RLS
- [ ] 1.4 Create `invoices` with constraints, indexes, trigger, and RLS
- [ ] 1.5 Create `invoice_charges` with constraints, indexes, and RLS
- [ ] 1.6 Create `invoice_payments` with constraints, indexes, trigger, and RLS
- [ ] 1.7 Create `billing_utility_usages` with constraints, indexes, trigger, and RLS
- [ ] 1.8 Create `billing_audit_events` with constraints, indexes, and RLS
- [ ] 1.9 Add post-apply verification queries for columns, constraints, indexes, triggers, and RLS
- [ ] 1.10 Add rollback notes for all 6 tables
- [ ] 1.11 After manual SQL is applied, regenerate Supabase database types

## 2. Billing Domain API

- [ ] 2.1 Add billing permissions: `billing.read`, `billing.write`, `billing.close`
- [ ] 2.2 Add repository/service for billing periods
- [ ] 2.3 Add draft calculation service that builds recomputable invoice drafts from existing source tables
- [ ] 2.4 Add blockers/warnings model for missing readings, missing rates, negative consumption, duplicate invoices, and tiered electricity
- [ ] 2.5 Add endpoint to list billing periods with filters for building, year/month, status, and debt state
- [ ] 2.6 Add endpoint to open/get a billing period by building + period
- [ ] 2.7 Add endpoint to fetch workspace overview
- [ ] 2.8 Add endpoint to fetch draft charges
- [ ] 2.9 Add endpoint to issue invoices transactionally
- [ ] 2.10 Add endpoint to void an issued unpaid invoice with reason, actor, timestamp, and audit event
- [ ] 2.11 Add endpoint to reissue a replacement invoice linked to the voided invoice
- [ ] 2.12 Add endpoint/service for adjustment charge creation on current/future invoices when the original invoice already has payments or belongs to a closed period
- [ ] 2.13 Add endpoint to record invoice payments and update paid/balance/status transactionally
- [ ] 2.14 Add endpoint to close a period with `billing.close`
- [ ] 2.15 Add utility usage override service for meter replacement/reset/correction cases
- [ ] 2.16 Add billing audit event writer and append events for open period, status change, reading save, utility override, issue attempt, invoice issue, void, reissue, adjustment, payment record, and close period
- [ ] 2.17 Ensure issued invoice charges store calculation metadata needed to reconstruct monthly snapshots

## 3. Billing Workspace UI

- [ ] 3.1 Update `/billing` into a billing period list and monthly work queue
- [ ] 3.2 Add filters for building, month/year, status, and debt state
- [ ] 3.3 Add create/open period action from `/billing`
- [ ] 3.4 Add workspace route scoped by `buildingId + YYYY-MM`
- [ ] 3.5 Add overview step with period status, coverage, missing readings, draft total, issued total, paid total, and debt total
- [ ] 3.6 Embed bulk meter reading entry in the Readings step using selected period from the workspace route
- [ ] 3.7 Add utility usage override UI for meter replacement/reset when current reading cannot be derived normally from previous reading
- [ ] 3.8 Add Review Charges step with per-room/per-contract line item preview and blockers
- [ ] 3.9 Add Issue Invoices action with confirmation and idempotency handling
- [ ] 3.10 Add invoice correction UI for void/reissue when invoice has no payments
- [ ] 3.11 Add adjustment UI for paid invoice or closed-period correction
- [ ] 3.12 Add Payments/Debt step for recording payments and showing paid/partial/unpaid/overdue
- [ ] 3.13 Add Close Period step with role-aware action and locked-state messaging

## 4. Boundary Updates

- [ ] 4.1 Keep contract payments as contract-level deposit/prepaid/legacy records
- [ ] 4.2 Ensure monthly invoice payments use `invoice_payments`
- [ ] 4.3 Ensure room detail does not become a monthly billing entry point
- [ ] 4.4 Ensure building detail only links into `/billing`

## 5. Verification

- [ ] 5.1 Validate OpenSpec change with `openspec validate monthly-operations-workspace --strict`
- [ ] 5.2 Run typecheck/lint/test commands available in the project
- [ ] 5.3 Verify manager/admin permission behavior for billing endpoints
- [ ] 5.4 Verify Supabase RLS is enabled for all new tables
- [ ] 5.5 Verify a happy path: open period -> enter readings -> review charges -> issue invoices -> record partial/full payment -> close period
- [ ] 5.6 Verify blockers prevent issuing when required readings/rates are missing
- [ ] 5.7 Verify issued invoices remain unchanged after later edits to contract/service/reading source data
- [ ] 5.8 Verify audit events exist for all billing-critical actions in the happy path
- [ ] 5.9 Verify meter replacement calculation uses utility usage override and snapshots previous/current/replacement values into invoice charge metadata
- [ ] 5.10 Verify correction flow: pre-issue edit recalculates draft, unpaid issued invoice can be voided/reissued, paid invoice correction creates adjustment, closed period blocks normal edits
