## Why

Opening a billing period is only the first step of the monthly workflow. Operators still have to leave the assistant to import meter readings, diagnose invalid rows, correct values, and understand billing drafts, while the current direct APIs do not consistently guarantee transactional audit writes, invoice locks, or optimistic concurrency.

## What Changes

- Add deterministic parsing of meter data from the authoritative stored user message, with scoped room resolution and explicit warning/blocker classification.
- Add AI meter-import preview and confirmable action plans whose normalized payload is reused unchanged at commit time.
- Make bulk meter commits and their billing audits atomic, and enforce closed-period and active-invoice locks for both AI and direct API writes.
- Add optimistic concurrency to conversational and direct meter-reading corrections.
- Add read-only AI billing-draft calculation with deterministic totals, blockers, warnings, and explanations.
- Add confirmable utility-usage override plans with atomic persistence, audit, locking, and concurrency checks.
- Update current-state architecture, meter-reading, billing, API inventory, and rollout documentation only after each behavior exists.

## Capabilities

### New Capabilities

- `ai-meter-and-draft-operations`: Deterministic stored-message import, scoped preview/planning, confirmed meter and override operations, and read-only draft explanation through the AI assistant.

### Modified Capabilities

- `meter-readings-api`: Require atomic bulk reading and audit persistence, period/invoice write locks, and optimistic update conflicts for direct and AI-backed operations.
- `billing-api`: Require locked, atomic utility-usage override persistence and define the server-authoritative draft explanation exposed to AI.

## Impact

- AI tool context, registry, planners, action executors, action cards, and structured tool results under `server/services/ai/**` and `app/types/ai.ts`.
- Meter-reading validators, services, repositories, API handlers, and tests.
- Billing draft and utility-usage services, repositories, validators, and tests.
- Supabase RPCs for all-or-nothing meter and override writes with audit events.
- Current implementation docs under `docs/architecture/**`, `docs/features/**`, `docs/api-inventory.md`, and `docs/project-status.md`.
