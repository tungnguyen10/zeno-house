---
type: Verification Record
title: "atomic-building-room-setup — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, buildings, rooms]
---

# Atomic Building + Room setup — verification

## Implementation summary

Tasks 1–8 of [implementation-plan.md](./implementation-plan.md) are implemented TDD-first
(test added, then code). Per the agreed 2026-11-11 roadmap, this run writes code only;
`git` commit/branch/PR steps and the cloud gate are performed by the maintainer. Local
test execution is deferred to a Node 20+ environment (the current workspace has no
`node_modules` and runs Node 18, below the Nuxt 4 / Vitest 4 / ESLint 10 minimums).

### Files added

- `supabase/migrations/20261111090000_create_building_with_rooms.sql`
- `supabase/verification/create_building_with_rooms.sql`
- `app/composables/buildings/useQuickRoomPreview.ts`
- `tests/utils/building-create-with-rooms-validator.test.ts`
- `tests/config/create-building-with-rooms-migration.test.ts`
- `tests/server/buildings/create-with-rooms-repository.test.ts`
- `tests/composables/useQuickRoomPreview.test.ts`
- `tests/pages/buildings-create-quick-rooms.spec.ts`

### Files modified

- `app/utils/validators/buildings.ts` — `quickRoomSchema`, `buildingCreateWithRoomsSchema`, `QUICK_ROOM_MAX`.
- `server/repositories/buildings/index.ts` — `buildInsertPayload` extraction, `createWithRooms`, `throwBuildingSetupError`, slug-collision retry.
- `server/services/buildings/index.ts` — atomic `create` returning `{ building, roomCount }`; audit of building/assignment/rooms; replay skip; removed compensating-delete + `AssignmentRepository` import.
- `server/api/buildings/index.post.ts` — validates `buildingCreateWithRoomsSchema`, returns `201 { data, meta: { room_count } }`.
- `app/composables/buildings/useBuildingForm.ts` — single idempotent request with stable `request_id`, `duplicateRoomNumbers` from 409, nothing-saved message.
- `app/pages/dashboard/buildings/create.vue` — `useQuickRoomPreview`, editable floor/rent/area cells, default floor, `QUICK_ROOM_MAX`, duplicate highlight.
- `tests/server/buildings/owner-service.test.ts`, `tests/server/buildings.api.test.ts`, `tests/composables/buildings.test.ts` — updated for the atomic path.

## Local (source) — full run on Node 22 (2026-11-15)

- [x] `npm run typecheck` — pass
- [x] `npx vitest run` — 2806 tests in 462 files pass (includes all PR0 suites)
- [x] `npm run lint` — 0 errors (1 unrelated `vue/no-v-html` warning)
- [x] `npm run knowledge:check` — OK (337 concepts)

## UI decisions (Task 8)

- Reused existing primitives only: `UiFormSection`, `UiCheckbox`, `UiInput` (`density="compact"`, `number-mode`, `hint`), `UiTable` + `#cell-*` slots, `UiAlert` (`severity`). No new tokens/primitives.
- Duplicate rooms (local + server) are surfaced two ways: a `warning` `UiAlert` listing the codes and a `text-ui-danger` highlight on the offending room code. Submit is blocked while local duplicates exist.
- Per-room `floor`/`rent`/`area` are editable inline; `rent` becomes read-only text when "Đồng giá cho tất cả phòng" is on. Table wrapped in `overflow-x-auto` for mobile.
- Note: `UiButton` has no `xs` size (only `sm|md|lg`); no per-cell reset button was added to avoid a new size — manual edits are revertible by changing the default inputs.

## Visual QA — run by maintainer

- [x] Batch generator on the building rooms batch page (same preview composable): floors 3–4 × 2 rooms, floor number in the code, default rent applied; hydration mismatch between server and client fixed (2026-11-15)
- [x] Building create page renders without hydration warnings; 390px mobile has no horizontal overflow
- [ ] Create a building with 30 rooms from the create page; local duplicate, generic error and server duplicate highlight — covered by component tests only

## Cloud gates (separate; not implied by local tests)

- [x] Migration `20261111090000_create_building_with_rooms.sql` applied — production, 2026-11-15
- [x] `supabase/verification/create_building_with_rooms.sql` passed — production, 2026-11-15 (rolled back)
- [ ] Concurrency check (two sessions) — not run
- [x] Grants: anon/auth = false, service_role = true — checked in the verification script
- [x] `app/types/database.types.ts` regenerated — see commit history on `feat/v2-pr0-pr4b`
- [ ] Deployed app smoke: create building with 30 rooms; retry after forced network error lands on same building (no duplicate) — pending deploy
