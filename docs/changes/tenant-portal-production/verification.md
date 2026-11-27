---
type: Verification Record
title: "Tenant portal production verification and release"
status: draft
tags: [tenant, portal, verification, release]
---

# Verification and release

Verification date: 2026-11-27. Initial review base: `develop` at
`3d14742c2acfa3db4c2ce8bb9ada151534c634eb`. Implementation was brought forward to
`develop` at `e9180f2f0625ccfabd0ed9260d9e9a89e336f049` before the final checks.

The source implementation is complete and awaiting the release gates below.
Local verification does not establish that a database migration, authenticated cloud test,
or production deployment happened.

## Source and regression evidence

- Finance pipeline tests exercise exact invoice pagination beyond twenty records, complete authorized
  outstanding totals, multiple repository batches, incomplete-batch rejection, primary/roommate scope,
  void exclusion, monthly aggregation, recorded payments and persisted meter snapshots.
- Scope tests deny unrelated, roommate and inactive-contract access to official contract files;
  signing requires an issued/signed record and its canonical contract/building storage path.
- Session tests cover identity-keyed reads, sign-out/cache clearing, late read/mutation responses,
  cancelled uploads and optimistic rollback without replacing a new account's data.
- Support tests cover paged history, scoped detail, attachment-signing degradation, public replies,
  stale version rejection, neutral payment-report drafts, draft navigation guards and upload aborts.
- PWA controller tests cover first install, repeated releases, waiting-worker deduplication,
  externally activated workers and explicit update actions. Component tests cover dirty-form,
  offline and in-flight mutation blocking, bottom-sheet focus/scroll behavior and refresh continuity.
- SQL source/contract tests check table and column privileges, service-role-only RPC execution,
  additive overload compatibility and the atomic status/reply/audit contract. These are static tests,
  not evidence of executing SQL against the deployed database.
- Independent finance/security, support and PWA reviews were completed. Account-change mutation races,
  worker lifecycle edge cases and legacy four-argument RPC rollout compatibility were corrected.

## Combined local checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed; local environment does not contain Supabase URL/key configuration. |
| `npm run lint` | Passed with no errors; one pre-existing `vue/no-v-html` warning in `AppAiDevChat.vue`. |
| `npm run test:coverage` | Passed: 527 files / 3,341 tests; existing billing-service coverage thresholds passed. The final run completed in 78.70 seconds. |
| `npm run build` | Passed, including client, SSR, Nitro, manifest and service-worker generation. |
| `npm run knowledge:check` | Passed: 357 concepts and 33 index files. |
| `git diff --check` | Passed for the staged implementation and evidence. |

The coverage command uses the repository's existing billing-service coverage scope and thresholds;
it must not be presented as a portal-wide percentage or a browser end-to-end test.

The generated worker has ten precache entries: the generic offline shell, six icon/favicon assets,
the web manifest and two non-sensitive Nuxt build metadata files. Inspection found no tenant API,
authenticated HTML or signed-storage entry. The generated manifest uses `/` for start/scope,
standalone display, Vietnamese language and 192/512/maskable icons. Non-blocking build warnings
include missing local Supabase configuration, old Browserslist data, a module-preload sourcemap
warning and existing mixed static/dynamic icon imports; no latency or device benchmark is claimed.

## Browser evidence

A scratch-only visual harness loaded the actual portal Vue pages, layout, components, composables,
styles and icon pipeline with synthetic API/auth fixtures. It was not added to the repository.

- Home was inspected at viewport widths 320, 375, 390, 414 and 768 CSS pixels and at desktop width.
  The measured mobile/tablet document width matched its viewport; no horizontal overflow was observed.
- Both light and dark invoice views were inspected. Navigation contrast, selected states, debt priority,
  status badges and payment instructions remained legible. Mobile tab targets measured 70 by 57 pixels
  at the 390-pixel viewport.
- Invoice detail displayed recorded payment method and persisted electricity/water readings.
  Payment refresh did not fabricate a paid state. The payment-report action opened a neutral support
  draft with the invoice reference, and preserving the draft retained the entered text.
