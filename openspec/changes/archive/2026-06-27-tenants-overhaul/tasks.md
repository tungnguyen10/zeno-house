## 1. Validators & types

- [x] 1.1 Add `tenantListQuerySchema` (page, limit, q, building_id, contract_state, status[], sort, order, available, excludeContractId, defaults) and inferred type `TenantListQuery` in `app/utils/validators/tenants.ts`
- [x] 1.2 Add `tenantBulkActionSchema` (action enum: `archive | activate | delete`, ids min 1) and inferred type `TenantBulkActionInput` in the same file
- [x] 1.3 Add `TenantStatus = 'active' | 'archived'` and `status: TenantStatus` field to `Tenant` interface in `app/types/tenants.ts`

## 2. Database migration

- [x] 2.1 Create `supabase/migrations/<ts>_tenants_add_status.sql` that adds `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))` to `tenants` table
- [x] 2.2 Run `supabase db reset` (local) and `pnpm gen:types` to refresh `app/types/database.types.ts`
- [x] 2.3 Update `app/utils/mappers/tenants.ts` to include `status` in the DB-row → DTO mapping

## 3. Repository layer

- [x] 3.1 Extend `TenantRepository.findAll` to accept `{ status?, sort?, order? }` in addition to existing filters; build `.or` ilike on `full_name`/`phone`/`email`/`id_number`/`code`, `.in` on status, default exclude `status='archived'` when undefined, `.order` by sort field
- [x] 3.2 Add `countActiveContractsForTenant(tenantId)` returning `number`
- [x] 3.3 Add `countActiveOccupanciesForTenant(tenantId)` returning `number` (rows in `contract_occupants` with `move_out_date IS NULL`)
- [x] 3.4 Add `softArchive(tenantId)` setting `status='archived'` and returning the mapped DTO

## 4. Service layer

- [x] 4.1 Update `TenantService.list` to forward new filter/sort options to repository; re-check `tenants.read`
- [x] 4.2 Update `TenantService.remove(event, user, id, { force })`: when `!force`, count active contracts + active occupancies; if either > 0 throw `CONFLICT` with `{ activeContracts, activeOccupancies }`; when `force=true`, call `softArchive`
- [x] 4.3 Add `TenantService.bulkAction(event, user, { action, ids })` iterating per id, catching errors, returning `{ succeeded, failed: [{ id, reason }] }`; permission re-check upfront

## 5. Server API endpoints

- [x] 5.1 Update `server/api/tenants/index.get.ts` to validate query with `tenantListQuerySchema`, pass options to service, keep envelope
- [x] 5.2 Update `server/api/tenants/[id].delete.ts`: read `?force` from query, call service with options; map `CONFLICT` error to 409 response with `details`
- [x] 5.3 When `?force=true`, change response to 200 + `{ data }` containing soft-archived tenant
- [x] 5.4 Create `server/api/tenants/bulk.post.ts`: auth guard (admin), validate body, call service, return 200 with `{ data: { succeeded, failed } }`

## 6. Server tests

- [x] 6.1 Add `tests/server/tenants.api.test.ts` with auth/permission scaffolding using existing supabase mocks
- [x] 6.2 Cover GET list: pagination defaults, search across multiple fields, building filter, contract-state filter, multi-status filter, default-excludes-archived, sort by full_name/created_at, invalid sort 422
- [x] 6.3 Cover POST create: success 201, validation error 422, manager forbidden 403, duplicate id_number 409
- [x] 6.4 Cover GET detail: by id, by code, not found 404
- [x] 6.5 Cover PATCH: success 200, manager forbidden, validation error
- [x] 6.6 Cover DELETE: success 204 when no history, 409 when active contracts exist, 409 when active occupancies exist, force=true returns 200 with archived tenant, manager forbidden on force
- [x] 6.7 Cover POST bulk: archive succeeded, activate, delete mixed result with reasons, manager forbidden, empty ids 422
- [x] 6.8 Extend existing `tests/server/tenants/repository.test.ts` stub to cover `softArchive`, count helpers, search/sort

## 7. Composables

