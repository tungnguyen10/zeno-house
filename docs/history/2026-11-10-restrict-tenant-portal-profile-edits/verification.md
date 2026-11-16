---
type: Verification Record
title: "Restricted portal edits implementation evidence"
status: deprecated
change_state: complete
tags: [verification]
---

# Verification boundary

Source implementation, live cloud rollback verification and representative desktop/mobile component QA are complete. Native QA transport failed; the user explicitly authorized the installed Chrome DevTools CLI as an isolated headless fallback. Application merge/deployment remains separate.

## Source evidence

- Strict nonempty four-field shared schema; mixed/forbidden payloads reject before conflict/persistence/audit. Read DTO/repository mapping excludes internal notes across GET/PATCH/bootstrap. Canonical image POST/DELETE is denied in handler and service before multipart/Storage calls.
- Portal edit/model/optimistic state contains only contact phone, occupation and emergency contact name/phone. Read-only dossier omits internal notes and canonical mutation controls. Literal correction intent opens existing request creation without identity values in URLs/storage; no active-housing context has actionable fallback.
- Scoped staff queue uses lean candidates and full tenant access before descriptions/signing/counting/pagination. Missing evidence is per-row unavailable, not a list-wide failure. Status handling is separate from any tenant/profile mutation.
- Review caught an in-flight selection race; reproduced with a failing mounted-page test, then prevented row switching during a write and checked originating selection before applying late results.
- Added transactional mutation-registry coverage for the new PATCH domain. Status RPC emits only safe before/after status and scope IDs; request creation no longer copies title/description into audit.
- SQL uses invoker/service-only execution, row locking, valid transitions, stale-status errors, idempotent retries and atomic status/audit. No definer bypass was introduced.

Commands/results:

- `npm test`: 388 files / 2,420 tests passed.
- `npm run typecheck`: exit 0 after typed repository allowlist and generated cloud RPC type integration.
- Focused integration suite: 55 files / 371 tests passed.
- SQL contract/recursion regression suite: 2 files / 6 tests passed; recursion regression first failed before its follow-up migration existed.
- Scoped ESLint for all changed portal-owned TS/Vue files: exit 0.
- Full `npm run lint`: blocked by an unrelated concurrent edit at `app/pages/dashboard/contracts/[code]/index.vue:73` (`paymentsError` unused), plus the preexisting `AppAiDevChat.vue:427` warning. These unrelated edits were preserved, not silently modified or included in this change.
- `npm run knowledge:check`: passed; final bundle counts are recorded in the execution checklist.

## Cloud state and functional gate

The linked project is production `zeno-house` (`alndujothmxhilmvykqs`). Read-only preflight confirmed effective raw SELECT privileges and the Storage DELETE guard. Verification enables `storage.allow_delete_query` only transaction-locally on synthetic metadata rows so DELETE assertions exercise RLS, not merely that platform guard.

During concurrent work, remote history acquired `20261110000326_restrict_tenant_portal_profile.sql` before this worker applied it. A read-only catalog check confirmed migration history, removed tenant image write policies, revoked authenticated raw tenant/request reads, and an exact MD5 match between deployed RPC `prosrc` and the reviewed source. All five assertions were true. No claim is made that this worker performed that DDL apply.

Generated `database.types.ts` using existing CLI `supabase gen types typescript --remote --schema public,graphql_public`; never hand-edited. This includes the support status RPC and current cloud nullability changes from the separately deployed contract work. Removed the temporary untyped status-RPC client cast; only the explicit JSON-row boundary remains.

User explicitly approved `restrict_tenant_portal_profile.sql` production fixture verification with rollback. The first run failed with PostgreSQL42P17 (infinite recursion), not a passing authorization result. Catalog inspection identified the preexisting cycle:

`contracts_tenant_select_own -> contract_occupants -> contract_occupants_manager_select -> contracts`.

A JWT role predicate does not avoid PostgreSQL policy expansion. User explicitly approved follow-up `20261110044223_fix_support_request_policy_recursion.sql`. A dry-run in the isolated migration directory listed only this file; the approved push applied it successfully. It removes only the unused direct-manager occupancy SELECT edge, grants nothing, and preserves staff server-owned access. No definer bypass was introduced.

The live functional verification then exposed an outdated verification assumption: cloud Storage uses versioned/partial name indexes, so bare `ON CONFLICT(bucket_id,name)` is not an arbiter. The test now uses the actual fixture object primary key to exercise upsert denial. No Storage index or product code was changed for that verification correction.

