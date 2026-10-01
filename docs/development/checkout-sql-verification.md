# Checkout SQL verification and deployment

This change is prepared for manual Dashboard deployment. It has **not been executed against a database** in the implementation workspace; no local database runtime was started. Source review and repository checks do not prove PostgreSQL runtime compatibility or concurrency behavior.

1. Positively identify the authorized cloud staging project. Keep checkout feature flags disabled.
2. Review and run `supabase/migrations/20261001143337_contract_checkout_settlement.sql` in the Dashboard SQL Editor. It runs in one transaction; failure rolls back the migration. Then apply `supabase/sql-editor/checkout-billing-report-snapshots.sql`.
3. Run `supabase/tests/contract-checkout-settlement.sql`. It borrows one existing staging contract's building/room/tenant as fixture references, changes the building's utility rates temporarily, asserts the 5,000,000 deposit / 650,000 debt / 4,350,000 refund example, stale receipt detection, operation replay, allocated receipt and historical guards, refund limits, corrections, and same-month successor identities. **Every fixture and configuration change is rolled back.** Use staging with no concurrent operators because fixture configuration changes temporarily lock the template building.
4. Run the two-session concurrency exercise below; run Supabase advisors and check function grants; regenerate `app/types/database.types.ts` from that staging schema. Never edit generated types manually.
5. Test the enabled server/UI on staging before enabling the building allowlist pilot.

## Data impact

Actual `deposit` receipts are backfilled once into source rows linked by unique `payment_id`. Contract face-value deposit is never treated as collected cash. Other and prepaid receipts are not auto-approved. Their explicit credit approval requires a reason and cannot exceed the source receipt; operational review of prepaid coverage remains required before approval. Legacy unscoped handovers remain NULL: staff must reconcile their contract identity explicitly. New handovers require a contract; monthly readings remain room-scoped. Existing handover creation and audited meter-writing RPCs are replaced to use these identities.

Source applications are `invoice_payments` rows with `funding_source` deposit/credit, plus both source and statement IDs. Existing invoice recomputation sums retain these applications; report cash sums must filter `funding_source='cash'`. Refund records describe an already performed transfer, never perform a bank transfer. Statements, refunds and application history are immutable. Confirmation augments effective same-contract invoices or creates final-only invoices; it never generates rent/services or a zero-total invoice.

## Concurrency exercise

On an isolated staging fixture, create and return a checkout with an open period and preview hash. In session A, begin a transaction, lock its contract `FOR UPDATE`, call confirmation using a fixed operation UUID and leave the transaction open. In session B, call confirmation using the same operation and hash: it must wait, then replay after A commits with exactly one statement and one set of applications/audit. A different operation must fail `CHECKOUT_ALREADY_CONFIRMED`. Repeat refund using the same operation and then competing amounts: only one legal set of source-linked refund rows may commit.

While A holds confirmation locks, try source receipt mutation, cash payment insertion, period close, and incidental editing in B. After A commits, source edits must be rejected, closed periods must block subsequent writes, and stale preview retries must fail. Existing billing writers use period-first locks while checkout locks contract-first; PostgreSQL may abort a competing transaction with a deadlock rather than accept inconsistent state. Retry the entire operation with its unchanged operation ID after refreshing the preview. No partial ledger/audit mutation may survive an aborted transaction.

## Linked financial corrections

`contract_checkout_correct(contract, actor, operation, invoice, amount, label, reason, expected_updated_at)` appends a signed adjustment to an active same-contract invoice in an open period. The line records original statement ID and operation ID. It preserves the original statement, actual cash receipts, source allocations, and actual refunds. Positive adjustments first apply any remaining approved credit and deposit in that order; only the remainder becomes dynamic outstanding debt. Further refunds are blocked while debt remains. Current refundable money derives from the live source ledger; the original statement preview stays immutable. A negative correction cannot reduce invoice total below already-paid funds; it raises `CHECKOUT_CORRECTION_REQUIRES_RECONCILIATION`.

Monetary reversal after allocation/refund requires reviewed reconciliation of returned actual funds and a source-linked receipt, not deleting or rewriting a prior transfer. There is no automatic bank recovery or silent ledger reversal in this change.

## Rollback and privilege checks

Before deployment, rollback is deletion of the unapplied files. After pilot financial history exists, do not drop ledger tables or the receipt/lifecycle guards. Disable feature enablement and retain read access/history; repair with a forward migration. A destructive schema rollback requires explicit reconciliation and approval.

Inspect `pg_proc` for every `contract_checkout_%` function and `create_contract_with_handover`: PUBLIC/anon/authenticated must have no EXECUTE privilege, service_role must have EXECUTE. Checkout tables must have RLS enabled and no browser grants. `service_role` is the trusted server boundary; SQL repeats source scope, closed period, version, operation replay, and ledger balance checks. Confirm deferred guards by running `SET CONSTRAINTS ALL IMMEDIATE` before rolling back fixture tests.

`contract_checkout_undo_cash` locks contract, period, invoice, and payment, soft-deletes cash only, recomputes active payment totals including deposit/credit applications, and appends the audit in the same transaction. It is idempotent for an already-deleted payment. Preview refuses invoice totals inconsistent with active payment rows.
