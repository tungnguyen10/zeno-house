## 1. Validators & types

- [x] 1.1 Add `contractListQuerySchema` (page, limit, q, building_id, room_id, tenant_id, status[], sort, order, defaults) and inferred type `ContractListQuery` in `app/utils/validators/contracts.ts`
- [ ] 1.2 Add `contractBulkActionSchema` (action enum: `terminate | delete`, ids min 1, reason optional) and inferred type `ContractBulkActionInput` in the same file
- [x] 1.3 Confirm `ContractStatus` covers `'active' | 'expired' | 'terminated' | 'renewed'` in `app/types/contracts.ts`; no DB change

## 2. Repository layer

- [x] 2.1 Extend `ContractRepository.findAll` to accept `{ q?, status?, sort?, order? }`; build `.or` ilike on `contract_code` + foreign-table on `tenants.full_name` / `rooms.room_number`, `.in` on status, `.order` by sort field
- [ ] 2.2 Add `countBillingPeriodsForContract(contractId)` returning `number`
- [ ] 2.3 Add `countPaidInvoicesForContract(contractId)` returning `number` (status `paid` or `partial`)
- [ ] 2.4 Add `countNonHandoverMeterReadingsForContract(contractId)` returning `number` (type not `handover_in`/`handover_out`)

## 3. Service layer

