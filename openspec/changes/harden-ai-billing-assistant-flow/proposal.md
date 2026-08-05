## Why

The production AI assistant currently ignores its configured fallback model, performs avoidable conversation database round trips, relies on process-local provider circuit state, and can leave an action result ambiguous when a domain mutation commits before the action plan is completed. The rollout also needs an enforceable model-cost policy and stronger deployment verification before private production flags are enabled.

## What Changes

- Route OpenRouter requests through one configured primary model and one explicitly free fallback model, require a private opt-in before a paid primary is allowed, record the model actually selected, and fail closed instead of using an unapproved paid model.
- Atomically begin a chat turn and return bounded owned history in one database RPC.
- Persist assistant results through the H3 request lifecycle and apply a bounded context budget.
- Add a distributed provider circuit and global daily chat quota while retaining per-user rate limits.
- Verify action payload integrity and make executing plans recoverable through a lease plus domain idempotency.
- Add release-gate, database, authorization, stream, fallback, and recovery verification and update rollout documentation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-agent-foundation`: Require cost-controlled provider routing with paid-primary opt-in and free-fallback observability, atomic bounded chat turns, distributed provider controls, lifecycle-safe persistence, payload verification, and recoverable idempotent action execution.

## Impact

The change affects Nuxt private runtime configuration, the AI chat/action services and repositories, typed SSE events, Supabase AI tables/RPCs, generated database types, tests, release verification scripts, and AI operations documentation. It does not change application roles, capability assignments, building scope rules, or the explicit action-card confirmation boundary.
