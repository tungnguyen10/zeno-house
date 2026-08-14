## 1. Domain Contract And Database

- [x] 1.1 Add amendment DTOs, strict validators, mapper, status/diff constants, and validator/mapper tests.
- [x] 1.2 Add the contract-amendment table, constraints, RLS/privilege hardening, audit entity/actions, atomic lifecycle/application RPCs, scheduler migration, and SQL contract tests.
- [ ] 1.3 Regenerate Supabase database types after cloud migration application; keep local type adapters isolated until generation is available.

## 2. Server Lifecycle And APIs

- [x] 2.1 Add the amendment repository and service with permission, building-scope, concurrency, lifecycle, invoice-conflict, and idempotency tests.
- [x] 2.2 Add internal list/create/update/delete/publish/cancel handlers and private apply-due worker with API authentication/envelope tests.
- [x] 2.3 Integrate scheduled-amendment cancellation and deletion blockers into contract termination/renewal/delete with regression tests.
- [x] 2.4 Apply due amendments before billing draft term reads and verify issued invoice snapshots remain unchanged.

## 3. Tenant Disclosure

- [x] 3.1 Resolve effective payment due day/source, remove internal notes, and return primary-only published amendment summaries through portal bootstrap with repository/service tests.
- [x] 3.2 Update the portal room surface to show effective terms and primary-only amendments with mounted primary/roommate/empty/inheritance tests.

## 4. Internal User Experience

- [x] 4.1 Add amendment composable, management list, draft form, publish/cancel confirmations, term diffs, and contract-detail integration with permission/state/responsive tests.

## 5. Documentation And Verification

- [x] 5.1 Update contracts, tenant portal, API, database, scheduler, and rollout documentation including cloud migration/type-generation steps.
- [x] 5.2 Run focused suites, full tests, typecheck, lint, OpenSpec validation, SQL verification, and final UI polish review; record any environment-only rollout steps as not locally executed.
