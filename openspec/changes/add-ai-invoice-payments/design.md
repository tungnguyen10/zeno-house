## Context

AI invoice mutations already use deny-by-default tool registration, server-owned action plans, confirmation leases, payload hashes, and scoped executors. Normal payment recording and the existing bulk-payment RPC do not provide the durable correlation replay contract required when an AI action commits but plan completion fails. The assistant therefore needs a payment-specific planner and database transaction without weakening the existing financial confirmation boundary.

## Goals / Non-Goals

**Goals:**

- Resolve one room, an explicit room list, or all unpaid rooms within one authorized building and one billing period.
- Derive the collection date, full remaining amount, invoice state, and snapshot entirely on the server.
- Record every eligible payment in one locked, validated, idempotent transaction with correlated audit events.
- Give operators a concise preview, skipped-row warnings, and success/replay feedback.

**Non-Goals:**

- Issuing invoices, partial collections, refunds, undo, payment transfer, or different methods/dates within one action.
- Fuzzy room selection, cross-building batches, fallback to older periods, or direct model/database mutation.
- Replacing the normal billing payment workflow or redesigning the AI chat surface.

## Decisions

### One batch contract for single and multiple rooms

`plan_record_invoice_payments` accepts a discriminated `selection`: `rooms` with 1–200 references or `all_unpaid`. A single room uses the same path with one entry. References are trimmed and deduplicated; matching is exact within the resolved building. This avoids divergent single/bulk behavior while keeping the tool schema bounded.

### Building ambiguity is resolved before rooms

When `building_ref` is absent, the planner auto-selects only when the user has exactly one building in scope. Multiple buildings return `needs_building_clarification` before any room lookup, preventing duplicate room codes from leaking or selecting the wrong building. Explicit references resolve only by scoped UUID, slug, or exact normalized name.

### Period and collection date are server-owned

An explicit year/month pair selects only that period. Otherwise the planner selects the newest period whose status is not `closed`; it never searches older invoices after selecting a period. The payment date comes from the owning user message timestamp converted to `Asia/Ho_Chi_Minh`. The model cannot provide an amount or date, and omitted payment method becomes `cash`.

### Mixed planning skips rows; confirmation remains atomic

Planning classifies each requested room as eligible, already paid, without an invoice, invalid, or blocked. An action is created only when at least one row is eligible and its payload contains only those rows; classifications are retained in preview warnings. At confirmation, any change to any eligible invoice or period invalidates the whole action, so no partial confirmation occurs.

### Dedicated RPC owns mutation and replay

`record_ai_invoice_payments_with_audit` is a `SECURITY INVOKER` public-schema RPC executable only by `service_role`. It first checks the action idempotency key/correlation ID, then locks the period and sorted invoice IDs, validates every expected version and balance, and only then inserts full-balance payments, marks invoices paid, transitions `issued` to `collecting`, and writes child plus batch audits. A replay returns the original authoritative batch result. The RPC recalculates amounts from locked invoice balances and never trusts a client/model amount.

Alternatives considered were calling `InvoicePaymentService.record` repeatedly or extending the current bulk RPC. Repeated service calls are not transactionally atomic, while the current bulk RPC trusts supplied amounts and lacks correlation replay; both are unsuitable for leased AI execution.

### Existing action lifecycle and UI primitives are reused

The new action type uses `billing.write`, ownership/scope checks, canonical payload hashing, execution leases, and the existing confirmation endpoint. A private payment switch defaults off in production. The existing action card gets a payment-specific summary and list; no new theme, token, or component primitive is introduced. The composable uses response `meta.replayed` to choose the success toast and never emits success on a failed confirmation.

## Risks / Trade-offs

- [Large batches increase lock time] → Cap explicit selection at 200, lock invoices in stable order, and validate before writes.
- [A room or invoice changes after preview] → Recalculate the canonical snapshot and mark the complete action stale before mutation.
- [Database commit succeeds but action completion fails] → Keep the action recoverable under its lease and replay the same correlation ID without duplicate payment or audit rows.
- [Model omits or invents identifiers] → Exact scoped resolution and server-owned payloads fail closed without revealing out-of-scope data.
- [Production flag is enabled before schema rollout] → Keep `NUXT_AI_INVOICE_PAYMENT_ENABLED` off by default and stage migration/SQL verification before enabling planning or execution.

## Migration Plan

1. Deploy and verify the additive RPC migration, grants, RLS assumptions, and idempotent replay in staging; regenerate database types only after the cloud migration is applied through the repository workflow.
2. Deploy code and UI with the payment flag disabled.
3. Enable chat/read tools, mutation planning, global execution, then invoice-payment execution after role/scope and staging smoke checks pass.
4. Roll back operationally by disabling the payment flag. The additive RPC may remain installed; code rollback requires no data migration.

## Open Questions

None. Selection modes, mixed-batch behavior, full-balance collection, period selection, default method, and confirmation requirements are locked by the approved plan.