- [x] 3.1 Update `ContractService.list` to forward new filter/sort options to repository; re-check `contracts.read`
- [ ] 3.2 Update `ContractService.remove(event, user, id, { force })` to enforce conflict matrix: active status (#1), billing periods (#2), paid invoices (#3), non-handover meter readings (#4); aggregate violations into single CONFLICT details object
- [ ] 3.3 When `force=true`, terminate first if active, then re-check #2/#3/#4 (still hard-block on history) before cascade-deleting sub-resources + contract row
- [ ] 3.4 Add `ContractService.bulkAction(event, user, { action, ids, reason? })` iterating per id, catching errors, returning `{ succeeded, failed: [{ id, reason }] }`; permission re-check upfront. `terminate` reuses existing terminate logic per id.

## 4. Server API endpoints

- [x] 4.1 Update `server/api/contracts/index.get.ts` to validate query with `contractListQuerySchema`, pass options to service, keep envelope
- [ ] 4.2 Update `server/api/contracts/[id].delete.ts`: read `?force` from query, call service with options; map `CONFLICT` error to 409 response with aggregated `details`
- [ ] 4.3 When `?force=true` and history checks pass, response is 200 + `{ data }` containing the terminated/deleted contract DTO
- [ ] 4.4 Create `server/api/contracts/bulk.post.ts`: auth guard (admin), validate body, call service, return 200 with `{ data: { succeeded, failed } }`

## 5. Server tests

- [ ] 5.1 Add `tests/server/contracts.api.test.ts` with auth/permission scaffolding and supabase mocks
- [ ] 5.2 Cover GET list: pagination defaults, search across code/tenant/room, multi-status filter, sort by start_date/monthly_rent, invalid sort 422
- [ ] 5.3 Cover POST create: success 201 with handover, validation error 422, conflict on room occupied 409, manager forbidden 403
- [ ] 5.4 Cover GET detail: by id, by code, not found 404
- [ ] 5.5 Cover PATCH: success 200 (status transitions), invalid transition rejected, manager forbidden
- [ ] 5.6 Cover DELETE conflict matrix (parametrized): active contract → 409 ACTIVE_CONTRACT, terminated with billing periods → 409 issuedBillingPeriods, terminated with paid invoices → 409 paidPayments, terminated with monthly meter readings → 409 nonHandoverMeterReadings, aggregated multi-violation → 409 combined details, all clean → 204
- [ ] 5.7 Cover DELETE force=true: terminates active then deletes when clean (200), still blocked by billing (409), manager forbidden 403
- [ ] 5.8 Cover POST bulk: terminate succeeded, delete mixed result with reasons, manager forbidden, empty ids 422, invalid action 422

## 6. Composables

- [x] 6.1 Extend `useContractList` with refs `q`, `status`, `sort`, `order`, `roomFilter`, `tenantFilter`; two-way sync with `useRoute().query`; reset `page=1` on filter change
- [ ] 6.2 Extend `useContractForm`: add `isDirty` computed; `hasDraft`, `restoreDraft()`, `clearDraft()`; integrate `localStorage` persistence with `useDebounceFn(500)`; clear on submit success; draft payload includes `draftVersion` + wizard state (currentStep, pendingOccupants, selectedServices) for create form
- [ ] 6.3 Create `app/composables/contracts/useContractBulkActions.ts` with `selectedIds`, `isSelected`, `toggle`, `selectAll`, `clear`, `runAction(action, opts?)` calling `POST /api/contracts/bulk`
- [ ] 6.4 Composable tests: `useContractForm` (dirty + draft restore + version mismatch + clear + wizard restore), `useContractBulkActions` (toggle/selectAll/clear/runAction shape)

## 7. UI components — new

- [x] 7.1 Create `app/components/contracts/ContractListToolbar.vue`: search input (debounced), status filter chips, building selector, sort dropdown, order toggle
- [ ] 7.2 Create `app/components/contracts/ContractBulkActionsBar.vue`: shows selected count, action buttons (terminate with reason input modal, delete with strong opt-in modal); uses `useContractBulkActions`; emits `done` after action
- [ ] 7.3 Create `app/components/contracts/ContractDetailHero.vue`: hero header with code + status pill + breadcrumb (building → room → tenant) + 4 quick stat tiles (tenant link / room link / months elapsed / paid + deposit) + action buttons (Gia hạn / Kết thúc sớm) when active
- [ ] 7.4 Create `app/components/contracts/ContractWizardSteps.vue`: 3-step progress indicator (Hợp đồng / Khách ở cùng / Dịch vụ) with check marks for completed steps and highlight for current; emits `change` when user clicks a completed step
- [ ] 7.5 Component tests: `ContractListToolbar` (debounce, chip toggle, sort change emits), `ContractBulkActionsBar` (count display, confirm flow), `ContractDetailHero` (stat tiles render, action buttons conditional on status), `ContractWizardSteps` (current highlight, completed check, forward blocked when invalid)

## 8. UI components — update existing

- [ ] 8.1 Refactor `app/components/contracts/ContractForm.vue` to render 4 numbered sections in edit mode (Quan hệ / Thời hạn & Giá / Điều khoản / Trạng thái & Ghi chú); room+tenant readonly when `status='active'`
- [ ] 8.2 Add inline blur validation + error summary banner at top with click-to-focus behaviour
- [ ] 8.3 Add mobile-only sticky save bar (`md:hidden fixed bottom-0`) with safe-area-inset padding; in wizard mode, sticky bar holds Tiếp/Quay lại instead of Lưu
- [ ] 8.4 Wire dirty-state guard into `ContractForm` and integrate with `onBeforeRouteLeave` + `beforeunload` in create/edit pages; within-wizard step navigation does NOT trigger the guard
- [ ] 8.5 Add draft restore alert at top of `ContractForm` with restore/dismiss/delete actions; handle `draftVersion` mismatch
- [ ] 8.6 Add row selection mode (checkbox per row) to the existing list-row pattern in `pages/contracts/index.vue` — visible only for admin
- [ ] 8.7 Component tests: `ContractForm` (sections render, inline validation, draft banner, sticky save bar visibility, readonly room/tenant when active)

## 9. Pages

- [ ] 9.1 Refactor `app/pages/contracts/index.vue`: mount `ContractListToolbar`, switch rows to selection mode (admin), mount `ContractBulkActionsBar` when selection > 0, polish empty/error states
- [ ] 9.2 Refactor `app/pages/contracts/[code]/index.vue`: replace flat tabs with `ContractDetailHero` + sectioned layout with sticky tab nav (`#overview`, `#occupants`, `#payments`, `#services`, `#renewals`, `#meter-readings`, `#danger-zone`); hide danger zone for managers; preserve existing tab content
- [ ] 9.3 Refactor `app/pages/contracts/create.vue`: integrate `ContractWizardSteps` progress indicator, dirty-guard, draft autosave including wizard state
- [ ] 9.4 Refactor `app/pages/contracts/[code]/edit.vue`: use updated sectioned `ContractForm` with dirty-guard and draft autosave (`contract-form:edit:<id>`)
- [ ] 9.5 Handle 409 CONFLICT from DELETE in detail page (show alert listing which checks blocked: active / billing / payment / readings with counts); if only active blocks, offer "Kết thúc rồi xoá" button calling DELETE with `?force=true`

## 10. Polish & verification

- [ ] 10.1 Run `npx typecheck` and fix any new type errors
- [ ] 10.2 Run `npx lint` and fix issues
- [ ] 10.3 Run `npx test` — all new + existing tests pass
- [ ] 10.4 Manually verify on dev server: search/filter/sort/bulk on list, hero stats + sticky tab nav on detail, wizard progress + dirty guard + draft on create, sectioned edit form, 409 conflict matrix paths (each check), force-delete happy + blocked path
- [ ] 10.5 Update `docs/features/contracts.md` (or relevant docs) about contracts overhaul behaviour changes
- [ ] 10.6 Run `openspec validate contracts-overhaul --strict` and resolve any errors before archive
