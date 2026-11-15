---
type: Verification Record
title: "contract-quick-create — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, contracts]
---

# Contract quick create — verification

> Tasks 1–7 implemented TDD-first on Node 22. Code only (no git, no visual QA). Cloud gate (two migrations) is maintainer-run.

## Local (source) — run on Node 22 (2026-11-12)

- [x] `npm run typecheck` — pass (Supabase env warnings only).
- [x] `npm test` — **2665/2665 pass** (440 files).
- [x] `npm run lint` — 0 errors (1 pre-existing `vue/no-v-html` warning, unrelated).
- [x] `npm run knowledge:check` — OK (332 concepts).

## What shipped

**Backend (T1–5):**
- Migrations `20261111120000_contract_quick_create.sql` (`contract_vehicles` table + `create_contract_full` RPC) and `20261111121000_contract_create_drafts.sql` (per-user server draft, service-role-only, ≤64 KB payload check). RPC `create_contract_full` is atomic + idempotent (audit_operations `contract.create:<request_id>`, same-actor replay, foreign-actor conflict); wraps PR2's `create_contract_with_handover_and_inventory`; enforces occupant limit/primary/busy, inserts vehicles, clones-or-inserts services, sets room `occupied`. Existing contract RPCs unchanged.
- Validators: vehicles (plate normalize upper + single-space + trim, unique, limits), occupants, services, `request_id` on `contractCreateSchema`, `contractCreateDraftSchema` (rejects CCCD/dob).
- `ContractService.create` rewritten to call `create_contract_full` (pre-RPC checks kept; dropped best-effort cloneFromBuilding + post-RPC room update; audit after commit; replay → no audit). New audit action(s) + Vietnamese labels in `audit/display.ts`.
- APIs: `GET/PUT /api/contracts/[id]/vehicles`; `GET/PUT/DELETE /api/contracts/create-draft` (own-user, 413 over 64 KB, >30d treated absent); `PUT /api/contracts/[id]/handover-inventory`.

**UI (T6):**
- `contracts/create.vue` rewritten to one page: four always-visible blocks (Phòng / Khách / Điều khoản / Bàn giao) + collapsible blocks (Người ở cùng / Xe / Dịch vụ / Nội thất) with count indicators; prefill priority user-edited > per-building prefs (localStorage, no PII) > building defaults; handover readings required only when the room has no prior reading; sticky mobile action bar; scroll-to-first-error + auto-open its block; server draft autosave; done screen. Reused existing primitives; collapsible via local composition (no new primitive).
- New `ContractVehiclesEditor.vue` (create page + contract detail "Xe" section) and `ContractServicesEditor.vue` (local mode); `ContractForm` split into reusable terms/handover field groups (edit page unchanged).

## Deltas / fixes applied by parent

- Room selector in the rewritten create page was passing `{value,label}[]` + a string model-value to the generic `UiCombobox` (expects object options + `optionKey`/`optionLabel`, emits the option object) → typecheck error at create.vue:240. Fixed to mirror `ContractForm`'s room combobox (`:model-value="selectedRoom"`, raw room options, `option-key`/`option-label`, `@update` extracts `id`).
- `ContractVehiclesEditor.test.ts` didn't register `UiInput`, so `findAll('input')` found no native inputs and the blur-normalize test failed. Registered the real `UiInput` (+ icon stubs) in the test; `normalizePlate` itself was already correct (upper + collapse whitespace + trim).

## Visual QA — run by maintainer

- [x] Shortest path (room + tenant only) created `hd-qav2-2026-0001`; missing handover readings are now rejected with a clear message (previously stored as 0, fixed); collapsed-block errors scroll to and open the block; server draft restore works after the envelope fix; per-building prefill of services and inventory works; 390px mobile action bar is docked above the tab bar (fixed 2026-11-15)
- [x] Atomic create with roommate + vehicle + 3 services + 4 inventory items + readings (`hd-qav2-2026-0002`): all rows present, draft cleared
- [ ] Per-type 409 (occupant busy) and retry after a network error — covered by `supabase/verification/contract_quick_create.sql` and unit tests, not exercised in the browser

## Cloud gates (order matters)

- [x] Migrations `20261111120000` + `20261111121000` applied — production, 2026-11-15
- [x] `supabase/verification/contract_quick_create.sql` passed — production, 2026-11-15 (idempotency same/foreign actor, occupant limit/busy rollback, unknown service rollback, grants)
- [x] Grants: anon/auth = false, service_role = true
- [x] Types regenerated; `as never` casts removed — see commit history on `feat/v2-pr0-pr4b`
