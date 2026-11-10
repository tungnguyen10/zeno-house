---
type: Verification Record
title: "Restricted portal edits implementation evidence"
status: draft
change_state: verification-pending
tags: [verification]
---

# Verification boundary

Source implementation is present. Cloud functional verification and native visual QA are not claimed complete.

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

A JWT role predicate does not avoid PostgreSQL policy expansion. Prepared follow-up `20261110044223_fix_support_request_policy_recursion.sql`, which removes only the unused direct-manager occupancy SELECT policy. It grants nothing and preserves server-scoped staff reads. Production approval for this additional persistent policy change is pending; the follow-up has not been applied by this worker. Live functional SQL must be rerun after the policy gate is resolved. The failed verification used transaction-local synthetic rows and did not commit them.

Cloud migration dry-runs use an isolated migration directory so unrelated concurrent contract migrations are not accidentally applied or repaired.

## Visual QA tool failure

A temporary Vite harness imported actual portal edit/request and staff queue components with production styles and fictional/mocked state, entirely under `/tmp/restrict-ui-qa`. No business-data API call was made. The owned Vite runtime was stopped.

Browser extension/IAB host was unavailable. Native Chrome input was repeatedly refused because the application was being changed concurrently; no business-page controls were operated. A separate Safari QA session was attempted, but the computer-use transport closed before an observable final page state. Reset and completion-summary calls also failed with `Transport closed`.

Therefore no screenshot/desktop/mobile visual pass is claimed for this change. Actual mounted component/behavior tests pass, but representative native visual verification remains a release gate when the tool connection is restored. No screenshots containing unrelated user/browser content were retained.

## Preserved concurrent work

Tenant V2 overview edits and concurrent contract UI/tests/migrations/documentation are outside this change's commit. Source/application merge or production application deployment is not claimed merely from database metadata or branch commits.
