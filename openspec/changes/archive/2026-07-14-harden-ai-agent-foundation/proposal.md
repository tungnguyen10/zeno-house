## Why

Zeno House already has an internal AI chat MVP, but its model-generated confirmation flag and idempotency key are not authoritative safety boundaries, conversations are client-owned, and tool activity is not represented as structured UI state. Before adding more billing mutations, the agent needs a server-owned execution foundation that keeps the model outside the commit path and makes authorization, replay, staleness, auditability, and retention enforceable.

## What Changes

- Persist authenticated AI conversations and messages for 30 days so multi-step workflows can resume from server-owned state.
- Add server-owned action plans with normalized payloads, previews, resource-version snapshots, expiration, one-time confirmation, and server-generated idempotency keys.
- Replace model-supplied mutation confirmation with action-card confirmation and cancellation endpoints called directly by the client.
- Extract a deny-by-default tool registry and policy layer with explicit capability metadata and bounded tool loops.
- Stream typed text, tool-status, action-plan, error, and completion events to the chat client.
- Establish an optimistic-locking contract for future agent mutations and base telemetry/test coverage for agent policy and lifecycle behavior.
- Document the implemented AI runtime as the foundation for three later sequential waves: `add-ai-billing-period-operations`, `add-ai-meter-and-draft-operations`, and `add-ai-invoice-operations`.

## Capabilities

### New Capabilities

- `ai-agent-foundation`: Authenticated conversation persistence, structured streaming, deny-by-default tool policy, server-owned action plans, confirmation/idempotency lifecycle, retention, and foundation verification requirements.

### Modified Capabilities

None.

## Impact

This affects the AI chat endpoint and service, client composable and chat widget, shared AI validators/types, new AI persistence repositories/services, Supabase schema/RLS, agent tests, and current architecture/project-status documentation. Existing billing domain services remain authoritative and no new billing mutation is enabled by this foundation change.
