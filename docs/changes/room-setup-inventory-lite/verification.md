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

- [ ] Create building multi-floor generator; batch page with existing rooms + template toggle.
- [ ] Settings template edit + apply (merge / replace confirm); manager read-only but can apply.
- [ ] Room detail inventory edit + apply template; contract create prefill; contract detail "Bàn giao" (renewed contract source note); checkout reference; mobile.

## Cloud gates (order matters)

- [ ] Migration `20261111110000_inventory_lite.sql` applied — <env, date>
- [ ] `supabase/verification/inventory_lite.sql` passed — <output>
- [ ] `apply_inventory_template` cross-building guard + merge/replace + batch replay + wrapper rollback checks — <output>
- [ ] Grants: anon/auth = false, service_role = true — <output>
- [ ] Types regenerated; `as never` casts removed from inventory repo + handover query — <commit>
