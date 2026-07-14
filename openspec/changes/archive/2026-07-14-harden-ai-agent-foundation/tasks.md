## 1. Persistence foundation

- [x] 1.1 Add an additive Supabase migration for AI conversations, messages, action plans, indexes, RLS/revoked grants, compare-and-set lifecycle functions, and bounded 30-day cleanup
- [x] 1.2 Regenerate database types and add AI DTOs, validators, mappers, repositories, and ownership/expiry-aware conversation services

## 2. Policy and action lifecycle

- [x] 2.1 Implement action-plan creation, ownership checks, confirmation, cancellation, replay, expiry, stale/conflict, and normalized lifecycle errors
- [x] 2.2 Extract a capability-filtered deny-by-default tool registry, retain read tools, remove the direct period-opening tool, and add structured tool telemetry

## 3. Streaming and client experience

- [x] 3.1 Refactor the chat endpoint/service to use authoritative stored history, persist messages, bound tool loops, and emit typed SSE events while completing persistence after disconnect
- [x] 3.2 Update the chat composable to parse fragmented SSE frames, accumulate text/tool summaries/action plans, and resume server-owned conversations
- [x] 3.3 Add confirm/cancel API handlers and render reusable action cards whose buttons call those handlers directly

## 4. Verification coverage

- [x] 4.1 Add migration/security tests for schema, RLS, grants, lifecycle functions, uniqueness, and retention cleanup
- [x] 4.2 Add service and API tests for ownership, expiry, confirmation, cancellation, replay, concurrent claims, capability filtering, unknown/direct mutation denial, loop bounds, and telemetry metadata
- [x] 4.3 Add composable/component tests for fragmented streams, tool summaries, action cards, direct confirmation/cancellation, and disconnect-safe persistence contracts

## 5. Documentation

- [x] 5.1 Create the canonical AI architecture guide and update API/rules/context routing to match the implemented runtime
- [x] 5.2 Update project status and rollout state, regenerate API inventory when routes change, and check all current-state docs against source before archive

## 6. Final gates

- [x] 6.1 Run OpenSpec change/spec validation, focused AI/security tests, typecheck, the full test suite, lint, and migration/security checks; resolve every failure before verification and archive