- [x] 7.1 Extend `useTenantList` with refs `q`, `status`, `sort`, `order`; two-way sync with `useRoute().query`; reset `page=1` on filter change; ensure `useFetch` watches all refs
- [x] 7.2 Extend `useTenantForm`: add `isDirty` computed; `hasDraft`, `restoreDraft()`, `clearDraft()`; integrate `localStorage` persistence with `useDebounceFn(500)`; clear on submit success
- [x] 7.3 Create `app/composables/tenants/useTenantBulkActions.ts` with `selectedIds`, `isSelected`, `toggle`, `selectAll`, `clear`, `runAction`
- [x] 7.4 Composable tests: `useTenantForm` (dirty + draft restore + clear), `useTenantBulkActions` (toggle/selectAll/clear/runAction shape)

## 8. UI components — new

- [x] 8.1 Create `app/components/tenants/TenantListToolbar.vue`: search input (debounced), status filter chips, building selector, contract-state selector, sort dropdown, order toggle
- [x] 8.2 Create `app/components/tenants/TenantBulkActionsBar.vue`: shows selected count, action buttons (archive, activate, delete) with confirm modals; uses `useTenantBulkActions`; emits `done` after action
- [x] 8.3 Create `app/components/tenants/TenantDetailHero.vue`: hero header with full_name + code + status pill + phone/email chips + 3 quick stat tiles (active contracts / current room / occupancy count) — props-driven
- [x] 8.4 Component tests: `TenantListToolbar` (debounce, chip toggle, sort change emits), `TenantBulkActionsBar` (count display, confirm flow), `TenantDetailHero` (stat tiles render)

## 9. UI components — update existing

- [x] 9.1 Refactor `app/components/tenants/TenantForm.vue` to render 4 numbered sections (Personal / ID document / Emergency contact / Notes)
- [x] 9.2 Add inline blur validation + error summary banner at top with click-to-focus behaviour
- [x] 9.3 Add mobile-only sticky save bar (`md:hidden fixed bottom-0`) with safe-area-inset padding; keep desktop footer
- [x] 9.4 Wire dirty-state guard into `TenantForm` and integrate with `onBeforeRouteLeave` + `beforeunload` in create/edit pages
- [x] 9.5 Add draft restore alert at top of `TenantForm` with restore/dismiss/delete actions
- [x] 9.6 Add row selection mode to the existing `UiListRow` usage in list page (or extract `TenantListRow` if cleaner) — checkbox visible only for admin
- [x] 9.7 Component tests: `TenantForm` (sections render, inline validation, draft banner, sticky save bar visibility)

## 10. Pages

- [x] 10.1 Refactor `app/pages/tenants/index.vue`: mount `TenantListToolbar`, switch rows to selection mode (admin), mount `TenantBulkActionsBar` when selection > 0, polish empty/error states (filtered-empty vs no-data, retry button)
- [x] 10.2 Refactor `app/pages/tenants/[code]/index.vue`: replace flat sections with `TenantDetailHero` + sectioned layout (`#personal`, `#id-document`, `#emergency`, `#contracts`, `#danger-zone`); hide danger zone for managers
- [x] 10.3 Update `app/pages/tenants/create.vue` to use updated `TenantForm` with dirty-guard and draft autosave
- [x] 10.4 Create `app/pages/tenants/[code]/edit.vue` (new route) using `TenantForm` with `submitUpdate`, dirty-guard, draft autosave (`tenant-form:edit:<id>`)
- [x] 10.5 Handle 409 CONFLICT from DELETE in detail page (show alert with activeContracts/activeOccupancies counts and offer "Lưu trữ thay vì xoá" button calling DELETE with `?force=true`)

## 11. Polish & verification

- [x] 11.1 Run `pnpm typecheck` and fix any new type errors
- [x] 11.2 Run `pnpm lint` and fix issues
- [x] 11.3 Run `pnpm test` — all new + existing tests pass
- [x] 11.4 Manually verify on dev server: search/filter/sort/bulk on list, hero stats on detail, sticky save + dirty guard + draft on form, 409 conflict path, new edit route
- [x] 11.5 Update `docs/features/property-operations.md` (or relevant docs) about tenants overhaul behaviour changes
- [x] 11.6 Run `openspec validate tenants-overhaul --strict` and resolve any errors before archive