- Support detail displayed a long description, a public staff reply, timestamps and an attachment-
  unavailable state. Bottom sheets used internal scrolling and restored focus after dismissal.
- Current-primary room UI displayed issued contract metadata and its open action. A profile read
  remained usable independently of a failed bootstrap fixture. Actual signed downloads and sign-in
  were not exercised by this fixture harness.
- Visual review found and corrected light-theme navigation contrast, inherited scroll position on
  route changes, status wrapping and toast interference with draft-confirmation controls. The final
  invoice navigation was observed at `scrollTop: 0`; the final desktop sidebar was also inspected.

This evidence establishes responsive rendering and the exercised interactions. It does not establish
installed iOS/Android behavior, real mobile keyboard behavior, production network latency, real
Supabase authorization, or service-worker installation/update on the deployed origin.

## Release sequence

1. Review and apply
   `supabase/migrations/20261127090000_tenant_portal_private_reads.sql`, then run
   `supabase/verification/tenant_portal_private_reads.sql`. The verification is read-only catalog
   inspection in a rolled-back transaction. Confirm browser roles have no table or column SELECT
   on contracts, occupants and invoices, no direct support-request writes, and service-role access
   remains intact. This closes an unnecessary direct access path identified in source; it does not
   assert that deployed data was previously exposed.
2. Apply `supabase/migrations/20261127091000_tenant_support_public_response.sql`, then run
   `supabase/verification/tenant_support_public_response.sql`. Run the complete script as `postgres`
   with at least one existing `auth.users` actor and the prior support migration baseline, including
   the four-argument RPC. It creates fixture rows and an audit-failure trigger
   inside a transaction that is always rolled back; use a reviewed non-production dataset first.
   It verifies reply/status/audit atomicity, stale updates, privileges and legacy compatibility.
   Require clean execution with no SQL errors; a final marker alone is insufficient if a SQL client
   continues after errors.
3. Keep the existing four-argument service-role-only support update RPC during the application rollout.
   The new six-argument overload handles expected timestamps and public responses; the legacy overload
   preserves existing reply content. Remove it only in a separate migration after old application
   instances have drained and compatibility evidence is recorded.
4. Generate `app/types/database.types.ts` from the actual migrated Supabase schema using the project's
   cloud workflow, then remove the narrow support RPC type adapter if generated overload types allow it.
   The generated file was deliberately not edited by hand in this change.
5. Deploy the reviewed application build with its existing Supabase runtime configuration and Vercel
   `/offline` to `/offline.html` rewrite. Confirm response headers, actual SW precache entries and
   the manifest on the deployed origin. Plain Nitro preview without that rewrite is not equivalent
   to the production offline URL routing.
6. Execute the authenticated and installed-device checks below, record evidence and then close the
   release gate. Database rollback must preserve the stricter privacy grants; do not reopen direct
   business-table reads to compensate for an application rollback.

## Required production checks — not yet executed

- Confirm direct authenticated business-table access is denied while server APIs still work for
  primary and roommate accounts; also exercise suspended/disabled and unrelated accounts.
- Verify invoice history beyond twenty entries, debt from old periods, void/reissue math and actual
  payment receipts against known database totals.
- Verify public support replies, stale-update rejection, legacy RPC compatibility and unavailable
  attachments using real scoped accounts.
- Verify current-primary contract downloads and denial for roommate, unrelated and expired contexts.
- Exercise account disable, sign-out and account switching with delayed requests in the same browser.
- Exercise installed PWAs on iOS and Android: install, offline navigation, reconnect, bank-app return,
  successive worker releases, updates with a dirty form or upload, safe areas and the software keyboard.
- Confirm no tenant response, signed URL or authenticated HTML appears in Cache Storage; verify
  `private, no-store` response headers even on authentication errors.

No cloud database execution or deployment credentials were available during this implementation.
Do not declare production release complete until these checks have recorded evidence.
