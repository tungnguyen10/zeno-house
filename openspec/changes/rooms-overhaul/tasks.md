## 1. Validators & types

- [x] 1.1 Add `roomListQuerySchema` (page, limit, q, building_id, floor, status[], sort, order, defaults) and inferred type `RoomListQuery` in `app/utils/validators/rooms.ts`
- [x] 1.2 Add `roomBulkActionSchema` (action enum: `archive | activate | set_maintenance | delete`, ids min 1) and inferred type `RoomBulkActionInput` in the same file
- [x] 1.3 Extend `RoomStatus` type to include `'archived'` in `app/types/rooms.ts`

## 2. Database migration

- [x] 2.1 Create `supabase/migrations/<ts>_rooms_add_archived_status.sql` that drops the existing `rooms_status_check` constraint and re-adds it with `('available','occupied','maintenance','archived')`
- [ ] 2.2 Run `supabase db reset` (local) and `pnpm gen:types` to refresh `app/types/database.types.ts`

## 3. Repository layer

- [x] 3.1 Extend `RoomRepository.findAll` to accept `{ q?, status?, sort?, order? }`; build `.or` ilike on `room_number`/`code`/`description`, `.in` on status, default exclude `status='archived'` when status is undefined, `.order` by sort field with secondary tie-break
- [x] 3.2 Add `countActiveContractsForRoom(roomId)` returning `number`
- [x] 3.3 Add `countMeterReadingsForRoom(roomId)` returning `number` (early-exit via `EXISTS`/`LIMIT 1` if performance matters)
- [x] 3.4 Add `softArchive(roomId)` setting `status='archived'` and returning the mapped DTO

## 4. Service layer

- [x] 4.1 Update `RoomService.list` to forward new filter/sort options to repository; re-check `rooms.read`
- [x] 4.2 Update `RoomService.remove(event, user, id, { force })`: when `!force`, count active contracts + meter readings; if either > 0 throw `CONFLICT` with `{ activeContracts, meterReadings }`; when `force=true`, call `softArchive`
- [x] 4.3 Add `RoomService.bulkAction(event, user, { action, ids })` iterating per id, catching errors, returning `{ succeeded, failed: [{ id, reason }] }`; permission re-check upfront

## 5. Server API endpoints

- [x] 5.1 Update `server/api/rooms/index.get.ts` to validate query with `roomListQuerySchema`, pass options to service, keep envelope
- [x] 5.2 Update `server/api/rooms/[id].delete.ts`: read `?force` from query, call service with options; map `CONFLICT` error to 409 response with `details`
- [x] 5.3 When `?force=true`, change response to 200 + `{ data }` containing soft-archived room
- [x] 5.4 Create `server/api/rooms/bulk.post.ts`: auth guard (admin), validate body, call service, return 200 with `{ data: { succeeded, failed } }`

## 6. Server tests

- [x] 6.1 Add `tests/server/rooms.api.test.ts` with auth/permission scaffolding using existing supabase mocks
- [x] 6.2 Cover GET list: pagination defaults, search, multi-status filter, default-excludes-archived, sort by room_number/monthly_rent, invalid sort 422
- [x] 6.3 Cover POST create: success 201, validation error 422, manager forbidden 403
- [x] 6.4 Cover GET detail: by id, by building+room slug, not found 404
- [x] 6.5 Cover PATCH: success 200, manager forbidden, validation error
- [x] 6.6 Cover DELETE: success 204 when empty, 409 when active contracts exist, 409 when meter readings exist, force=true returns 200 with archived room, manager forbidden on force
- [x] 6.7 Cover POST bulk: archive succeeded, set_maintenance, activate, delete mixed result with reasons, manager forbidden, empty ids 422

## 7. Composables

