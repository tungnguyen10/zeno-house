# AI Agent Architecture

This document is the canonical current-state architecture for the internal Zeno House AI assistant. The assistant is an operations interface over existing services; it is not a replacement backend.

## Current Release Boundary

The current internal release supports authenticated, server-persisted conversations and the monthly billing path from scoped period opening through meter correction, draft explanation, invoice issue preview, and explicit invoice correction plans. Registered tools are:

- `get_user_context`
- `list_buildings`
- `get_meter_status`
- `get_billing_period_overview`
- `calculate_billing_draft`
- `plan_open_billing_period`
- `preview_meter_import`
- `plan_meter_reading_update`
- `plan_utility_usage_override`
- `plan_invoice_issue`
- `plan_record_invoice_payments`
- `plan_void_invoice`
- `plan_reissue_invoice`
- `plan_paid_invoice_adjustment`

Registered mutation executors are `open_billing_period`, `import_meter_readings`, `update_meter_reading`, `save_utility_usage_override`, `issue_invoices`, `record_invoice_payments`, `void_invoice`, `reissue_invoice`, and `add_invoice_adjustment`. They are unreachable from model confirmation text and run only after the owning user confirms a pending action card through the direct endpoint. Production exposure is disabled by default and must be enabled with private server flags.

```text
AppAiDevChat
  -> useAiChat
  -> POST /api/ai/chat
  -> auth + begin_ai_chat_turn RPC
  -> OpenRouter primary/free fallback
  -> capability-filtered read/planning tool registry
  -> existing domain service
  -> repository
  -> Supabase
```

## Runtime Responsibilities

The model may interpret a message, choose from the tools supplied by the server, and explain tool results. The server remains authoritative for authentication, capability policy, building scope, validation, persistence, concurrency, and domain rules.

The registry in `server/services/ai/tools.ts` is deny-by-default. A tool is model-visible only when it is registered and the authenticated role has its required capability. The system prompt forbids database access, web browsing, external side effects, invented identifiers, and mutation commits inside chat.

Building references are resolved by scoped UUID, slug, or exact case-insensitive name. Repository queries receive the user's scope before matching, so an out-of-scope building has the same `not_found` result as an unknown building. Duplicate exact names return scoped candidates and require clarification; the model cannot choose one implicitly.

For meter paste, the tool schema accepts only building/period/date metadata. `streamAiChat` retains the stored current user-message ID in server-only context, and the planner reloads that owned message before a deterministic delimited parser reads the rows. The model cannot pass raw paste or reconstructed reading arrays. Supported imports require a room header and at least one electricity/water header, use tab/comma/semicolon delimiters, and use `.` for decimal values.

Each request is bounded by `NUXT_AI_MAX_STEPS` (default 8), `NUXT_AI_MAX_OUTPUT_TOKENS` (default 1200), `NUXT_AI_MAX_CONTEXT_MESSAGES` (default 20), `NUXT_AI_MAX_CONTEXT_CHARS` (default 12000), and `NUXT_AI_PROVIDER_TIMEOUT_MS` (default 30 seconds). Only the newest complete messages that fit both context limits are sent. Provider selection, model credentials, limits, and operation flags remain private server runtime configuration.

Conversation content and stored business names or labels are untrusted input. They cannot register tools, broaden capability or building scope, confirm an action, or provide authoritative financial values. Strict tool schemas reject extra fields, while planners and executors reload authoritative data through domain services.

## Conversation Persistence And Retention

The server owns `ai_conversations`, `ai_messages`, and `ai_action_plans`. A browser stores only the opaque conversation UUID used to resume its own transcript.

- `begin_ai_chat_turn` resolves or creates the owned conversation, appends the user message, touches expiry, and returns bounded ordered history in one transaction.
- Conversations are resolved by both ID and authenticated user ID.
- Expired or non-active conversations are returned as not found.
- User and assistant messages are persisted and ordered on the server.
- A conversation expiry is extended to 30 days when it is touched.
- Child messages and plans cascade when a conversation is deleted.
- `cleanup_expired_ai_conversations(limit)` deletes expired conversations in bounded, skip-locked batches.
- Supabase Cron runs retention cleanup daily at 00:20 Asia/Ho_Chi_Minh through the internal secret-protected cleanup endpoint. It also removes expired rate-limit buckets and reports count/duration telemetry only.