The final approved `restrict_tenant_portal_profile.sql` run passed (`restricted_portal_profile_verified=true`). It verifies actual raw-read and canonical image INSERT/UPDATE/upsert/DELETE denial, own image read and generic evidence upload, primary/roommate request insertion, owned evidence prefixes, service-only RPC execution, valid/idempotent/stale transitions, safe audit payloads and rollback on injected audit failure. Every fixture was rolled back.

Final read-only catalog assertions were all true: both migrations recorded; recursive policy edge removed; raw tenant and request reads denied; authenticated RPC execution denied; service-role RPC execution allowed; no `restrict-%` tenant fixture remained. The root migration/RPC source match was already verified by exact `prosrc` MD5.

Cloud dry-runs used an isolated migration directory so unrelated concurrent contract migrations were not applied, replayed or repaired by this worker.

## Isolated committed-source checks

Commit `5d6c1f32` contains the portal implementation and keeps concurrent contract/TenantV2 edits separate. An exported HEAD snapshot with existing dependencies reused was checked independently from those uncommitted edits:

- `npm run typecheck`: exit0.
- `npm test`: 388 files / 2,420 tests passed.
- `npm run lint`: exit0; only the preexisting `AppAiDevChat.vue:427` warning.

The first exported-snapshot test run started before Nuxt had generated its referenced tsconfigs and therefore loaded no tests. It was rerun after preparation completed; the passing result above is from the prepared snapshot, not that failed environment setup.

## Visual QA and polish

Native Chrome/Safari computer-use attempts failed with `Transport closed`; no business-page controls were operated and no unrelated browser screenshots were retained. User then explicitly approved headless Chrome using the installed CLI, a temporary isolated profile and synthetic data. No dependency was installed.

The temporary `/tmp/restrict-ui-qa` Vite harness imported actual portal edit/request/dossier and staff queue components and production styles. Composables, navigation, icons and data were mocked; no authenticated session or production API was used. This verifies component presentation and interaction, not an authenticated end-to-end journey. Screenshots use fictional people and values only.

- Inspected contact edits, correction request, read-only dossier and staff receiving drawer at desktop1280px and mobile375px. Actual viewport/scroll-width checks at375px returned375/375, without horizontal overflow.
- Four writable contact inputs only; initial save disabled; dirty save enabled; read-only dossier shows the correction CTA and no internal notes/canonical image mutation controls.
- Mobile conflict/retry feedback and simulated429 feedback preserve entered values. The first429 screenshot exposed a sticky footer covering the preceding alert. Moved the alert inside the sticky action container above the buttons; repeated QA verifies readable feedback and controls together.
- Correction title stays read-only, file type/one-file/5MB instructions remain visible. Failed submission preserves description and shows actionable retry feedback. Missing housing context displays direct-contact fallback rather than a false recipient.
- Staff drawer shows unavailable evidence safely, separates manual profile edits from request handling, and transitions the mocked status to “Đang xử lý” with live feedback. Actual stale/concurrent/in-flight semantics are covered by mounted/service/SQL tests rather than claimed as authenticated browser coverage.
- Existing portal/dashboard primitives, hierarchy, spacing and themes were preserved. Frontend-design/Hallmark review focused on readable copy, task hierarchy, restrained emphasis, touch controls, focus, overflow and affected error states; no parallel theme or design artifacts were introduced.

Synthetic screenshots are in [evidence](./evidence/contact-mobile.png), including [dossier](./evidence/dossier-mobile.png), [request](./evidence/request-mobile.png), [request retry](./evidence/request-error-mobile.png), [no recipient](./evidence/nohousing-mobile.png), [staff mobile detail](./evidence/queue-detail-mobile.png), [staff desktop detail](./evidence/queue-detail-desktop.png) and [fixed retry feedback](./evidence/contact-429-mobile.png). Owned QA server/headless profile are stopped after verification.

## Final checks

After the visual-only alert placement fix, reran full tests, typecheck, affected ESLint, SQL/staff queue regression tests, knowledge validation and whitespace checks. Final results:388 files /2,420 tests passed; typecheck exit0; affected ESLint exit0; SQL/staff queue regression3 files /24 tests passed; OKF307 concepts /14 indexes passed; whitespace check passed. Sanitized live SQL results are in [cloud checks](./evidence/cloud-checks.json). No new product behavior or database change was introduced by that polish fix.

## Preserved concurrent work

Tenant V2 overview edits and concurrent contract UI/tests/migrations/documentation are outside this change's commit. Source/application merge or production application deployment is not claimed merely from database metadata or branch commits.
