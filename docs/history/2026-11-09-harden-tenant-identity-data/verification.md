---
type: Verification Record
title: "Tenant identity hardening verification"
status: deprecated
tags: [verification, tenants, security, cloud]
---

# Tenant identity hardening verification

Verified on 2026-11-09 against linked Supabase production project `zeno-house` (`alndujothmxhilmvykqs`) with Supabase CLI v3.0.0. User explicitly authorized both migrations, rolled-back SQL verification, type generation and local UI QA.

## Production schema rollout

`supabase db push --remote --skip-vault --dry-run` listed exactly two migrations and no seeds/roles. `supabase db push --remote --skip-vault --yes` successfully applied:

- `20261109155705_tenant_identity_conflict_limit.sql`
- `20261109155706_harden_tenant_identity_data.sql`

Unicode-safe preflight returned zero duplicate groups. The preflight confirmed only `tenants_set_updated_at` as a user-defined tenant trigger and root ICU collation availability. No real names, phone numbers or ID numbers are retained in this evidence.

## Live SQL assertions

- `tenant_identity_normalization.sql`: all 31 shared TypeScript/SQL fixture cases passed, including Unicode whitespace/casing and the intentional invalid-legacy-phone fallback.
- `harden_tenant_identity_data.sql`: eight top-level boolean assertion groups passed; normalization trigger, unique constraints, self-update, RPC privileges, threshold, retry interval and next-window recovery verified.
- `atomic_contract_renewal.sql`: all procedural scenario assertions passed.
- `atomic_billing_close.sql`: all procedural scenario assertions passed after correcting the verifier's ambiguous latest-audit selection to a specific correlation ID.
- `tenant_scoped_bulk_status.sql`: all procedural checks and eleven top-level boolean assertion groups passed.

The CLI returns only the final statement result. For verification scripts with bare boolean SELECTs, temporary execution wrappers converted those SELECTs to DO assertions which raise on any non-true/empty result. Original transaction boundaries and rollback statements were retained. All mutation fixtures rolled back. The shared normalization fixture is read-only; its DO syntax requires CLI confirmation despite making no writes.

The billing verifier failure was in its audit selection: `now()` is identical throughout one transaction, so descending random UUID order can select the first close event. The verifier now supplies and selects the second close's exact correlation ID. No billing production function was changed.

## Final production catalog assertions

| Assertion | Result |
| --- | --- |
| `all_identities_canonical` | `true` |
| `identity_indexes_valid` | `true` |
| `migrations_recorded` | `true` |
| `no_verification_tenants_remain` | `true` |
| `peek_anon_denied` | `true` |
| `peek_authenticated_denied` | `true` |
| `peek_service_allowed` | `true` |
| `record_anon_denied` | `true` |
| `record_authenticated_denied` | `true` |
| `record_service_allowed` | `true` |

## Generated types and source verification

`supabase gen types typescript --remote --schema public,graphql_public` regenerated `app/types/database.types.ts` with 23 added lines for the new functions. No generated types were hand-edited. The temporary untyped RPC cast was removed; the repository now calls typed `client.rpc` and consumes its inferred result.

Post-generation `npm run typecheck` passed. Narrow tests for the conflict service, limiter repository and billing migration passed: 3 files / 40 tests. Full source verification and final UI evidence are recorded in the canonical implementation plan.

## Scope and limitations

This verifies the schema deployment, SQL behavior, generated types and branch implementation. It does not claim the application branch was merged or deployed to production. Historical audit PII remains unchanged. Conflict budgets use separate peek/record operations and are not strict concurrent-admission quotas.

## Existing portal requirement divergence

The preexisting `tenant-portal-api` profile whitelist says legal identity is operator-managed, but the source baseline already accepts and renders editable `id_number`, `id_issued_date` and `id_issued_place`. This change's approved design explicitly hardens that existing portal identity write path and does not add it. The legacy operator-managed requirement has not been silently removed or claimed enforced: narrowing the portal whitelist and changing its editable UI is a separate behavior change. The new conflict/normalization requirements apply defensively to every existing write path; they do not establish that operator-managed restriction.

## Affected-state visual evidence

Representative desktop/mobile checks used actual production form/primitives, actual portal edit composition, production styles, mocked errors and fictional data in an isolated temporary Vite harness. Actual TenantForm submit ran before the error props were applied. Nuxt auto-imports/composables were supplied by the harness and decorative icons were stubbed. This verifies the affected error states and responsive wrapping, not authenticated route journeys, icon artwork, the full app shell or every viewport/theme combination.

- Desktop1739×1009: create generic banner and specific phone/ID field errors.
- Mobile375×900: specific duplicate, edit generic, 429 retry banner, import conflict row, portal generic/save area.
- Desktop1024×900: import and portal generic state.

A mobile import row label was squeezed onto two lines; `shrink-0` now preserves its line-number label while the generic reason wraps. The fix was visually rechecked. No material affected-state issues remained. Temporary QA server was stopped, and no harness files entered the repository.

See the cropped synthetic page captures under [evidence/](./evidence/). The retained files exclude browser tabs/address/bookmarks/profile chrome. Translation/Bitwarden extension overlays and a DevTools viewport-size label may appear over page content; these are unrelated to the app and contain no account data.

| Capture | State |
| --- | --- |
| [create-generic-desktop](./evidence/create-generic-desktop.png) | Desktop generic create conflict |
| [create-specific-desktop](./evidence/create-specific-desktop.png) | Desktop phone/ID duplicate errors |
| [create-specific-mobile375](./evidence/create-specific-mobile375.png) | Mobile specific duplicate |
| [edit-generic-mobile375](./evidence/edit-generic-mobile375.png) | Mobile edit generic conflict |
| [edit-rate-mobile375](./evidence/edit-rate-mobile375.png) | Mobile 429 retry interval |
| [import-desktop1024](./evidence/import-desktop1024.png) | Desktop import identity conflict |
| [import-mobile375](./evidence/import-mobile375.png) | Mobile import identity conflict after wrapping fix |
| [portal-generic-desktop1024](./evidence/portal-generic-desktop1024.png) | Desktop portal generic conflict |
| [portal-generic-mobile375](./evidence/portal-generic-mobile375.png) | Mobile portal generic conflict |
