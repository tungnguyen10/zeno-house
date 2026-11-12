---
type: Verification Record
title: "building-contract-defaults — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, buildings, pii]
---

# Building contract defaults — verification

> Tasks 1–9 implemented TDD-first on Node 22; code only (no git, no cloud). Parent to complete Task 10 (full local suite run + cloud gates).

## UI decisions (Task 8 & 9)

- Reused existing primitives only: `UiFormSection`, `UiInput`, `UiAlert` (`severity`), `UiButton`, `UiBadge` (`variant` = success|warning|neutral), `UiSection`, `UiSurfacePanel`, `UiDefinitionList`/`UiDefinitionItem`, `NuxtLink`. No new tokens/primitives.
- `BuildingContractProfileSettings.vue` mirrors `BuildingInvoiceProfileSettings.vue`: editable grid for owner/admin, read-only `UiDefinitionList` for managers with the CCCD masked and "Ẩn với vai trò quản lý" for date of birth and permanent address. Group hints reference the DOCX clause numbers. Group 5 renders the derived payment-window sentence ("Trên hợp đồng: …") with source captions (phát hành / hạn thanh toán / ân hạn) and a "Sửa lịch vận hành" link; when the schedule is incomplete a `UiAlert severity="warning"` replaces it.
- Save button `data-test="contract-profile-save"` only rendered when `canEdit`; validation runs client-side via `buildingContractProfileSchema` and emits snake_case input.
- `BuildingReadinessCard.vue` (building detail): compact single line when both ready; otherwise two collapsible rows ("Lập hợp đồng" / "Xuất hóa đơn") with a "Thiếu N mục" badge and a toggle that expands the missing items as anchor links (settings `#contract-profile`/`#invoice-profile` or the building edit page for schedule/rates). No inline `<svg>`.

## Local (source) — run on Node 22 (2026-11-12)

- [x] `npm run typecheck` — pass (only Supabase env warnings).
- [x] `npm test` — **2508/2508 pass** (404 files).
- [x] `npm run lint` — 0 errors (1 pre-existing `vue/no-v-html` warning in `AppAiDevChat.vue`, unrelated).
- [x] `npm run knowledge:check` — OK (330 concepts, 26 index files).

Environment note: the workspace shipped with Node 18 and no `node_modules`; installed deps and ran all checks under Node 22 (nvm). Git commit/branch/PR and the cloud gate below are maintainer-run.

## PII checks

- [x] Manager profile response masks id/dob/address — `contract-profile-service.test.ts` "never sends raw PII to a manager"
- [x] Settings bootstrap for manager contains no raw id — `settings-bootstrap.test.ts` "includes contract profile and readiness"
- [x] Audit metadata contains only changed field names — `contract-profile-service.test.ts` "upserts and audits only changed field names"
- [x] 422 responses do not echo values — `contract-profile-api.test.ts` "PUT rejects invalid id number ... without echo"

## Visual QA — run by maintainer

- [ ] Owner: empty / partial / complete / save error — desktop + mobile
- [ ] Manager: masked read-only
- [ ] Schedule missing warning
- [ ] Detail page readiness card: missing / ready

## Cloud gates

- [ ] Migration `20261111100000_building_contract_profiles.sql` applied — <env, date>
- [ ] `supabase/verification/building_contract_profiles.sql` passed — <output>
- [ ] Cascade check (delete building removes profile) — <result>
- [ ] Types regenerated; `as never` cast in `building-contract-profiles.ts` removed — <commit>
