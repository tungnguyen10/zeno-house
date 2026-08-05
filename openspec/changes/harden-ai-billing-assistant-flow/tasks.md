## 1. Provider Routing And Runtime Contract

- [x] 1.1 Add failing tests for model-cost config validation, OpenRouter fallback request options, selected-model SSE metadata, and bounded context selection.
- [x] 1.2 Implement primary/fallback runtime configuration, privacy routing, actual-model reporting, context budgets, and capacity error mapping.
- [x] 1.3 Add a cost-aware OpenRouter catalog verification script and deployment documentation.
- [x] 1.4 Add private paid-primary opt-in while preserving the explicit zero-cost fallback contract.

## 2. Atomic Chat And Distributed Controls

- [x] 2.1 Add failing SQL/repository/service tests for atomic chat-turn startup, global daily quota, and distributed provider circuit behavior.
- [ ] 2.2 Create the additive Supabase migration, repositories, generated types, and service integration for chat turns, quota, and circuit state.
- [x] 2.3 Register assistant persistence with `event.waitUntil` and test success, provider failure, and client disconnect behavior.

## 3. Recoverable Action Execution

- [x] 3.1 Add failing action lifecycle tests for payload tampering, active lease conflicts, expired lease recovery, ambiguous failures, and completion failure after commit.
- [x] 3.2 Implement payload-hash verification, leased claims, recoverable failure classification, retry metadata, and plan-idempotency use in every executor.
- [x] 3.3 Add SQL verification for claim concurrency, grants/RLS, idempotent domain replay, and non-duplicated audit behavior.

## 4. Contracts, Documentation, And Verification

- [x] 4.1 Update SSE/client types, AI architecture, feature and rollout documentation, environment examples, and accepted specification.
- [x] 4.2 Verify role/capability/building-scope matrices and all AI runtime flags with focused tests.
- [ ] 4.3 Run OpenSpec validation, AI and database suites, full tests, typecheck, lint, catalog verification, and document staging smoke commands/results.
