## Context

Change 3 leaves the assistant at a server-authoritative billing draft. The direct billing stack already has an atomic `issue_period_invoices` RPC, but invoice void, reissue, and adjustment currently span repository writes and separately appended audits. The AI action foundation already provides owned plans, direct confirm/cancel endpoints, compare-and-set claims, server-generated idempotency keys, structured streaming, and deny-by-default tool exposure.

Invoice state is durable financial history. The model must only select a planner and explain previews; server services must recompute drafts, enforce capability and building scope, choose valid correction strategies, detect stale snapshots, and own every mutation. Production rollout also needs controls that are currently absent: server-side enablement, independent mutation shutdown, bounded provider calls, distributed request throttling, cleanup scheduling, and adversarial prompt tests.

## Goals / Non-Goals

**Goals:**

- Preview invoice issue from the current server draft and bind confirmation to an exact snapshot hash.
- Reuse the existing atomic issue RPC and make retries converge without duplicate active invoices or audits.
- Plan invoice void, reissue, and paid/partial invoice adjustment with explicit reasons and state-dependent rules.
- Make each correction mutation and its audit/link side effects one Postgres transaction shared by direct API and AI executors.
- Add correlation IDs across related correction events.
- Add production feature flags, mutation kill switch, rate limits, timeout/circuit breaking, retention scheduling, safe telemetry, and prompt-injection regression tests.

**Non-Goals:**

- Letting the model calculate invoice totals, synthesize charge lines, or choose arbitrary SQL/tool arguments.
- Automatically undoing payments, refunding money, closing periods, sending invoices, or notifying tenants.
- Treating chat confirmation language as authorization.
- Replacing the existing billing calculator, invoice tables, or action-plan lifecycle.
- Building a general-purpose workflow engine or supporting fuzzy invoice/tenant resolution.

## Decisions

### 1. Issue preview stores a canonical server draft snapshot

`plan_invoice_issue` accepts only a period ID, optional contract IDs, and optional due date. The planner calls `BillingDraftService.calculateDraft`, filters ready drafts exactly as `InvoiceService.issueInvoices` does, and builds a canonical snapshot from period version, target contract IDs, draft totals, charge lines, blockers, and existing invoice IDs. The action stores the snapshot hash and authoritative preview; the model never supplies totals or lines.

At confirmation the executor recalculates the same snapshot. Any changed period, reading, override, pricing input, contract eligibility, blocker, or existing invoice produces `OPTIMISTIC_LOCK_CONFLICT`, marks the plan stale, and issues nothing.

Alternative considered: only re-run issue and accept whatever is current. Rejected because the user would confirm a materially different financial result than the action card showed.

### 2. Confirmed issue reuses and hardens `issue_period_invoices`

The executor calls `InvoiceService.issueInvoices` with the stored contract IDs/due date and passes the plan idempotency UUID as the operation correlation/idempotency key. The RPC remains the owner of invoices, charges, period status, and success audit rows. It will recognize a repeated operation key and return its prior invoice set; the active-invoice unique index remains the final concurrent-issue guard.

Direct API issue uses the same service path and server-generated operation key. No AI-specific invoice insert path is added.

Alternative considered: call the existing direct API handler internally. Rejected because services are the reusable authorization/business boundary; handlers are transport adapters.

### 3. Correction planning is state-dependent and exact

Three planner/executor pairs are exposed:

- `plan_void_invoice` / `void_invoice` for an unpaid, non-void invoice in an open period.
- `plan_reissue_invoice` / `reissue_invoice` for a void invoice, using a freshly calculated draft for the same contract.
- `plan_paid_invoice_adjustment` / `add_invoice_adjustment` for partial/paid invoices where void is forbidden.

All planners accept exact invoice ID/code plus bounded reason and operation-specific fields. Services resolve the invoice, capability, period, building scope, payments, and current version. Plans store exact IDs, normalized user input, before/after financial preview, and invoice/period/draft versions. Confirmation reloads and revalidates them.

The assistant explains that payments must be undone through the existing explicit payment workflow when the requested correction cannot be represented safely; it never plans a refund or payment deletion implicitly.

Alternative considered: one polymorphic correction tool. Rejected because separate schemas and executor registrations make allowed effects, capabilities, telemetry, and kill switches easier to audit.

### 4. Postgres owns atomic correction writes and correlation

