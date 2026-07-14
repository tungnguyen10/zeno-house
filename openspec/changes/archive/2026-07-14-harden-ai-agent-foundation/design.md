## Context

The current AI surface streams plain text from `POST /api/ai/chat` and defines four tools inline. Read tools already call permission- and scope-aware domain services, but `open_billing_period` accepts `confirmed` and `idempotency_key` as model-generated arguments, does not persist or consume the key, and bypasses a server-owned preview/confirmation lifecycle. Conversation history exists only in browser memory, the debug UI cannot observe actual tool calls, and there is no accepted AI capability spec or focused regression suite.

The repository uses Nuxt server handlers, service/repository layering, a service-role Supabase client behind server authorization, and AI SDK 7. The foundation must preserve those boundaries and must not enable new billing mutations before later domain changes are accepted.

## Goals / Non-Goals

**Goals:**

- Make conversation and action lifecycle state authoritative on the server and retain it for 30 days.
- Ensure the model can read data and propose actions but cannot confirm or commit mutations.
- Provide a typed event stream that can drive text, tool diagnostics, and action cards.
- Establish reusable policy, idempotency, expiry, compare-and-set, and optimistic-locking contracts for later billing tools.
- Keep the existing read tools available while removing the unsafe direct period-opening tool until the billing-period wave replaces it with a plan/confirm flow.

**Non-Goals:**

- Adding building-name resolution, meter import, billing draft mutation, invoice issue, or correction tools.
- Changing billing calculations, role capabilities, or building-scope rules.
- Allowing the browser or model direct access to Supabase tables.
- Guaranteeing atomic domain mutation plus action completion before domain-specific transactional executors exist.

## Decisions

1. **Persist three server-owned resources.** `ai_conversations` owns a user-scoped thread, `ai_messages` stores normalized user/assistant content and structured metadata, and `ai_action_plans` stores immutable action intent plus mutable lifecycle/result fields. All tables have RLS enabled and direct `anon`/`authenticated` access revoked; repositories use the existing service-role database helper after service-layer ownership checks.

2. **Use a 30-day retention boundary.** Conversations carry `expires_at`; child messages and action plans cascade on conversation deletion. A database cleanup function deletes expired conversations in bounded batches and can later be scheduled by the production-hardening wave. Reads treat expired conversations and plans as unavailable even before cleanup runs.

3. **Make action plans the only mutation bridge.** A plan contains actor, optional building, action type, normalized payload, payload hash, preview, resource versions, server-generated UUID idempotency key, status, and expiry. The model may cause a registered planner to create a pending plan, but only `POST /api/ai/actions/:id/confirm` may claim it. `POST /api/ai/actions/:id/cancel` cancels a pending plan. Model tool schemas never contain `confirmed` or client-generated idempotency fields.

4. **Use compare-and-set lifecycle transitions.** Confirmation atomically changes an owned, pending, unexpired plan to `executing`; only the winner executes. Completion stores a durable result and `succeeded`; failure stores a normalized error and `failed`. Reconfirming a succeeded plan returns the stored result. Future domain executors must be idempotent by the plan key so a crash between domain commit and plan completion can be replayed safely.

5. **Separate registry metadata from execution.** Tools are registered with name, mode (`read` or `plan`), required capability, schema, and execute function. Registry construction filters by capability and rejects unregistered names by construction. There is no generic model-callable `commit` tool. Foundation retains `get_user_context`, `get_meter_status`, and `get_billing_period_overview`; direct `open_billing_period` is removed.

6. **Stream typed Server-Sent Events.** The endpoint transforms AI SDK 7 `fullStream` parts into newline-delimited SSE events: `text-delta`, `tool-status`, `action-plan`, `error`, and `done`. The client incrementally parses complete SSE frames, accumulates assistant text, records tool summaries, and renders action plans. The server consumes the stream to completion and persists the final assistant message even if the client disconnects.

7. **Use domain-neutral action cards.** The foundation DTO contains title, summary, preview, warnings, status, and expiry. Domain waves may add structured preview fields without changing the confirm/cancel lifecycle. The widget calls confirm/cancel endpoints directly and never translates a click into another model message.

8. **Treat optimistic versions as required plan inputs for updates.** `resource_versions` is part of the payload hash and future update planners must include `updated_at` or an explicit version. Confirm executors return `OPTIMISTIC_LOCK_CONFLICT` and mark the plan stale when authoritative versions differ.

9. **Deliver the roadmap sequentially.** After this change is verified and archived, create `add-ai-billing-period-operations`, then `add-ai-meter-and-draft-operations`, then `add-ai-invoice-operations`. Later artifacts are based on the accepted implementation rather than speculative foundation details.

## Risks / Trade-offs

- **[Public-schema AI tables could be reached through the Data API]** → Enable RLS, revoke all direct `anon`/`authenticated` privileges, and access them only through authenticated Nuxt services using the service-role client.
- **[A disconnected client could lose the final message]** → Continue consuming the model stream server-side and persist completion independently from the response connection.
- **[Custom SSE parsing can split JSON frames across chunks]** → Buffer until a complete blank-line-delimited frame and cover fragmentation in composable tests.
- **[Action execution can crash after a domain commit]** → Require every future executor to use the server plan idempotency key and return the durable prior result on replay.
- **[Thirty-day message retention stores operational data]** → Keep access server-only, minimize stored metadata, cascade-delete children, and expose bounded cleanup.

## Migration Plan

1. Add AI persistence tables, indexes, RLS, revoked grants, and bounded cleanup function as an additive migration.
2. Add repository/service/types and lifecycle tests without changing the chat UI.
3. Switch chat to server-owned conversations and typed SSE; keep only read tools.
4. Add action-card rendering and confirm/cancel handlers. No production mutation executor is registered in this wave.
5. Update architecture/current-state documentation and verify OpenSpec, typecheck, tests, and lint.
6. Roll back application code to the prior plain-text chat if needed; additive tables can remain unused until a later cleanup migration.

## Open Questions

None. Domain-specific preview schemas and transaction RPCs are intentionally deferred to their sequential changes.
