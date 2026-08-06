## 1. Due policy and schema

- [x] 1.1 Add failing unit tests for precedence, timezone, next-occurrence, short-month, leap-year, fallback, grace, and past-override behavior; implement the server due-schedule resolver.
- [x] 1.2 Add the Supabase migration that renames the contract field, adds immutable invoice grace/overdue fields and indexes, and replaces affected transaction signatures/grants.
- [x] 1.3 Rename contract validators, DTOs, mappers, repositories, services, forms, audit labels, seeds, and focused tests to `payment_due_day`/`paymentDueDay`.
- [x] 1.4 After applying the migration to the configured Supabase project, regenerate `app/types/database.types.ts`; until then, keep the reviewed compatibility casts used by the deployable application build.

## 2. Invoice issue and correction flows

- [x] 2.1 Add failing preview/snapshot tests, then compute and hash per-invoice schedules with optional `due_date_override` and stale-on-date/config behavior.
- [x] 2.2 Persist per-invoice due/grace values atomically for workspace, AI, and issue-and-pay callers while preserving idempotent replay.
- [x] 2.3 Update reissue and correction paths so omitted override preserves the replaced invoice schedule and explicit override resolves a new due date with snapshotted grace.

## 3. Queries, documents, and UI

- [x] 3.1 Add invoice schedule fields to DTOs/mappers/repositories and derive all overdue filters, dashboard metrics, billing views, and tenant APIs from `overdue_date`.
- [x] 3.2 Replace synthetic four-day email/print fallbacks with honest missing-date copy and expose active grace information on invoice detail documents.
- [x] 3.3 Update the billing issue modal for automatic per-invoice dates plus explicit shared override, and clarify contract/building due-day copy using existing primitives.
- [x] 3.4 Add tenant/admin grace messaging with focused responsive, loading, stale, disabled, legacy-null, and interaction-state tests.

## 4. Verification and documentation

- [x] 4.1 Update billing/contract developer documentation and accepted specs to match the implemented source of truth.
- [x] 4.2 Run focused migration/domain/service/component regressions, OpenSpec validation, typecheck, full tests, lint, and final diff review.
