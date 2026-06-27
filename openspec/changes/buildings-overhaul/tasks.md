## 1. Validators & types

- [ ] 1.1 Add `buildingListQuerySchema` (page, limit, q, status[], sort, order, defaults) and inferred type `BuildingListQuery` in `app/utils/validators/buildings.ts`
- [ ] 1.2 Add `buildingBulkActionSchema` (action enum, ids min 1) and inferred type `BuildingBulkActionInput` in the same file
- [ ] 1.3 Confirm `BuildingStatus` already covers `'active' | 'inactive'`; otherwise extend in `app/types/buildings.ts`

## 2. Repository layer

- [ ] 2.1 Extend `BuildingRepository.findAll` to accept `{ q?, status?, sort?, order? }` and build query (`.or` ilike on name/address/code, `.in` on status, `.order` by sort field, default to `created_at desc`)
- [ ] 2.2 Add `countRoomsForBuilding(buildingId)` returning `number`
- [ ] 2.3 Add `countActiveContractsForBuilding(buildingId)` joining contracts to rooms
- [ ] 2.4 Add `softArchive(buildingId)` that sets `status='inactive'` and returns mapped DTO
- [ ] 2.5 Keep service summary batch-load behaviour intact after sort change

## 3. Service layer

- [ ] 3.1 Update `BuildingService.list` to forward new filter/sort options to repository, re-check `buildings.read`
- [ ] 3.2 Update `BuildingService.remove(event, user, id, { force })`: when `!force`, count rooms + active contracts; if either > 0 throw `CONFLICT` with `{ rooms, activeContracts }`; when `force=true`, call `softArchive`
- [ ] 3.3 Add `BuildingService.bulkAction(event, user, { action, ids })` iterating per id, catching errors, returning `{ succeeded, failed: [{ id, reason }] }`; permission re-check upfront

## 4. Server API endpoints

- [ ] 4.1 Update `server/api/buildings/index.get.ts` to validate query with `buildingListQuerySchema`, pass options to service, keep envelope
- [ ] 4.2 Update `server/api/buildings/[id].delete.ts`: read `?force` from query, call service with options; map `CONFLICT` error to 409 response with `details`
- [ ] 4.3 When `?force=true`, change response to 200 + `{ data }` containing soft-archived building
- [ ] 4.4 Create `server/api/buildings/bulk.post.ts`: auth guard, validate body, call service, return 200 with `{ data: { succeeded, failed } }`

## 5. Server tests

- [ ] 5.1 Add `tests/server/buildings.api.test.ts` with auth/permission scaffolding using existing supabase mocks
- [ ] 5.2 Cover GET list: pagination defaults, search by name, multi-status filter, sort by name/total_rooms, invalid sort 422
- [ ] 5.3 Cover POST create: success 201, validation error 422, manager forbidden 403
- [ ] 5.4 Cover GET detail: by id, by slug, not found 404
- [ ] 5.5 Cover PATCH: success 200, manager forbidden, validation error
- [ ] 5.6 Cover DELETE: success 204 when empty, 409 with details when rooms exist, 409 when active contracts exist, force=true returns 200 with inactive building, manager forbidden on force
- [ ] 5.7 Cover POST bulk: archive succeeded, delete mixed result with reasons, activate, manager forbidden, empty ids 422

## 6. Composables

- [ ] 6.1 Extend `useBuildingList` with refs `q`, `status`, `sort`, `order`; two-way sync with `useRoute().query`; reset `page=1` on filter change; ensure `useFetch` watches all refs
- [ ] 6.2 Extend `useBuildingForm`: add `isDirty` computed comparing snapshot vs current; add `hasDraft`, `restoreDraft()`, `clearDraft()`; integrate `localStorage` persistence with `useDebounceFn(500)`; clear on submit success
- [ ] 6.3 Create `app/composables/buildings/useBuildingBulkActions.ts` with `selectedIds`, `isSelected`, `toggle`, `selectAll`, `clear`, `runAction`
- [ ] 6.4 Composable tests: `useBuildingForm` (dirty + draft restore + clear), `useBuildingBulkActions` (toggle/selectAll/clear/runAction shape)