The AI tables have RLS enabled, but direct `anon` and `authenticated` table access is revoked. Repositories use the existing server service-role client after service-layer ownership checks.

## Structured Streaming

`POST /api/ai/chat` returns `text/event-stream` and emits JSON Server-Sent Events:

```ts
type AiStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-status'; tool: string; status: 'started' | 'succeeded' | 'failed'; durationMs?: number }
  | { type: 'action-plan'; plan: AiActionPlanDto }
  | { type: 'error'; error: { code: string; message: string; details?: unknown } }
  | { type: 'done'; conversationId: string; requestId: string; model: string; requestedModel: string; fallbackUsed: boolean; provider: string }
```

The client buffers incomplete SSE frames before parsing JSON. The model stream is split into independent client and persistence branches, and persistence is registered with `event.waitUntil(...)`; closing the browser response does not cancel server-side assistant-message persistence.

Response headers include `X-Conversation-Id`, `X-Request-Id`, and `X-AI-Requested-Model`. The terminal event, stored assistant metadata, and telemetry use OpenRouter's actually selected response model and record `fallbackUsed`; the header deliberately identifies only the requested primary. AI telemetry does not record message content or raw tool payloads.

## Production Runtime Controls

Production defaults keep chat, tool exposure, planning, execution, and every invoice mutation disabled. Enable only the required private flags:

| Control | Environment variable | Default |
| --- | --- | --- |
| Provider and free models | `NUXT_AI_PROVIDER`, `NUXT_AI_MODEL`, `NUXT_AI_MODEL_FALLBACK` | `openrouter`, Nemotron free, Gemma free |
| Chat route | `NUXT_AI_CHAT_ENABLED` | off in production |
| Read tools | `NUXT_AI_READ_TOOLS_ENABLED` | off in production |
| Mutation planning | `NUXT_AI_MUTATION_PLANNING_ENABLED` | off in production |
| Confirmed execution | `NUXT_AI_MUTATION_EXECUTION_ENABLED` | off in production |
| Invoice issue / payment / void / reissue / adjustment | `NUXT_AI_INVOICE_ISSUE_ENABLED`, `NUXT_AI_INVOICE_PAYMENT_ENABLED`, `NUXT_AI_INVOICE_VOID_ENABLED`, `NUXT_AI_INVOICE_REISSUE_ENABLED`, `NUXT_AI_INVOICE_ADJUSTMENT_ENABLED` | off in production |
| Chat/action budgets | `NUXT_AI_CHAT_RATE_LIMIT`, `NUXT_AI_ACTION_RATE_LIMIT`, `NUXT_AI_RATE_WINDOW_SECONDS` | 20 / 30 per 60 seconds |
| Provider timeout | `NUXT_AI_PROVIDER_TIMEOUT_MS` | 30000 ms |
| Context | `NUXT_AI_MAX_CONTEXT_MESSAGES`, `NUXT_AI_MAX_CONTEXT_CHARS` | 20 / 12000 |
| Shared free quota | `NUXT_AI_GLOBAL_DAILY_LIMIT` | 40 requests per UTC day |
| Distributed circuit | `NUXT_AI_CIRCUIT_FAILURE_THRESHOLD`, `NUXT_AI_CIRCUIT_COOLDOWN_MS` | 5 failures / 60000 ms |
| Action lease | `NUXT_AI_ACTION_LEASE_SECONDS` | 30 seconds |
| Cleanup | `NUXT_AI_RETENTION_CLEANUP_ENABLED`, `NUXT_AI_RETENTION_CLEANUP_BATCH_SIZE`, `NUXT_AI_RETENTION_CLEANUP_SECRET` | on / 500 / no secret configured |

