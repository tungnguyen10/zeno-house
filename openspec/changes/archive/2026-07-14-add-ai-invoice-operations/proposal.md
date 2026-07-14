## Why

The assistant can prepare billing inputs and explain drafts, but operators must still leave the conversation to issue or correct invoices. Invoice mutations are the highest-risk billing step, so they need stale-preview protection, atomic reuse of existing billing transactions, and production controls before the AI workflow can be rolled out safely.

## What Changes

- Add a scoped invoice-issue preview and a confirmable issue plan bound to a server-computed draft snapshot/version.
- Execute confirmed issue plans through the existing atomic invoice issue RPC with server-owned idempotency and stale-plan rejection.
- Add planned void/reissue and paid-invoice correction workflows with explicit reasons, payment-state rules, and correlation IDs for composite operations.
- Make void/reissue and paid-invoice adjustment writes atomic with their audit events before exposing them to AI.
- Add independent read/mutation feature flags and kill switches, per-user request/action rate limits, provider timeouts, and a bounded circuit breaker.
- Add prompt-injection and tool-policy regression coverage, schedule 30-day conversation cleanup, and document feature-flagged rollout and troubleshooting.

## Capabilities

### New Capabilities

- `ai-invoice-operations`: Scoped invoice issue preview/confirmation, correction planning, stale snapshot protection, and safe confirmed invoice execution through the AI assistant.

### Modified Capabilities

- `billing-api`: Require atomic audited invoice void/reissue and paid-invoice correction contracts that AI and direct APIs can safely share.
- `ai-agent-foundation`: Add production runtime controls, prompt-injection regression guarantees, scheduled retention cleanup, and feature-flagged rollout behavior.

## Impact

- AI validators, tool registry, planners, action executors, action cards, telemetry, and chat runtime under `app/**` and `server/services/ai/**`.
- Existing invoice services/repositories and Supabase billing RPCs for atomic issue, void/reissue, adjustment, and audit persistence.
- Runtime configuration, Nitro scheduled tasks, rate limiting/circuit-breaker utilities, and AI security tests.
- Current architecture, billing, permissions, API inventory, environment/operations, and project-status documentation.
