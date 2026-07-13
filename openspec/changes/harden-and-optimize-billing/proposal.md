## Why

The application exposes 131 server routes, but its heaviest dashboard, billing, audit, export, report, and bulk workflows still perform redundant reads, in-memory pagination, N+1 queries, or broad client refreshes. We need measurable request performance and bounded database work so the system remains responsive as buildings, invoices, audit events, and operational data grow.

## What Changes

- Add API timing, query-count, payload-size, request-id, and slow-request diagnostics without changing existing success or error envelopes.
- Replace the dashboard's hard-limited row loading with a scope-safe aggregate RPC and short-lived scope-keyed cache.
- Load billing-grid inputs as a database snapshot, reuse those inputs during draft calculation, and remove redundant client refreshes.
- Batch invoice-charge loading for exports and push billing-audit filtering and cursor pagination into the database.
- Add an operations-report snapshot and cache policy with explicit invalidation for mutable periods.
- Replace sequential bulk database loops with validated batch or transactional RPC operations.
- Standardize list pagination/projections, client fetch defaults, cancellation/deduplication, and cache policies across the remaining APIs.
- Document all checked-in routes and their pagination, cache, and performance contracts.

## Capabilities

### New Capabilities

- `api-performance`: Request observability, performance budgets, cache isolation, query-count expectations, and large-dataset behavior for server APIs.

### Modified Capabilities

- `dashboard-api`: Dashboard summaries are complete beyond former hard limits and are computed through scope-safe aggregation.
- `billing-api`: Billing grid and audit reads avoid duplicate data loading and use database-backed filtering and pagination.
- `billing-client`: Billing mutations refresh only affected workspace sections while preserving current UI behavior.
- `billing-export`: Billing exports batch related data and avoid per-invoice database queries.
- `billing-bulk-operations`: Financial bulk mutations remain atomic while non-financial bulk workflows use bounded batch operations.
- `operations-report`: Report reads use a consistent snapshot and explicit cache invalidation rules.
- `server-utils`: API requests receive consistent request IDs, timing headers, timeout/error conventions, and diagnostics.

## Impact

This affects Nitro middleware and server utilities, dashboard/billing/operations-report services and repositories, domain composables, Supabase migrations and RPCs, API tests, performance fixtures, and the checked-in API reference. Public route URLs and `{ data, meta? }` / `{ error }` envelopes remain backward compatible. Database functions are server-internal and are never called from browser code.