Rate limits are enforced per hashed user ID in service-role-only database buckets. A shared UTC-day quota and provider circuit are acquired atomically in Supabase before a model call. OpenRouter receives only the explicit free fallback plus `require_parameters: true`, `allow_fallbacks: true`, and `data_collection: deny`; it never receives a paid fallback. Capacity exhaustion is reported as `PROVIDER_CAPACITY`. Public `NUXT_PUBLIC_AI_DEV_CHAT_ENABLED` controls only UI visibility and never enables server behavior.

Operational kill order is: disable the affected invoice flag, then mutation execution, then planning or all chat if necessary. A disabled executor rejects before claiming the pending plan, so re-enabling does not require repairing an `executing` action. For cleanup failures, verify the private secret and site URL, invoke the internal endpoint with `x-ai-retention-secret`, and inspect count/duration/error-category telemetry; the next daily run safely retries bounded rows.

## Action Plan Contract

The shared lifecycle dispatches only explicitly registered domain executors.

```text
planner creates server-owned pending plan
  -> UI renders action card
  -> user clicks Confirm or Cancel
  -> direct authenticated endpoint
  -> service rechecks owner, expiry, capability, scope, and versions
  -> database compare-and-set claim
  -> registered domain executor
  -> durable result or normalized failure
```

The browser and model never generate the idempotency key. Each plan receives a server-generated UUID and a canonical payload hash that includes `resource_versions`. Confirmation recomputes that hash before claim; a mismatch makes the plan stale without running an executor. Only the direct endpoint `POST /api/ai/actions/[id]/confirm` can claim a plan; conversational text cannot confirm it.

Lifecycle states are `pending`, `executing`, `succeeded`, `cancelled`, `expired`, `stale`, and `failed`. A claim writes a bounded execution lease. Concurrent confirmation during that lease returns a retryable conflict; after expiry the same plan can be reclaimed with its original idempotency key. If the domain commit succeeds but plan completion is uncertain, the plan remains recoverable in `executing`; deterministic business/validation failures alone become `failed` or `stale`. A succeeded confirmation replays its stored result.

The period executor uses the plan idempotency key as audit correlation metadata and calls `open_or_get_billing_period_with_audit`. The RPC uses the unique building/year/month key, commits a new draft period and `period.opened` audit atomically, and returns the existing period without another audit on retries or races.

Meter commits call `save_meter_readings_with_audit`; utility override saves call `save_utility_usage_override_with_audit`. Both RPCs are service-role-only `SECURITY INVOKER` functions. They validate the normalized payload, lock affected state, reject closed periods and rooms with non-void invoices, compare versions, mutate domain rows, and append audits in one transaction. Direct APIs use the same service/RPC paths as AI actions.

Invoice issue and correction paths use the same service-only transaction contracts for direct API and AI confirmation. Every executor, including reissue, uses the action plan idempotency key. Issue replay atomically writes invoices, charge snapshots, period status, and audit. Void, reissue, and adjustment compare the stored invoice version while holding locks.

AI collection uses a separate `record_ai_invoice_payments_with_audit` `SECURITY INVOKER` RPC granted only to `service_role`. The planner first resolves one building and one explicit or newest non-closed period, then classifies exact room references or all unpaid invoices. Amount and payment date are never model fields: confirmation reloads the canonical snapshot, and the RPC locks the period plus sorted invoices, validates the full batch, and takes each amount from the locked `balance_amount`. Payment rows, paid invoice state, the optional `issued → collecting` transition, child audits, and one `payments.ai_recorded` parent audit commit together. The action idempotency key is the correlation ID; retry after an uncertain commit returns the recorded batch without duplicate payments or audits.

## Meter And Draft Operations

`preview_meter_import` resolves exact room UUID/code/slug/number matches inside one scoped building. It returns line-specific blockers for malformed numbers, unknown/ambiguous rooms, duplicates, missing periods, and billing locks. Warnings cover omitted utility cells, decreasing readings, and unusually large increases. A pending import action is created only when there are normalized rows and no blockers; confirmation commits the exact stored payload without reparsing.

`plan_meter_reading_update` previews one correction and stores the reading's current `updated_at`. PATCH `/api/meter-readings/[id]` also requires `expected_updated_at`. Create, bulk, and update paths share atomic reading/audit persistence.

