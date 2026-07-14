## Context

The archived foundation provides owned conversations, a capability-filtered tool registry, action plans, direct confirmation, compare-and-set claiming, server idempotency keys, optimistic version metadata, typed SSE, and action cards. Its production executor registry is deliberately empty.

The existing billing period API already enforces `billing.write`, resolves UUID/slug, checks building scope, and relies on the unique `(building_id, period_year, period_month)` constraint. However, it inserts the period and then appends `period.opened` audit in a second database request. That split can leave a period without audit, and a concurrent unique violation is surfaced as an internal database error instead of an idempotent replay. Existing building lookup also cannot safely resolve a natural name or report ambiguity.

## Goals / Non-Goals

**Goals:**

- Resolve UUID, slug, or exact case-insensitive building name only inside the authenticated user's scope.
- Let the model list scoped buildings, inspect meter status/period overview, and plan a period opening.
- Keep planning non-mutating and make a direct user click the only confirmation signal.
- Open-or-get a period and append its creation audit atomically and idempotently for AI and existing API callers.
- Revalidate capability, scope, building version, and current period state after confirmation.
- Preserve a durable result for replay and make concurrent confirmations/open attempts safe.

**Non-Goals:**

- Fuzzy/semantic building search or exposing out-of-scope matches.
- Entering meter readings, calculating drafts, issuing invoices, or correcting billing data.
- Adding new role capabilities or changing who can open periods.
- Scheduling retention cleanup or adding production rate limits/kill switches.

## Decisions

1. **Resolve inside scope before returning any candidate.** A dedicated AI building resolver obtains the user's assigned building IDs first and passes that filter into repository queries. UUID and slug are exact matches; name is exact case-insensitive matching. Zero matches returns not found and multiple name matches returns a small structured candidate list. This avoids querying globally and filtering afterward, which could leak that an out-of-scope building exists.

2. **Use structured clarification instead of guessing.** `plan_open_billing_period` returns one of `planned`, `already_exists`, `needs_clarification`, or `not_found`. Only `planned` contains an action plan. Candidate results contain safe display identifiers from the user's scope; the model must ask the user to choose and cannot choose an ambiguous building itself.

3. **Reuse the accepted action lifecycle.** The planning tool calls `AiActionService.createPlan` with action type `open_billing_period`, normalized UUID/year/month payload, a human-readable preview, and the building `updated_at` value in `resource_versions`. The executor registry adds exactly that action. No generic commit or model-callable confirmation tool is introduced.

4. **Treat an existing period as a read result, not a mutation plan.** Planning checks the unique building/month key. If a period already exists, the tool returns it and creates no action plan. Confirmation also rechecks via the transactional open-or-get operation so a period created between plan and confirm becomes a successful idempotent result.

5. **Move period creation plus audit into one SECURITY INVOKER RPC.** A new additive function inserts with `ON CONFLICT DO NOTHING`, selects the authoritative period, and inserts `period.opened` audit only when this invocation created the period. It returns the period row plus `created`. Execute privileges are revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`. Existing `BillingPeriodService.openOrGet` also uses this repository operation, removing the split write for direct API callers.

6. **Carry action correlation without trusting the model.** The executor passes the server plan ID and server-generated idempotency key to the RPC as audit metadata. The normalized model payload contains neither confirmation nor an idempotency field. Manual API calls use source `api` with null action identifiers.

7. **Revalidate optimistic context immediately before execution.** The executor loads the building by UUID within scope and compares `updatedAt` to the stored resource version. A mismatch raises `OPTIMISTIC_LOCK_CONFLICT`, causing the foundation action service to mark the plan stale. Capability and write scope are also rechecked by both the action service and billing service.

## Risks / Trade-offs

- **[Exact natural names may be duplicated]** → Return scoped candidates and require clarification; never choose by ordering.
- **[A building rename makes a safe plan stale]** → Prefer an explicit re-plan over committing against changed context.
- **[A period is opened by another request after planning]** → The RPC returns the existing period, writes no duplicate audit, and the action completes successfully with `created: false`.
- **[RPC rollout precedes application rollout]** → The migration is additive and existing application code remains valid until switched.
- **[Application rollback leaves the RPC installed]** → The function is server-only and can remain unused; a later migration may remove it after rollback is confirmed.

## Migration Plan

1. Add and test the transactional open-or-get RPC with restricted grants.
2. Apply it to the linked database and regenerate `app/types/database.types.ts`.
3. Switch `BillingPeriodRepository` and `BillingPeriodService.openOrGet` to the RPC.
4. Add scoped resolver, read/planning tool, and the single domain executor.
5. Add tool/service/RPC/concurrency tests and update current-state docs.
6. Run OpenSpec validation, typecheck, full tests, lint, and remote database lint; archive only when all pass.

## Open Questions

None. Fuzzy building search and all later billing mutations remain explicitly deferred.
