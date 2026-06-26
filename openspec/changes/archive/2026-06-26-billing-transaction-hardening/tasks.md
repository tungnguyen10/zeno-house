## 0. Baseline Regression Tests

- [x] 0.1 Add `InvoiceService.issueInvoices` mid-loop failure test: mock `InvoiceRepository.issueOne` to succeed for drafts #1-#2 and reject for #3, assert current behavior (the throw propagates so drafts #1-#2 remain committed with no compensating delete, while period advance and the `invoices.issued` success audit are SKIPPED) so the RPC swap can prove the new all-or-nothing semantics removes the partial-commit window
- [x] 0.2 Add `InvoicePaymentService.recordBatch` happy-path test covering: single-period batch, multi-period batch, `issued -> collecting` transition, single `payments.bulk_recorded` audit event
- [x] 0.3 Add `InvoicePaymentService.recordBatch` failure-path tests: `InvoicePaymentRepository.insert` fails on row N, `InvoiceRepository.updatePaymentTotals` fails on row N, and `undo()` partial failure; assert current best-effort behavior to capture the baseline being replaced

## 1. Transaction Strategy

- [x] 1.1 Confirm RPC-backed PL/pgSQL functions as the transaction mechanism (per D1) and document file location, naming, and `Database['public']['Functions']` typing convention
- [x] 1.2 Document transaction boundaries for issue (one RPC per period call, covers invoices + charges + period status + period audit + issue audit + invoice code allocation) and bulk payment (one RPC per batch, covers payments + invoice totals + N period transitions + bulk audit)
- [x] 1.3 Define typed payload/result shapes for `issue_period_invoices` and `record_bulk_payments` without changing public endpoint contracts

## 2. Database Artifacts

- [x] 2.1 Add additive manual SQL for `issue_period_invoices(period_id, actor_id, drafts jsonb, audit_metadata jsonb)` including the `pg_advisory_xact_lock(period_id)`, per-draft `sum(charges) == invoice.total` check, invoice code allocation, period status transition, and audit inserts
- [x] 2.2 Add additive manual SQL for `record_bulk_payments(actor_id, payments jsonb, audit_metadata jsonb)` including per-row invariant checks, invoice total/status recompute, `issued -> collecting` transitions for affected periods, and the single bulk audit insert; raise structured exceptions carrying `failed_index` and `failed_reason` for invariant violations
- [x] 2.3 Include preflight, verification queries, security notes (SECURITY DEFINER decision + RLS interaction), and rollback statements in both migrations
- [x] 2.4 Extend `tests/server/billing/sql-rls.test.ts` pattern with text-based assertions for both new functions (function signature, advisory lock present for issue, invariant raises, audit insert present)

## 3. Invoice Issue Hardening

- [x] 3.1 Keep permission, request validation, and draft recomputation in `InvoiceService.issueInvoices`
- [x] 3.2 Replace the per-draft `issueOne` loop, `BillingPeriodService.advanceStatus`, and post-loop `BillingAuditService.append` with a single `supabase.rpc('issue_period_invoices', ...)` call. Invoice code allocation for the bulk-issue path now lives inside the RPC under a per-period advisory lock. NOTE: `buildUniqueInvoiceCode` is intentionally retained in `server/repositories/billing/invoices.ts` for the reissue single-invoice path (`InvoiceRepository.issueOne`) which is out of scope for this change; its residual TOCTOU risk is acceptable given single-call low concurrency.
- [x] 3.3 Preserve `IssueInvoicesResult` response shape; enrich returned invoice rows through `BillingDisplayResolver` exactly as today
- [x] 3.4 Add tests for: full success across N drafts (`forwards issuable drafts to issue_period_invoices and returns the issued rows`) and charge-write failure rollback (`aborts the whole batch and writes no success audit when issue_period_invoices fails`); the existing `issue_attempted` audit test was preserved. Invoice code race coverage is enforced by SQL static assertions (advisory lock present in `sql-rls.test.ts`) rather than a TS mock since the race is a DB-level concern.

## 4. Bulk Payment Hardening

- [x] 4.1 Keep permission, request validation, overpayment checks, and reason/error mapping in `InvoicePaymentService.recordBatch`
- [x] 4.2 Replace the per-row insert + `updatePaymentTotals` + `undo()` loop and the post-loop `advanceStatus` calls with a single `supabase.rpc('record_bulk_payments', ...)` call
- [x] 4.3 Preserve the existing `failed_index` / `failed_reason` response shape by mapping the structured SQL exception back into the existing CONFLICT error envelope
- [x] 4.4 Add tests for: full success single-period and multi-period batches, structured failure mapping (CONFLICT envelope with `failed_index`/`failed_reason`), error.message fallback when DETAIL is missing, and empty-payload short-circuit before the RPC call

## 5. Verification

- [x] 5.1 Run `npm test -- tests/server/billing` (69/69 pass)
- [x] 5.2 Run SQL static tests (`tests/server/billing/sql-rls.test.ts` plus new assertions — 6/6 pass)
- [x] 5.3 Run `npm run lint` (clean)
- [x] 5.4 Run `npm run typecheck` (clean)
- [x] 5.5 Manually review generated SQL before any Supabase Dashboard execution — owner: human operator before applying `20260626000000_billing_transaction_rpcs.sql`
