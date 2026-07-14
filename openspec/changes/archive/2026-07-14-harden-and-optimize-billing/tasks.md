## 1. Baseline and observability

- [x] 1.1 Add per-request timing, request ID, response-size, slow-request logging, and database round-trip counting with focused tests
- [x] 1.2 Add production-like performance fixtures and baseline query-count/response-equivalence tests for dashboard, billing grid, audit, export, and operations report

## 2. Phase 1 hot paths

- [x] 2.1 Add the scope-safe dashboard aggregate RPC, required indexes, repository mapping, short-lived cache, and large-dataset/isolation tests
- [x] 2.2 Add a billing-period input snapshot RPC and refactor draft calculation and draft-grid to reuse the snapshot
- [x] 2.3 Replace billing export per-invoice charge reads with a constant-query batch load and add query-count tests
- [x] 2.4 Push billing-audit filters, search, cursor, and limit into the repository query and enrich only the returned page
- [x] 2.5 Refactor billing workspace mutation dependencies to remove duplicate overview/draft/grid refreshes and add composable request-count tests
- [ ] 2.6 Run Phase 1 response-equivalence, authorization, typecheck, unit, lint, and benchmark checks

## 3. Phase 2 reports and bulk operations

- [x] 3.1 Add the operations-report snapshot RPC, repository mapping, open/closed cache policy, mutation invalidation, and equivalence/isolation tests
- [x] 3.2 Convert tenant, room, contract, and meter-reading bulk persistence to validated set-based operations while preserving per-item semantics
- [x] 3.3 Convert bulk invoice payments and shared-expense allocation to atomic transactional RPCs with rollback and audit tests
- [x] 3.4 Replace per-item audit persistence with batch insertion where domain semantics allow it
- [ ] 3.5 Run Phase 2 transaction, response-equivalence, authorization, typecheck, unit, lint, and benchmark checks

## 4. Phase 3 API standardization

- [x] 4.1 Inventory all list APIs and add bounded pagination/cursors, DTO projections, and optional-count behavior without breaking current consumers
- [x] 4.2 Add shared Nuxt API-fetch defaults for timeout, request ID, normalized errors, dedupe, debounce, and superseded-request cancellation
- [x] 4.3 Apply scope-safe caching and invalidation to stable catalogs/configuration and immutable closed-period data
- [x] 4.4 Run `EXPLAIN (ANALYZE, BUFFERS)` on hot RPC/query paths and add only evidence-backed composite or partial indexes
- [x] 4.5 Update API and architecture documentation with all checked-in routes and performance/cache/pagination contracts
- [ ] 4.6 Run full OpenSpec validation, typecheck, tests, lint, migration/security checks, and final performance comparison