## 7. UI components — new

- [ ] 7.1 Create `app/components/buildings/BuildingListToolbar.vue`: search input (debounced via composable), status filter chips, sort dropdown, order toggle; emits update events or uses `v-model:q`, `v-model:status`, `v-model:sort`, `v-model:order`
- [ ] 7.2 Create `app/components/buildings/BuildingBulkActionsBar.vue`: shows selected count, action buttons (archive, activate, delete) with confirm modals; uses `useBuildingBulkActions`; emits `done` after action
- [ ] 7.3 Create `app/components/buildings/BuildingDetailHero.vue`: hero header with name, code, status pill, address, 3 quick stat tiles (rooms/occupied/services) — props-driven
- [ ] 7.4 Component tests: `BuildingListToolbar` (debounce, chip toggle, sort change emits), `BuildingBulkActionsBar` (count display, confirm flow), `BuildingDetailHero` (stat tiles render)

## 8. UI components — update existing

- [ ] 8.1 Refactor `app/components/buildings/BuildingForm.vue` to render 4 numbered sections (border-t separators, badge + title + description) without changing field set
- [ ] 8.2 Add inline blur validation + error summary banner at top with click-to-focus behaviour
- [ ] 8.3 Add mobile-only sticky save bar (`md:hidden fixed bottom-0`) with safe-area-inset padding; keep desktop footer
- [ ] 8.4 Wire dirty-state guard helper into `BuildingForm` (or export from composable) and integrate with `onBeforeRouteLeave` + `beforeunload` in create/edit pages
- [ ] 8.5 Add draft restore alert at top of `BuildingForm` (when `hasDraft`) with restore/dismiss/delete actions
- [ ] 8.6 Update `BuildingCard.vue` to optionally render a checkbox in selection mode (props `selectable`, `selected`, emits `toggle-select`); preserve existing layout when not selectable
- [ ] 8.7 Component tests: `BuildingForm` (sections render, inline validation, draft banner, sticky save bar visibility), `BuildingCard` (selectable mode)

## 9. Pages

- [ ] 9.1 Refactor `app/pages/buildings/index.vue`: mount `BuildingListToolbar`, switch grid to selection-mode cards (admin), mount `BuildingBulkActionsBar` when selection > 0, polish empty/error states (filtered-empty vs no-data, retry button)
- [ ] 9.2 Refactor `app/pages/buildings/[id]/index.vue`: replace card stack with `BuildingDetailHero` + sectioned layout (`#overview`, `#services`, `#operations`, `#danger-zone`); include operations shortcuts (rooms, contracts, meter readings); hide danger zone for managers
- [ ] 9.3 Update `app/pages/buildings/create.vue` to use updated `BuildingForm` with dirty-guard and draft autosave
- [ ] 9.4 Update `app/pages/buildings/[id]/edit.vue` same as create, draft key includes `id`
- [ ] 9.5 Handle 409 CONFLICT from DELETE in detail page (show alert with rooms/contracts counts and offer "Lưu trữ thay vì xoá" button calling DELETE with `?force=true`)

## 10. Polish & verification

- [ ] 10.1 Run `pnpm typecheck` (or project equivalent) and fix any new type errors
- [ ] 10.2 Run `pnpm lint` and fix issues
- [ ] 10.3 Run `pnpm test` — all new + existing tests pass
- [ ] 10.4 Manually verify on dev server: search/filter/sort/bulk on list, hero stats on detail, sticky save + dirty guard + draft on form, 409 conflict path
- [ ] 10.5 Update `docs/features/property-operations.md` (if exists) or add short note about buildings overhaul behaviour changes
- [ ] 10.6 Run `openspec validate buildings-overhaul --strict` and resolve any errors before archive
