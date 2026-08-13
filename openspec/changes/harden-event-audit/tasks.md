## 1. Durable audit schema

- [x] 1.1 Add failing SQL contract tests for retained building/billing history, immutable scope columns, operation idempotency, privilege revocation, and service-role-only mutating RPCs
- [x] 1.2 Add the audit hardening migration with history-preserving constraints, backfills, indexes, operation outbox, and reconciliation functions
- [x] 1.3 Update audit DTOs, mappers, repository queries, and admin deleted-building lookup behavior

## 2. Coverage and semantics

- [x] 2.1 Add failing tests for new canonical actions, tenant activation, missing setting/snapshot audit, bulk scope, and duplicate-free bulk deletes
- [x] 2.2 Implement action constants/display mappings and atomic audited setting/snapshot repository operations
- [x] 2.3 Correct master-data bulk parent/child semantics and preserve each child's building scope and snapshots

## 3. Atomic database mutations

- [ ] 3.1 Add failure-injection SQL/service tests for billing lifecycle, payments, utility overrides, destructive master data, and permission mutations
- [ ] 3.2 Implement explicit audited RPCs and migrate database-local service/repository callers away from fail-open post-commit append
- [ ] 3.3 Add correlated room side-effect and successor-contract audit events to contract create/update/renewal transactions

## 4. Distributed operation durability

- [x] 4.1 Add outbox repository/service tests for intent-before-effect, idempotent completion, leases, safe unresolved outcomes, and secret-free telemetry
- [ ] 4.2 Route Auth, Storage, and provider-backed business mutations through durable audit operations
- [x] 4.3 Add private reconciliation endpoint and Supabase Cron wake-up with safe structured metrics

## 5. Coverage gate and documentation

- [x] 5.1 Add a business mutation registry and CI test requiring every mutating route/system workflow to declare audit ownership and durability strategy
- [x] 5.2 Strengthen entity-specific snapshot projection tests for credentials, signed access, binary data, and private Storage paths
- [x] 5.3 Update entity-audit-log and affected main specs plus architecture, database, API, and feature documentation
- [x] 5.4 Run OpenSpec validation, narrow audit/migration tests, typecheck, full tests, and lint
