---
type: Verification Record
title: "room-setup-inventory-lite — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, rooms, inventory, contracts]
---

# Room setup & inventory lite — verification

> Tasks 1–10 implemented TDD-first on Node 22; code only (no git, no cloud). Parent completes Task 11 (full local suite + docs) and the cloud gate.

## UI decisions (Tasks 8–10)

- Reused existing primitives only (`UiInput`, `UiSelect`, `UiButton`, `UiBadge`, `UiAlert`, `UiCheckbox`, `UiModal`, `UiConfirmModal`, `UiSection`, `UiSurfacePanel`, `UiFormSection`, `UiDefinitionList`). No new tokens/primitives.
- `InventoryItemsEditor`: responsive stacked rows (grid on `sm+`, card-style stack on mobile per the approved "card on mobile" direction); inline add/remove; live total via `inventoryTotalValue`; field errors keyed `"{index}.name"`.
- `InventoryItemsList`: read-only list with per-item value and a reference total; optional source note line.
- `RoomBatchGenerator`: floor-range generator inputs (từ/đến tầng, số phòng mỗi tầng, tiền tố, STT bắt đầu, gắn số tầng, số tầng trong tên) + per-floor grouped preview with editable floor/rent/area, existing-room badge ("Đã có", excluded from payload), manual add/remove rows, and the generator-error copy map. The shared composable is passed in and driven by the component (aliased locally to keep lint's prop-mutation rule satisfied while preserving the intended contract).
- `InventoryApplyModal`: floor-grouped room multi-select + select-all + mode radios; "Thay toàn bộ" routes through `UiConfirmModal`; emits `apply` with `InventoryApplyInput`, parent toasts the result.
- Building create page now embeds `RoomBatchGenerator` behind the existing "Bật tạo phòng nhanh" toggle; new `buildings/[id]/rooms/batch.vue` adds the "Áp dụng nội thất mẫu (N món)" checkbox (disabled + settings link when the template is empty).
- Settings gains a "Nội thất mẫu" section (`#inventory-template`) with the editor + "Áp dụng cho phòng…" modal. Room detail gains a "Nội thất" section with "Áp dụng mẫu tòa". `ContractForm` gains a "Nội thất bàn giao" section prefilled from the room on room change. Contract detail gains a "Bàn giao" section (`#handover`) and checkout a collapsible "Nội thất đã bàn giao" reference, both via `ContractHandoverSection`.

## Delta from plan (important)

- **Task 3 composable extension was missing from the backend pass.** The backend worker shipped the pure `generateRoomNumbers` util + its test but left `useQuickRoomPreview` on the PR0 API. This fork completed the Task 3 composable extension (floor `generator`, `generatorError`, `existingRoomNumbers`, `removeRow`/`addRow`, `existing`/`manual` row flags, `toPayload` excluding existing rows) and rewrote `tests/composables/useQuickRoomPreview.test.ts` to the new API, since Tasks 8–10 depend on it.
- Fixed a `TS7022` self-referential-inference error in `server/repositories/contracts/index.ts` `findHandoverInventory` (introduced with Task 7) by casting the fetched row explicitly.
- `ContractFormData.inventory` is optional (`inventory?`) to avoid forcing the field on every existing `ContractFormData` constructor (edit page, drafts). `create.vue` initializes it to `[]` and sends `inventory: data.inventory`.
- Added Vietnamese audit labels for the new inventory actions in `app/utils/audit/display.ts` (the backend pass added the action constants but not the labels, which failed `audit-display.test.ts`).

## Local (source) — run on Node 22 (2026-11-12)

- [x] `npm run typecheck` — pass (Supabase env warnings only).
- [x] `npm test` — **2576/2576 pass** (420 files).
- [x] `npm run lint` — 0 errors (1 pre-existing `vue/no-v-html` warning, unrelated).
- [x] `npm run knowledge:check` — OK (331 concepts, 26 index files).

Re-verified independently by the parent on Node 22 (2026-11-12): typecheck 0, **2576/2576 tests**, lint 0 errors, knowledge OK. `audit/display.ts` has a single `building.contract_profile.updated` label (no duplicate key).

## Batch-page entry points (done 2026-11-12)

- Building detail header: "Thêm phòng" button → `…/rooms/batch`, gated on `rooms.create`.
- Rooms list header dropdown: "Thêm phòng hàng loạt" item → the filtered building's `…/rooms/batch`, shown only when a building filter is active (`rooms.create && buildingId`).
- Source test `tests/pages/rooms-batch-entry-points.spec.ts`. Full suite after: 2578/2578; typecheck 0; lint 0 errors.

## Visual QA — run by maintainer

- [x] Batch page with a multi-floor generator and the template toggle: 4 rooms created with 4 inventory items each; replay returns 200 `replayed`, existing code returns 409, duplicate in payload returns 422 (2026-11-15)
- [x] Manager can apply the template but cannot edit it or create rooms (403); manager account since deleted
- [x] Room detail inventory renders and applies the template; contract create prefills inventory from the room; contract detail "Bàn giao" renders; 390px mobile has no overflow. Hydration mismatch on room detail fixed (client-only editor)

## Cloud gates (order matters)

- [x] Migration `20261111110000_inventory_lite.sql` applied — production, 2026-11-15
- [x] `supabase/verification/inventory_lite.sql` passed — production, 2026-11-15
- [x] `apply_inventory_template` merge/replace and batch replay checked end to end through the API (merge twice adds 0 the second time; replace re-adds 4; empty room list returns 422)
- [x] Grants: anon/auth = false, service_role = true
- [x] Types regenerated; `as never` casts removed — see commit history on `feat/v2-pr0-pr4b`

## 2026-11-16 stabilization addendum (not a new production verification)

- PR #26 added `20261116100000_inventory_lite_functions_hardening.sql` to restore stricter function definitions in timestamp order; its PR explicitly reported **not applied to cloud** at merge. New migration-order source regression tests are in the stabilization branch; verify the target catalog and privilege grants before deployment.
- The stabilization branch changes `InventoryRepository.replaceTemplate` and `replaceRoom` from two independent DELETE/INSERT calls to the already-existing atomic `replace_inventory_template` and `replace_room_inventory` RPCs; repository regression tests cover empty clear and failure cases. This is source work awaiting review/CI, not a live SQL pass.
- The separate pre-issuance contract handover inventory replacement still uses delete/insert in the repository and needs its own atomic implementation and post-DOCX-lock tests.
- [Baseline checkpoint](../zeno-house-v2-optimization/baseline-2026-11-16.md).
