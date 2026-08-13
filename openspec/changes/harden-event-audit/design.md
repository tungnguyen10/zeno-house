## Context

Zeno House writes general-domain events to `audit_events` and billing events to `billing_audit_events`. Several high-risk workflows already use audited Postgres RPCs, but ordinary services append after committing and general audit errors are swallowed. Audit rows also retain foreign keys whose cascade behavior erases history, direct-role RLS is broader than application scope, and external Auth/Storage mutations cannot share a Postgres transaction.

## Goals / Non-Goals

**Goals:**

- Preserve immutable audit evidence after source entities are deleted.
- Guarantee atomic audit for database-local business mutations and durable intent for cross-system mutations.
- Make retries idempotent and make incomplete external operations observable/recoverable.
- Correct missing, duplicated, mis-scoped, and mislabeled events without changing mutation response envelopes.

**Non-Goals:**

- Audit AI conversation messages, leases, quotas, telemetry, cache cleanup, or other runtime state.
- Expose audit tables directly to browser clients.
- Apply migrations automatically to Supabase or hand-edit generated database types before cloud type generation.

## Decisions

1. **Immutable scope snapshots replace cascading audit ownership.** `audit_events.building_id` remains the historical UUID but loses its live-building FK. Billing events gain immutable building and period columns, while their live billing-period reference becomes nullable with `ON DELETE SET NULL`. This preserves queryability without retaining deleted domain rows.

2. **Service-role-only data plane.** Browser roles lose table privileges on both audit tables and mutating audit-related RPCs. API services continue to enforce capability and building scope before service-role repositories run.

3. **Explicit audited RPCs for database-local writes.** Each mutation family uses a typed RPC that performs domain writes and semantic audit inserts in one transaction. A shared SQL audit-insert helper removes boilerplate but does not dynamically mutate arbitrary tables.

4. **Durable operation outbox for distributed writes.** `audit_operations` stores an idempotency key, actor, scope, safe intent payload, lifecycle state, and retry timestamps before Auth/Storage/provider work. Completion appends the semantic event and closes the operation transactionally. A private reconciler leases stale operations and either verifies/finalizes them or records a safe unresolved outcome.

5. **One command, one correlated group.** Bulk commands emit one parent plus exactly one child per successful entity. Services must not pre-emit standalone child events. Derived entity changes that matter to entity history, such as room occupancy and renewal successors, are correlated children of the same operation.

6. **Entity-specific snapshot projection.** The generic sanitizer remains a final defense, while callers/RPCs project only fields needed for readable diffs. Credential keys, signed URLs, binary data, and private Storage paths are removed.

7. **Incremental migration with compatibility wrappers.** Existing service method and HTTP response signatures remain stable. Repositories adopt audited RPCs behind those interfaces, allowing focused rollout and tests.

## Risks / Trade-offs

- **Large RPC surface** → migrate one mutation family at a time and retain typed repository boundaries.
- **Distributed operations cannot be globally atomic** → persist immutable intent first, use idempotency keys, and reconcile stale operations so no external change is silent.
- **Historical scope UUIDs no longer have referential integrity** → store building name/code snapshots and restrict writes to service-role helpers.
- **Migration and generated types can drift until cloud apply** → use narrow local function typings, add SQL contract tests, and regenerate `database.types.ts` only after the migration is applied manually.
- **Audit volume increases** → preserve command-level parent/child grouping and exclude runtime/telemetry state.

## Migration Plan

1. Add immutable scope columns, operation IDs, outbox schema, indexes, privileges, and reconciliation helpers without removing existing columns.
2. Backfill billing building/period scope from live periods and general building snapshots from current buildings.
3. Change destructive foreign keys only after backfill; retain existing events unchanged.
4. Deploy service/repository callers and new audited RPCs, then enable the reconciler endpoint/cron.
5. Apply the migration manually in Supabase, run advisors, regenerate database types, and enable production reconciliation after staging failure-injection checks.

Rollback keeps additive columns/tables and disables new RPC callers/reconciler. Historical scope columns are not dropped because doing so could reintroduce data loss.

## Open Questions

None. Business mutations are in scope; AI/runtime state remains operational telemetry as approved.
