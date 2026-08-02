## Context

AI chat currently performs separate conversation create/find, append, touch, and history reads; the fallback runtime setting is unused; assistant persistence runs as an unregistered background promise; and provider circuit state is local to one server process. Action executors are domain-idempotent, but the plan lifecycle rejects an `executing` plan and marks any post-claim error failed, so a commit followed by a plan-completion failure is not recoverable.

The production rollout must remain server-authoritative, service-role database access must remain behind service capability/scope checks, and financial mutations must still require an explicit action-card confirmation.

## Goals / Non-Goals

**Goals:**

- Enforce a zero-cost OpenRouter primary/fallback pair with observable selected-model routing.
- Reduce chat startup database round trips while preserving ownership and retention rules.
- Make stream persistence, rate/circuit controls, and confirmed action execution reliable across serverless instances and transient failures.
- Verify privacy, authorization, database privileges, free pricing, and rollout behavior before production enablement.

**Non-Goals:**

- Removing action-card confirmation or moving authorization into the model.
- Changing roles, capabilities, billing calculations, or domain mutation semantics.
- Providing a production SLA for third-party free model capacity.

## Decisions

1. **Use OpenRouter-native fallback in one request.** The primary is `nvidia/nemotron-3-super-120b-a12b:free` and fallback is `google/gemma-4-31b-it:free`. The OpenAI-compatible provider receives `models`, `require_parameters`, `allow_fallbacks`, and `data_collection: deny`. Application code never retries a response after streaming begins. This is safer than issuing a second SDK request, which could repeat tool calls.

2. **Fail closed on model cost and capability.** Production runtime validation requires distinct `:free` IDs. A release script queries the OpenRouter catalog and rejects missing models, non-zero prompt/completion pricing, or missing tool support. Catalog failure blocks rollout rather than selecting a paid router.

3. **Begin chat turns atomically.** A service-role-only `begin_ai_chat_turn` security-invoker RPC verifies conversation ownership/expiry, creates when needed, appends the user message, extends retention, and returns bounded ordered history. Service code applies the final token/character context budget before provider transmission.

4. **Tie persistence to the H3 lifecycle.** The persistence branch remains independent of the client stream, but its promise is registered with `event.waitUntil`. Selected-model metadata comes from the completed provider response and is used in persistence, telemetry, and the terminal SSE event.

5. **Store shared provider controls in Postgres.** A service-role-only circuit table/RPC pair atomically checks cooldown and records success/failure across serverless instances. A global UTC-day bucket caps chat requests at 40 by default, while the existing hashed per-user window remains in force.

6. **Recover action execution with a lease.** Claim accepts pending plans and expired execution leases. A confirmation recomputes the canonical payload hash before claim. Known validation/version errors become failed/stale; ambiguous executor or completion failures leave the plan executing. Retrying after the lease uses the same idempotency key and completes from the domain's replayed result. All executors, including reissue, use the plan key.

7. **Keep authorization at the service boundary.** No role matrix changes are made. Repositories and RPCs persist/query only; services continue to enforce owner, capability, runtime flag, and building scope before service-role calls.

## Risks / Trade-offs

- **Free endpoints can be rate-limited or removed** → catalog gate, global quota, fallback, kill switches, and a capacity-specific user error; never relax into paid routing.
- **Privacy filtering can remove all eligible endpoints** → staging smoke test uses the exact data policy and blocks rollout if no endpoint remains.
- **Leased execution can temporarily show an in-progress card** → return retry timing and allow reconfirmation only after lease expiry; idempotency prevents duplicate domain/audit writes.
- **A larger RPC increases SQL complexity** → keep it persistence-only, cover ownership/order/privileges with SQL contract and cloud verification.

## Migration Plan

1. Add additive tables/functions/columns and explicit grants; regenerate database types.
2. Deploy code with all private production flags still disabled.
3. Run catalog, database, role, primary, forced-fallback, persistence, and action-recovery smoke checks in staging.
4. Enable UI/chat, then read tools, planning, and individual mutation execution flags in order.
5. Roll back operationally by disabling chat/mutation flags; the additive schema remains backward compatible.

## Open Questions

None.