`calculate_billing_draft` is read-only. It calls the existing `BillingDraftService.calculateDraft` and derives deterministic counts, authoritative totals, charge groups, blocker/warning groups, and a next-step category. The model may explain this result but does not calculate or persist billing amounts.

`plan_utility_usage_override` resolves an exact scoped building/period/room, checks active invoice and period locks, and stores the full override plus expected version/absence. Confirmation and the direct override API share the atomic override/audit RPC. Delete and approval paths apply the same billing locks but are not AI actions in this release.

## Invoice Operations

`plan_invoice_issue` takes period and optional contract identifiers only. The server calculates fresh drafts, separates issuable, blocked, and already-issued targets, builds a canonical snapshot of authoritative lines/totals/state, and hashes it. Confirmation recalculates the same snapshot and writes nothing if the hash is stale. A successful retry replays the original issued-invoice result instead of creating duplicates.

`plan_record_invoice_payments` accepts one exact room, an exact room list, or all unpaid invoices in one building and period. Missing building is auto-selected only for a one-building scope; otherwise the assistant requests clarification before room lookup. An omitted period selects the newest non-closed period and never falls back to an older invoice. Planning reports eligible, already-paid, missing, invalid, and blocked targets, and creates a card only for the eligible subset. Confirmation is all-or-nothing for that subset and always records the complete current balance with the user-message date and default `cash` method.

`plan_void_invoice` supports only unpaid invoices in an open period. `plan_reissue_invoice` binds a fresh draft to a voided invoice and rejects an existing active replacement. `plan_paid_invoice_adjustment` creates an explicit charge adjustment with before/after total, balance, and status; it never silently changes or reverses payments. All correction plans require `billing.corrections`, exact scoped invoice resolution, an expected invoice `updated_at`, a reason, and direct confirmation.

## Endpoints

| Method | Route | Current behavior |
| --- | --- | --- |
| `POST` | `/api/ai/chat` | Resolve/create an owned conversation and stream read or planning tool events. |
| `GET` | `/api/ai/conversations/[id]` | Resume an owned, active transcript and its action cards. |
| `POST` | `/api/ai/actions/[id]/confirm` | Confirm an owned pending plan and dispatch its currently enabled registered executor. |
| `POST` | `/api/ai/actions/[id]/cancel` | Cancel an owned pending plan. |
| `POST` | `/api/internal/ai/retention-cleanup` | Secret-protected bounded conversation and rate-bucket cleanup for Supabase Cron. |

## Source Map

- UI: `app/components/app/AppAiDevChat.vue`, `app/components/app/AppAiActionCard.vue`
- Client state and SSE: `app/composables/useAiChat.ts`
- DTOs, mappers, validation: `app/types/ai.ts`, `app/utils/mappers/ai.ts`, `app/utils/validators/ai.ts`
- API handlers: `server/api/ai/**`
- Runtime and policy: `server/services/ai/**`, `server/utils/ai-*.ts`
- Persistence: `server/repositories/ai/**`
- Migrations: the four `20260714...ai_*.sql` migrations plus `supabase/migrations/20260802080015_harden_ai_billing_assistant_flow.sql`
- Database verification: `supabase/verification/ai_billing_assistant_flow.sql`

## Verification

Focused coverage lives under `tests/server/ai/**`, `tests/server/meter-readings/**`, `tests/server/billing/**`, `tests/composables/ai-chat.test.ts`, and `tests/components/app/AppAiActionCard.test.ts`. It covers schema security, prompt-injection boundaries, lifecycle compare-and-set behavior, canonical invoice snapshots, parser fidelity, scoped preview classification, exact preview/commit payloads, transactional RPC contracts, stale writes, billing locks, deny-by-default tools, kill switches, rate limits, timeouts/circuit behavior, cleanup retries, fragmented SSE, direct confirmation controls, and disconnect-safe persistence structure.

Run `npm run verify:ai-models` before deployment and follow `docs/development/ai-billing-assistant-rollout.md`. Production AI behavior remains disabled by default; applying the additive migration and completing staging smoke checks are explicit rollout steps.
