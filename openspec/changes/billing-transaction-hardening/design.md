## Context

Current billing writes are service-sequenced.

`InvoiceService.issueInvoices` (`server/services/billing/invoices.ts`) loops `InvoiceRepository.issueOne` per draft. Each `issueOne` inserts an invoice then its charges, with a best-effort `delete invoice` if the charges insert fails. There is no outer rollback across drafts: if `issueOne` for draft #3 fails after drafts #1-#2 succeed, the first two invoices remain committed and the period status advance + final audit append run anyway.

`InvoicePaymentService.recordBatch` (`server/services/billing/payments.ts`) maintains an explicit `undo()` that reverses payments in reverse insert order, restoring invoice totals via `updatePaymentTotals` and deleting the payment row. The rollback swallows errors silently, the post-loop `advanceStatus(collecting)` and bulk audit append are not part of any transaction, and a batch can touch multiple periods (and buildings) at once.

`server/` currently has zero `.rpc()` callers, so there is no existing precedent for an RPC-backed write path. Existing migrations already use `create or replace function` for triggers (`set_updated_at`, `slugify_text`), so PL/pgSQL functions are an accepted artifact in this repo.

Supabase/PostgREST does not automatically wrap multi-request service logic in one transaction. The hardening path is additive SQL RPC functions called by the server with service-role permissions.

## Goals / Non-Goals

**Goals:**
- Make invoice issue all-or-nothing.
- Make bulk payment all-or-nothing.
- Keep endpoint request/response shapes stable.
- Keep audit metadata consistent with committed financial writes.
- Document any required SQL as manual Supabase Dashboard SQL.
- Lock in regression tests for current best-effort paths before replacing them.

**Non-Goals:**
- No payment gateway integration.
- No accounting ledger/double-entry model.
- No UI redesign.
- No table rewrite unless required by the selected transaction pattern.
- No port of `BillingDraftService.calculateDraft` pricing logic into SQL.

## Decisions

### D1 - Additive RPC Is The Transaction Mechanism

Use additive PL/pgSQL functions invoked via `supabase.rpc(...)` for the multi-table write portions. The server keeps permission checks, input validation, draft recomputation, and response enrichment. RPC functions own the atomic insert/update/audit write sequence.

Alternative considered: keep best-effort rollback and add more tests. Rejected because rollback cannot guarantee consistency if a delete/update rollback also fails.

### D2 - Validation Split: TS Owns Policy, SQL Owns Integrity

The server continues to validate user permissions, request shape, period state, blockers, overpayment, and reason policy before calling the RPC. SQL functions re-check only the invariants that protect financial integrity:

- Issue RPC re-checks: one non-void invoice per (period, contract); `sum(charges.amount) == invoice.total_amount`; period not closed.
- Bulk payment RPC re-checks: invoice exists and not void; `amount > 0`; `amount <= invoice.balance_amount`; period not closed.

These duplicate a thin slice of policy already enforced in TS, but they are the smallest set that prevents a corrupted commit if a client bypasses the service or if TS state goes stale during the call.

### D3 - Audit And Period Transitions Commit Inside The RPC

For issue and bulk payment, audit rows and period status transitions are inserted in the same transaction as financial rows. The RPC accepts the actor id and the audit metadata payload so the audit `actor_id`, `action`, `entity_type`, `entity_id`, and `metadata` are written by SQL, not appended after the fact.

For issue, both the `invoices.issued` event and any `period.status_advanced` audit caused by moving the period to `issued` belong inside the RPC. For bulk payment, the single `payments.bulk_recorded` event and any `period.status_advanced(collecting)` events for affected periods belong inside the RPC. Pre-write `issue_attempted` audits (when nothing is issuable) continue to be appended outside the RPC.

### D4 - Preserve API Contract

Existing endpoints keep their paths and response shapes. Client code should not need behavior changes beyond better error messages once partial-state rollback failures disappear. `IssueInvoicesResult` and the bulk-payment response (count, totalAmount, invoiceIds, payments) stay byte-compatible after enrichment.

### D5 - Issue RPC Accepts Materialized Draft Lines, Not Pricing Inputs

The issue RPC accepts already-computed draft invoices and charge lines from TS. SQL does not reimplement `BillingDraftService.calculateDraft` (pricing rules, overrides, blockers). SQL only verifies that `sum(line.amount) == invoice.total_amount` per draft and that the period/contract combination has no active invoice.

Alternative considered: recompute draft inside SQL to make the RPC self-contained. Rejected because pricing rules, overrides, and blocker logic are ~1000 lines of TS that would need to be ported and kept in sync.

### D6 - Invoice Code Generation Moves Into The Issue RPC

`buildUniqueInvoiceCode` currently reads max code then inserts with that code from TS, which has a time-of-check/time-of-use race when two issue calls hit the same period concurrently (the second one fails on the `invoices.invoice_code` unique constraint). The issue RPC takes an advisory transaction-scope lock on the period id, computes the next sequence in the same transaction as the inserts, and emits the codes back to TS.

### D7 - Bulk Payment RPC Accepts A Cross-Period Batch

The bulk payment RPC accepts an array of `{ invoice_id, amount, paid_at, payment_method, note }` plus the actor id and audit metadata. Inside one transaction it inserts all payment rows, recomputes invoice totals/status, advances any affected period from `issued` to `collecting`, and writes the single bulk audit event. A batch can span multiple periods and buildings; period transitions are derived from the affected invoices, not passed in by the caller.

On the first row that fails an invariant, the RPC raises and the whole transaction rolls back. The server maps the SQL error to the existing `failed_index` / `failed_reason` response shape using a structured error context (e.g. `RAISE EXCEPTION ... USING DETAIL = jsonb_build_object('failed_index', i, 'failed_reason', '...')`).

## Risks / Trade-offs

- [RPC functions duplicate some validation] -> Mitigation: D2 narrows DB checks to the smallest invariant set.
- [Manual SQL increases deployment care] -> Mitigation: include preflight, verification, and rollback notes in the migration.
- [Tests may need repository/RPC mocks] -> Mitigation: keep service tests focused on call behavior, extend the `tests/server/billing/sql-rls.test.ts` text-assertion pattern for the new RPC migration, mock `supabase.rpc(...)` in service tests.
- [Transaction work can become too broad] -> Mitigation: limit this change to issue and bulk payment only.
- [Refactor changes behavior silently for paths with no test today] -> Mitigation: phase 0 locks current best-effort behavior into tests before any RPC swap (`recordBatch` has zero tests today; `issueInvoices` has no mid-loop failure test).
- [Advisory lock contention on hot periods] -> Mitigation: lock is scoped to one period id per issue call and released at transaction end; bulk payment uses no advisory lock and relies on row-level invariants instead.

## Migration Plan

1. Lock in baseline tests for current best-effort paths (issue mid-loop failure, recordBatch success and undo).
2. Design SQL functions and payload shapes for issue and bulk payment.
3. Add additive migration with preflight, verification, security notes, and rollback statements.
4. Update services to call RPC functions after existing TS validation, preserving response shapes.
5. Add success and failure-path tests covering the new RPC paths.
6. Run billing service tests, SQL static tests, lint, and typecheck.

Rollback: revert service calls to existing sequential paths and drop additive functions using the migration rollback notes. Existing tables and data do not require rollback.

## Open Questions

_None remain; D5 closes the materialize-vs-recompute question, D3 closes the per-payment-vs-bulk audit question._
