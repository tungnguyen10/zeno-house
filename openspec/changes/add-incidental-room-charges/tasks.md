## 1. Database and Domain Contracts

- [x] 1.1 Add failing validator/type/mapper tests for positive incidental-charge inputs and DTO mapping.
- [x] 1.2 Add the additive Supabase migration for source rows, `incidental` invoice charge support, indexes, RLS/grants, atomic idempotent/versioned CRUD RPCs, and audit events.
- [x] 1.3 Add SQL contract tests for constraints, locks, idempotency, optimistic concurrency, audit atomicity, and security posture.
- [x] 1.4 Add billing constants, DTOs, validators, mappers, and local repository row contracts without editing generated database types.

## 2. Server CRUD Flow

- [x] 2.1 Add failing repository/service/API tests for list/create/update/delete, scope, permission, contract ownership, closed-period lock, effective-invoice lock, and void-invoice allowance.
- [x] 2.2 Implement incidental-charge repository mappings and database error normalization.
- [x] 2.3 Implement the billing incidental-charge service with `billing.read`/`billing.write`, building scope, ownership validation, and RPC orchestration.
- [x] 2.4 Implement GET/POST/PATCH/DELETE period endpoints with shared Zod validation and API envelopes.

## 3. Billing Calculation and Issuance

- [x] 3.1 Add failing draft tests proving period/contract isolation, multiple full-value lines, subtotal behavior, and independent recurring surcharge aggregation.
- [x] 3.2 Load period incidental charges in authoritative draft/grid/bootstrap paths and emit `incidental` lines with source metadata.
- [x] 3.3 Add preview/snapshot/issue/reissue/issue-and-pay regressions proving source changes stale preview hashes and issued charges preserve source identity.
- [x] 3.4 Add print, export, operations-report, and charge-grouping tests and mappings for individually labelled incidental lines and existing other/service totals.

## 4. Workspace UI

- [x] 4.1 Read the targeted frontend/design-system guidance and add failing modal/drawer/desktop/mobile component tests for editable, empty, locked, loading, validation, error, and success states.
- [x] 4.2 Add workspace composable CRUD methods and authoritative grid/overview refresh behavior.
- [x] 4.3 Implement the incidental-charge modal and per-room drawer section using existing UI primitives and Vietnamese copy with diacritics.
- [x] 4.4 Wire **Thêm phát sinh** into eligible desktop row actions and mobile cards without adding a grid column or horizontal overflow.
- [x] 4.5 Run focused desktop/mobile visual inspection and Hallmark anti-slop/state critique; fix material accessibility, responsiveness, density, and copy findings.
  - Environment note: no browser backend was available; verification used mounted desktop/mobile component rendering plus static state/responsiveness critique, including 44px mobile action targets.

## 5. Documentation and Verification

- [x] 5.1 Update current OpenSpec specs, billing feature/database/API docs, and API inventory with final behavior and rollout notes.
- [x] 5.2 Run focused tests, `openspec validate --specs`, `npm run typecheck`, `npm test`, and `npm run lint`; resolve regressions.
- [x] 5.3 Verify migration SQL statically, run available Supabase migration/advisor checks without starting a local runtime, and document any cloud-only type-generation or staging verification step.
