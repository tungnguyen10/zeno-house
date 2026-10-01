## Context

Approved plan: no automatic recalculation or creation of rent/services on checkout. D is actual deposit receipts less applications/refunds; N is existing outstanding invoice debt plus unbilled metered utilities and incidental charges; X is explicitly approved unallocated source money. Refund=max(D+X-N,0), due=max(N-D-X,0). Calculated utility charges round up to 1,000 VND; entered fees and balances remain exact.

## Decisions

- One checkout per contract, original end_date preserved. Draft -> returned; financial state is derived from posted settlement, invoices and refunds.
- Contract-specific handover_in/out; monthly readings remain room-scoped. Never infer an ambiguous old handover. Final metered usage begins at the last effective invoiced current_reading_value for that contract, otherwise its handover_in.
- Existing billable invoice is augmented with typed audited final charges; otherwise create one invoice for final charges only. Closed periods block changes. Do not create a zero-value invoice.
- Lock the contract, checkout, source funds, affected periods and invoices in stable order for settlement. Use preview snapshot hash and unique operation ids. Allocation order: approved credit then deposit; oldest invoice due first. Preserve actual receipts/refunds on corrections.
- Ledger source receipts are unique. Allocated sources cannot be edited/deleted. Deposit reporting must not include non-deposit contract payments.
- Server-owned RPCs deny public/anon/authenticated execution; services enforce capabilities and building scope before repository calls.
- Feature flag has a building allowlist. Once checkout history exists, lifecycle bypasses remain blocked even if the flag is disabled.
- New financial capabilities belong to owner/admin. Existing contract update permission controls handover; existing billing permissions control incidental input.

## Risks and rollout

Existing raw SQL snapshot functions and report aggregations require coordinated migration. A cloud staging target must be positively identified before applying migrations. Types are regenerated from the migrated schema, never hand-edited. Old terminated contracts require reconciliation; no financial history is rewritten. UI uses existing design tokens and primitives.