The migration adds service-only RPCs for void-with-audit, reissue-with-charges/link/audit, and adjustment-with-total-update/audit. Each RPC locks the invoice and period, validates expected versions and status, validates amounts/charge sums, applies all domain/link changes, and inserts audit rows under one correlation ID. Any failure rolls back all writes.

`InvoiceService.voidInvoice`, `reissueInvoice`, and `addAdjustment` will call these RPCs so direct APIs and AI confirmations have identical guarantees. Reissue inherits the void correlation when available; otherwise it uses its operation ID. Paid adjustment gets a dedicated correlation ID and preserves payment totals while updating balance/status under existing rules.

Alternative considered: compensate after a failed audit insert. Rejected because compensation cannot hide partial financial state from concurrent readers.

### 5. Runtime policy is enforced before model/tool execution

Private runtime configuration defines overall AI enablement, read-tool enablement, mutation enablement, per-action mutation switches, request/action limits, provider timeout, and circuit-breaker thresholds. Public configuration only controls UI visibility; server flags remain authoritative. The chat route rejects disabled traffic before storing a message or invoking a provider. Planning tools and confirm executors independently check mutation switches so an already-created card cannot bypass a later kill switch.

Rate limiting uses a small service-role Postgres function/table keyed by hashed user ID and time bucket, avoiding per-instance counters. Provider timeout uses an abort signal. A process-local provider circuit breaker stops new model calls after consecutive failures and resets after a bounded cooldown; it does not disable direct action confirmation, which remains controlled by mutation switches.

Alternative considered: only hide the chat widget. Rejected because clients and previously issued action cards can call server endpoints directly.

### 6. Prompt injection is treated as untrusted content, not a classifier problem

The system prompt explicitly treats user content, stored messages, building names, room labels, and tool results as data that cannot redefine policy. Security tests send adversarial instructions through chat/tool inputs and prove that unregistered tools, direct mutations, model-supplied confirmation, out-of-scope IDs, and model-supplied invoice totals remain unavailable. The security boundary is schema + policy + service authorization, not prompt wording alone.

### 7. Retention cleanup runs as a bounded scheduled task

A Nitro task calls the existing service-role `cleanup_expired_ai_conversations(limit)` RPC in bounded batches and is scheduled daily. It emits counts/duration only, never message content. The task can be disabled independently and repeated safely; expired rows cascade to messages and action plans.

## Risks / Trade-offs

- [Draft hashing changes when serialization changes] → Centralize canonical snapshot construction and test key ordering and numeric fidelity.
- [Correction RPCs are security-sensitive service-role functions] → Revoke browser roles, repeat state/version validation in SQL, run remote lint, and test grants/contracts.
- [A provider circuit is process-local] → Use it only for fast provider protection; distributed request limiting and mutation switches remain database/config backed.
- [Rate-limit storage adds write load] → Use coarse buckets, indexed keys, bounded retention, and cleanup in the same daily task.
- [A stale action is inconvenient] → Return a clear stale result and require a fresh preview rather than silently changing invoice amounts.
- [Reissue after a separate void is not one transaction across user think time] → Make each confirmed step atomic and correlate the later reissue to the original void; never hold database locks across conversation turns.
- [Paid adjustment semantics are complex] → Reuse existing validation, prohibit implicit refunds/payment deletion, and show before/after balance explicitly.

## Migration Plan

1. Add the atomic correction/idempotent issue RPC changes and distributed rate-limit storage through a Supabase CLI migration with explicit revokes/grants and rollback notes.
2. Apply the migration manually, regenerate remote database types, and run focused SQL contract checks plus remote database lint.
3. Route existing direct invoice mutation services through the new RPC contracts before registering AI executors.
4. Add issue/correction planners, stale snapshot helpers, executor policy, action-card previews, and adversarial tests.
5. Add runtime controls, provider timeout/circuit breaker, rate limits, cleanup task/schedule, and feature-flagged UI rollout.
6. Update current-state docs and API inventory, then run OpenSpec validation, focused tests, typecheck, full tests, lint, and remote database lint before archive.

Rollback disables AI mutation flags first, then reverts application callers. Additive RPCs and rate-limit storage can remain inert until no deployed server references them; destructive rollback is performed only after that point.

## Open Questions

None. Payment undo/refund remains an explicit existing workflow and is deliberately not inferred by AI.
