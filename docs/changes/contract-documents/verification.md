---
type: Verification Record
title: "contract-documents — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, contracts, documents, docx, pii]
---

# Contract documents — verification

> Tasks 1–10 implemented TDD-first on Node 22. Code only (no git, no visual QA). Cloud gate (migration + Storage bucket + cron) is maintainer-run. Dependency gate: `docxtemplater`/`pizzip` were already in package.json (installed), so no new install.

## Local (source) — run on Node 22 (2026-11-12)

- [x] `npm run typecheck` — pass (Supabase env warnings only).
- [x] `npm test` — **2724/2724 pass** (453 files).
- [x] `npm run lint` — 0 errors (1 pre-existing `vue/no-v-html` warning, unrelated).
- [x] `npm run knowledge:check` — OK.

## What shipped

**DOCX pipeline (T2–5):** `app/utils/format/vnd-words.ts` (vndToWords); template sources `server/assets/contract-templates/{hop-dong-thue-phong,phu-luc-hop-dong}/v1.docx` + `manifest.ts` (converted from the existing docxtpl template to docxtemplater `{{ }}` / `{{#loop}}` syntax, added services table + Phụ lục 1 inventory table, via `scripts/build-contract-templates.mjs`); `render.ts` (docxtemplater, nullGetter throws → no leftover placeholders); `build-data.ts` + `missing.ts` + `sources.ts` (ContractDocumentData builder + collectMissing).

**Migration (T6):** `20261111130000_contract_documents.sql` — private `contract-documents` bucket; `contract_documents` table (status machine, unique-active partial index, immutability trigger, FK `on delete restrict`); replaced PR2's `contract_inventory_items` immutability trigger with one locking after an issued/signed contract doc (`CONTRACT_INVENTORY_LOCKED`); RPCs reserve/finalize/fail/sign/void/claim_stale; service-role-only. Verification SQL.

**Service/API/worker (T7–8):** `ContractDocumentRepository`; `ContractDocumentService` (list/check/preview/issue/regenerate/sign/void/readiness/download) with reserve→upload→finalize + compensation (upload fail → fail keeps snapshot; finalize fail → delete object + fail) and `request_id` idempotency; capabilities `contract-documents.read/issue` (admin/owner/manager) + `sign/void` (admin/owner); audit actions + Vietnamese labels; validators; 9 API routes; cleanup worker `POST /api/internal/contract-documents/cleanup` (secret header + `runtimeConfig.contractDocumentsCleanupSecret`). snapshot/storage_path never leave the server. Added `contract-documents/` to the audit mutation registry.

**Remove-flow guards:** `ContractService.remove`/`RoomService.remove` (+ bulk) pre-check `contract_documents` → 409 `details.contractDocuments` / bulk reason `has_contract_documents` (FK is `on delete restrict`).

**UI (T9):** contract detail "Tài liệu" section (`#documents`) with version list + download/sign/void/regenerate; `ContractDocumentIssueDialog` (check → preview/issue, reused for appendix); contract create page wired to `/api/contract-documents/readiness` to swap the primary button and issue DOCX after create.

## Deltas / fixes applied by parent

- First "backend" fork only completed Tasks 2–6; Task 7 (service orchestration) and Task 8 (routes/worker) were missing (suite stayed green because nothing forced them). Completed via follow-up forks; the UI fork had correctly refused to build on absent endpoints.
- Lint: removed a `require('pizzip')` (→ top import) and `console.log` (→ `console.warn`) the template-build/inspect scripts left; fixed a `no-dynamic-delete` in the cleanup-worker test.
- Audit mutation registry: added `contract-documents/` policy (the governance test requires every mutation route prefix to be declared).
- cleanup-worker test mocked `removeObject` as a non-promise → route's `.catch` threw; fixed the mock to resolve.
- `ContractDocumentsSection.vue`: typed the status→`UiBadge` variant map as `StatusVariant` (was `string`).

## Visual QA — run by maintainer

- [ ] Issue dialog: missing-data list vs ready; preview (no save) vs publish; appendix from amendment row.
- [ ] Documents section: version list, download, mark-signed, void-with-reason, regenerate (failed), manager cannot sign/void.
- [ ] Create page: readiness swaps primary button; "Tạo & xuất DOCX" issues then shows download / missing / regenerate; contract always created on issue failure. Mobile.

## Cloud gates (order matters)

- [ ] Migration `20261111130000_contract_documents.sql` applied; `contract-documents` private bucket created — <env, date>
- [ ] `supabase/verification/*contract-document*` passed (unique-active incl failed; immutability + status transitions; no delete; claim_stale; inventory locked after issued; grants) — <output>
- [ ] `pg_cron` entry for the cleanup worker (base URL + secret in Vault) — <output>
- [ ] Types regenerated; `as never` casts removed from contract-documents repo — <commit>
- [ ] Deployed smoke: issue a contract DOCX, download, mark signed, void+reissue, regenerate a failed doc; deleting a contract with documents is blocked.
