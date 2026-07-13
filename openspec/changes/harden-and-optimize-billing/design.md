## Context

The current handlers are thin, but several service/repository paths load thousands of rows, repeat the same billing inputs, perform per-record queries, or paginate after in-memory enrichment. Client mutations can fan out into four or five refresh requests. There is no common request timing or database-query counter, so regressions are difficult to locate. The implementation must preserve authenticated building scope, API envelopes, and current business calculations.

## Goals / Non-Goals

**Goals:**

- Make request and database cost observable and enforce budgets with tests.
- Bound query counts independently of dataset size for summary, export, report, audit, and bulk paths.
- Preserve current routes, DTOs, authorization, audit behavior, and financial atomicity.
- Introduce scope-safe caching with explicit invalidation.

**Non-Goals:**

- Replacing Nuxt/Nitro, Supabase, or the service/repository layering.
- Moving authorization decisions into browser code or public RPC calls.
- Making asynchronous exports or changing business formulas in this change.

## Decisions

1. **Instrument at Nitro and database-wrapper boundaries.** A server middleware records request duration, response size, route, request ID, and per-request query count. The shared database helper increments event-context counters. This covers all handlers without modifying every route. Production logs sample successful fast requests but always emit slow/error requests.

2. **Use server-internal, security-invoker RPC snapshots.** Dashboard, billing-grid input, and operations-report data are aggregated in SQL functions invoked only by repositories after service-layer authorization and scope checks. Functions avoid `SECURITY DEFINER`; execute grants are revoked from `anon` and `authenticated` unless an existing server database role requires an explicit grant.

3. **Cache only after authorization and include scope/version in keys.** Dashboard cache keys contain sorted building IDs and the current period. Open operational reports use a short TTL plus domain invalidation; closed reports use their closure/update version. Payment, permission, and editable meter data are not independently long-cached.

4. **Reuse snapshots instead of stacking endpoints.** Billing draft calculation accepts preloaded inputs. Draft-grid owns overview-compatible aggregates. Client mutation dependency rules reload the grid once and reload invoices, utility usages, or audit only when that mutation changes them.

5. **Batch related reads and writes.** Export loads all charges in one query. Audit applies filters/cursor/limit before enrichment. Non-financial bulk workflows validate then use set-based statements; financial mutations use one transactional RPC and fail atomically.

6. **Keep public contracts backward compatible.** Existing URLs and envelopes remain. Diagnostic headers and optional metadata are additive. List DTO projections retain every field currently promised by their accepted specs.

## Risks / Trade-offs

- **[Cached scoped data could leak or become stale]** → Build keys only after authoritative scope resolution, never key by role alone, keep short TTLs for mutable data, and test cross-user isolation and invalidation.
- **[SQL aggregation can diverge from TypeScript calculations]** → Run legacy/new implementations against identical fixtures before switching, keep a temporary comparison mode, and roll back repository selection without dropping functions.
- **[Query counting cannot observe database-internal statements]** → Treat it as application round-trip counting and use `EXPLAIN (ANALYZE, BUFFERS)` for RPC internals.
- **[Large RPC JSON payloads can move work rather than reduce it]** → Project only required columns and benchmark serialized size and database execution time.
- **[Bulk semantics can change accidentally]** → Preserve existing partial-success behavior for non-financial actions and require atomic rollback for financial actions.

## Migration Plan

1. Add instrumentation and baseline tests without changing query implementations.
2. Add indexed SQL/RPC functions with revoked public execution and repository comparison tests.
3. Switch one read path at a time: dashboard, billing grid/export/audit, then operations report.
4. Add bulk RPCs one workflow at a time and preserve existing endpoints as callers.
5. Apply client refresh changes after server response-equivalence tests pass.
6. Roll back by restoring repository selection and client dependency rules; leave additive functions/indexes until a later cleanup migration.

## Open Questions

None. Performance budgets are evaluated on production-like fixtures and are release gates, not claims about unmeasured production infrastructure.