- [x] 7.1 Extend `useRoomList` with refs `q`, `status`, `sort`, `order`; two-way sync with `useRoute().query`; reset `page=1` on filter change; ensure `useFetch` watches all refs
- [x] 7.2 Extend `useRoomForm`: add `isDirty` computed comparing snapshot vs current; add `hasDraft`, `restoreDraft()`, `clearDraft()`; integrate `localStorage` persistence with `useDebounceFn(500)`; clear on submit success
- [x] 7.3 Create `app/composables/rooms/useRoomBulkActions.ts` with `selectedIds`, `isSelected`, `toggle`, `selectAll`, `clear`, `runAction`
- [x] 7.4 Composable tests: `useRoomForm` (dirty + draft restore + clear), `useRoomBulkActions` (toggle/selectAll/clear/runAction shape)

## 8. UI components — new

- [x] 8.1 Create `app/components/rooms/RoomListToolbar.vue`: search input (debounced via composable), status filter chips, building selector, floor filter, sort dropdown, order toggle; uses `v-model:q`, `v-model:status`, `v-model:sort`, `v-model:order`
- [x] 8.2 Create `app/components/rooms/RoomBulkActionsBar.vue`: shows selected count, action buttons (archive, activate, set_maintenance, delete) with confirm modals; uses `useRoomBulkActions`; emits `done` after action
- [x] 8.3 Create `app/components/rooms/RoomDetailHero.vue`: hero header with room name + code + status pill + 3 quick stat tiles (active contract / occupants / meter devices) — props-driven
- [x] 8.4 Component tests: `RoomListToolbar` (debounce, chip toggle, sort change emits), `RoomBulkActionsBar` (count display, confirm flow), `RoomDetailHero` (stat tiles render)

## 9. UI components — update existing

- [x] 9.1 Refactor `app/components/rooms/RoomForm.vue` to render 4 numbered sections (border-t separators, badge + title + description) without changing field set
- [x] 9.2 Add inline blur validation + error summary banner at top with click-to-focus behaviour
- [x] 9.3 Add mobile-only sticky save bar (`md:hidden fixed bottom-0`) with safe-area-inset padding; keep desktop footer
- [x] 9.4 Wire dirty-state guard helper into `RoomForm` (or export from composable) and integrate with `onBeforeRouteLeave` + `beforeunload` in create/edit pages
- [x] 9.5 Add draft restore alert at top of `RoomForm` (when `hasDraft`) with restore/dismiss/delete actions
- [x] 9.6 Update `RoomCard.vue` to optionally render a checkbox in selection mode (props `selectable`, `selected`, emits `toggle-select`); preserve existing layout when not selectable
- [x] 9.7 Component tests: `RoomForm` (sections render, inline validation, draft banner, sticky save bar visibility), `RoomCard` (selectable mode)

## 10. Pages

- [x] 10.1 Refactor `app/pages/rooms/index.vue`: mount `RoomListToolbar`, switch grid to selection-mode cards (admin), mount `RoomBulkActionsBar` when selection > 0, polish empty/error states (filtered-empty vs no-data, retry button)
- [x] 10.2 Refactor `app/pages/rooms/[code]/index.vue`: replace flat card stack with `RoomDetailHero` + sectioned layout (`#overview`, `#active-contract`, `#meter-readings`, `#contracts-history`, `#danger-zone`); hide danger zone for managers
- [x] 10.3 Update `app/pages/rooms/create.vue` to use updated `RoomForm` with dirty-guard and draft autosave
- [x] 10.4 Update `app/pages/rooms/[code]/edit.vue` same as create, draft key includes room id
- [x] 10.5 Handle 409 CONFLICT from DELETE in detail page (show alert with activeContracts/meterReadings counts and offer "Lưu trữ thay vì xoá" button calling DELETE with `?force=true`)

## 11. Polish & verification

- [x] 11.1 Run `pnpm typecheck` and fix any new type errors
- [x] 11.2 Run `pnpm lint` and fix issues
- [x] 11.3 Run `pnpm test` — all new + existing tests pass
- [ ] 11.4 Manually verify on dev server: search/filter/sort/bulk on list, hero stats on detail, sticky save + dirty guard + draft on form, 409 conflict path
- [x] 11.5 Update `docs/features/property-operations.md` (or add short note) about rooms overhaul behaviour changes
- [x] 11.6 Run `openspec validate rooms-overhaul --strict` and resolve any errors before archive
