---
type: Implementation Plan
title: "2026-11-05-tenant-authorization-scope"
status: draft
change_state: rollout-verification-pending
tags: [superpowers, change, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/plans/2026-11-05-tenant-authorization-scope.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Migrated P0 design/execution artifact. Validate actual source, migrations, tests, and rollout state before treating checked tasks as delivered. Canonical accepted requirements live in `docs/capabilities/**`.

# Tenant Authorization Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Complete PR1 / ZH-SEC-01 from the approved `docs/changes/tenant-authorization-scope/design.md`.

**Architecture:** A shared TypeScript authorization service resolves active and historical tenant relationships in batches. Services enforce capabilities before scope, serialize basic profiles through an allowlist, and send only authorized IDs and server-derived relationship snapshots to a tenant-specific status RPC. The existing UI consumes the server's access level.

**Tech Stack:** Nuxt, Vue, TypeScript, Vitest, Supabase PostgreSQL.

## Global Constraints

- Services own permissions and business rules; repositories only query/persist.
- Capability denial is 403 before tenant lookup; missing/none is 404; basic mutations are 403.
- Active relationships mean active primary contracts or occupant rows with null move_out_date, without new date rules.
- Basic DTOs contain only id, code, fullName, phone, status, accessLevel; no identity fields, paths, URLs, assignments, or Portal state.
- Creator custody applies only before any contract history; multiple active buildings outside actor scope fail closed.
- Preserve existing capabilities and building visibility semantics; delete uses server-derived buildings and canDeleteMasterData.
- Never hand-edit app/types/database.types.ts. Prepare cloud Dashboard SQL; do not start/install local dependencies or containers.
- Preserve existing UI primitives, tokens, typography, density, and theme. Vietnamese copy must have diacritics.

### Task 1: Shared authorization and service enforcement

**Files:** `server/services/tenants/authorization.ts` (new), `server/repositories/tenants/index.ts`, `server/services/tenants/index.ts`, `server/services/tenant-portal/accounts.ts`, `server/repositories/tenants/bulk-status.ts` (new), `server/api/tenants/[id].delete.ts`, `app/types/tenants.ts`, matching tests in `tests/server/tenants/` and `tests/server/tenant-portal/accounts.test.ts`.

**Interfaces:**
```ts
type TenantAccessLevel = 'full' | 'basic' | 'none'
type TenantAction = 'read_profile' | 'update_profile' | 'manage_documents' | 'archive' | 'activate' | 'delete' | 'manage_account'
// Repository facts keyed by canonical tenant ID:
interface TenantAccessFacts { activeBuildingIds: string[]; historicalBuildingIds: string[]; everContracted: boolean }
// Context also retains historicalBuildingIds for server-owned delete checks.
// resolveAccess(event,user,idOrCode), resolveAccessMany(event,user,ids), assertAccess(event,user,idOrCode,action)
// Bulk RPC contract: bulk_tenant_status_action({p_action, p_items:[{id,expected_building_ids}]})
// -> [{id,succeeded,reason}]
```

- [ ] Add failing tests for the complete admin/owner/manager access matrix, capability ordering, canonical IDs, creator/history, and open occupant relationships. Run `npm test -- tests/server/tenants/authorization.test.ts` and record expected failure.
- [ ] Implement batch facts and authorization. Resolve tenant identifiers before facts; use sorted unique building sets; batch creator lookups for resolveAccessMany. Admin still requires capabilities. Missing tenant facts must not broaden access.
- [ ] Add failing service regression tests for out-of-scope update/image/delete/bulk/Portal and transferred/basic profile redaction. Include zero storage/Auth side effects when denied; creator list filtering; full-only account list; mixed/deduplicated bulk results and success-only audits.
- [ ] Implement service integration. Get returns an explicit basic allowlist or full profile with signed images. List must not expose sensitive profile/assignment information for basic tenants; default owner list excludes historical-only tenants while building-history lookup remains possible. Preserve contract picker behavior as specified outside scope.
- [ ] Remove client buildingId fallback from delete callers/options. Determine delete grants from all relevant server-owned buildings; orphan deletion requires full creator custody and role capability. Bulk deduplicates IDs, preclassifies authorization failures, calls the tenant RPC only with full contexts, normalizes failure reasons, and audits only successes with server-owned building context.
- [ ] Replace Portal scope loading with assertAccess(manage_account), use canonical tenant IDs for links/audits/Auth side effects, and filter list through resolveAccessMany(full).
- [ ] Run all affected tenant/API/Portal tests, typecheck, and targeted ESLint. Report commands and any remaining migration/type-generation dependencies. Do not hand-edit generated types; isolate the pre-generation RPC typing at its repository boundary using the established pattern.

### Task 2: Scoped status RPC and rollback verification

**Files:** CLI-generated `supabase/migrations/*_tenant_scoped_bulk_status.sql`, `supabase/verification/tenant_scoped_bulk_status.sql`, database verification tests if an existing harness applies.

**Interfaces:** Consumes Task 1's `bulk_tenant_status_action` contract. Produces one result per unique item, with `not_found`, `conflict`, or success.

- [ ] Inspect tenant/contract/occupancy schema and existing bulk tenant status semantics. Discover available Supabase CLI with `--help` before `migration new tenant_scoped_bulk_status`; do not install CLI or start a runtime.
- [ ] Write verification cases first, enclosed in BEGIN/ROLLBACK, with alias-labelled assertions: role execute grants; matching A scope; expected A vs actual B conflict; missing ID; already-target status; primary and open-occupant union; empty relationship snapshot. Fixtures must satisfy actual schema constraints and cleanly rollback.
- [ ] Implement `security invoker`, `set search_path = ''`, schema-qualified SQL. Validate archive/activate, process sorted IDs, lock tenant row FOR UPDATE, recompute exact active building set, compare sorted expected snapshot, then apply existing tenant status semantics. Do not alter generic bulk_master_data_action.
- [ ] Revoke EXECUTE from PUBLIC/anon/authenticated and grant only service_role; document Dashboard apply, verification, advisors, and cloud type-regeneration steps. Run available static/narrow checks; explicitly report if cloud execution is unavailable rather than claiming live verification.

### Task 3: Basic-access UI, requirements, and final verification

**Files:** `app/pages/dashboard/tenants/[code]/index.vue`, `[code]/edit.vue`, `app/pages/dashboard/tenants/index.vue`, `app/components/tenants/TenantDetailHero.vue`, related composables/components/tests as needed; `docs/architecture/auth-permissions.md`, `docs/features/property-operations.md`, relevant Portal feature docs, `docs/capabilities/tenants-api.md`, `docs/capabilities/tenants-ui.md`, `docs/capabilities/tenant-account-provisioning.md`.

**Interfaces:** Consumes tenant DTO accessLevel full/basic; bulk failure codes not_found/forbidden/conflict/has_active_contracts/has_active_occupancies/unexpected_error.

- [ ] Read frontend-design, Hallmark, frontend architecture/design system and relevant path instructions. Preserve current composition and polish affected states only.
- [ ] Add failing focused tests proving basic cannot render edit/document/delete/Portal controls, cannot fetch Portal status, and direct edit access does not expose a form. Verify full behavior remains available.
- [ ] Apply explicit `accessLevel === 'basic'` read-only states. Use existing UiAlert with the approved Vietnamese message, basic hero without CCCD, and safe handling of absent sensitive fields. Gate in-flight actions and refresh transitions, retain scoped contract history.
- [ ] Group bulk failures with Vietnamese reasons and truthful success/failure counts; unknown errors use a generic Vietnamese message. Inspect desktop/mobile and light/dark affected layouts when an authorized runnable UI exists.
- [ ] Close the equivalent full-profile XLSX path in `server/services/tenants/export.ts`: filter candidates through `resolveAccessMany` full contexts and recheck selected IDs before reading sensitive rows/building workbook. Add a multi-building basic-access regression to `tests/server/tenants/export-service.test.ts`. This follows the approved sensitive-profile rule; code inspection found the alternate read path.
- [ ] Update accepted specs to the new matrix and remove contradictory creator/history/admin-only bulk statements; update engineering/feature docs and migration rollout limitations. Validate `npm run knowledge:check`.
- [ ] Run `npm run typecheck`, `npm test`, `npm run lint`. Fix regressions, review the complete diff for security leaks and capability/scope consistency, and record exact outcomes and any external SQL rollout step.

## Execution Record

- Design approved by user: “làm toàn bộ”. Execute in this session without further design approval gates.
- Baseline branch: develop, clean working tree at 86146a9. No CodeGraph index present.
- Checklist completion and verification evidence are recorded below as work proceeds.

- Task 1 complete: shared authorization, service integration, safe search; 143 affected tests pass, targeted lint/diff checks pass. Independent review approved after exact-count pagination fix. Two optional-field type consumers remain for Task 3.
- Working branch: `codex/tenant-authorization-scope`. User approved starting `npm run dev` for visual verification.

- Task 2 complete: CLI-generated migration `20261105032920_tenant_scoped_bulk_status.sql`, transactional rollback verification, and 3 static tests pass; targeted lint/diff checks pass. Independent review approved. Live PostgreSQL execution and cloud type generation are pending the manual rollout.

- Task 3 complete: basic-access UI (detail, edit, list, Portal accounts), grouped bulk failure reasons, XLSX export gated by full access, accepted specs and docs updated. Verified 2026-11-05: `npm run typecheck` pass; `npm test` 354 files / 2022 tests pass; `npm run lint` 0 errors (1 pre-existing `vue/no-v-html` warning in AppAiDevChat.vue, unrelated); legacy OKF validation passed before OKF migration.
- Not done: live PostgreSQL run of `supabase/verification/tenant_scoped_bulk_status.sql`, cloud type regeneration, and desktop/mobile visual inspection.
