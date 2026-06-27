## ADDED Requirements

### Requirement: useContractList accepts filter/sort/URL-sync refs
`useContractList()` SHALL expose reactive refs for `q: string`, `status: ContractStatus[]`, `sort: 'start_date' | 'end_date' | 'created_at' | 'monthly_rent'`, `order: 'asc' | 'desc'`, `roomFilter: string`, `tenantFilter: string` in addition to existing `buildingFilter`, `statusFilter`, `page`, `limit`. These refs SHALL be two-way synchronized with `useRoute().query` so that updating a ref pushes to URL and navigating with new query updates the refs. Changes to `q`, `status`, `sort`, `buildingFilter`, `roomFilter`, or `tenantFilter` SHALL reset `page` to 1.

#### Scenario: Query refs initialize from URL
- **WHEN** composable mounts on `/contracts?q=A101&status=active&sort=start_date&order=desc&page=2`
- **THEN** `q.value === 'A101'`, `status.value === ['active']`, `sort.value === 'start_date'`, `order.value === 'desc'`, `page.value === 2`

#### Scenario: Updating a ref pushes to URL
- **WHEN** consumer assigns `q.value = 'tran'`
- **THEN** the route query updates to include `q=tran` and `page=1`

#### Scenario: Refetch on filter change
- **WHEN** any of `q`, `status`, `sort`, `order` change
- **THEN** `useFetch` automatically refetches `/api/contracts` with the new query params

---

### Requirement: useContractForm exposes dirty state and draft persistence
`useContractForm()` SHALL expose `isDirty: ComputedRef<boolean>` indicating whether `formData` has diverged from the initial snapshot. It SHALL also expose `restoreDraft()`, `clearDraft()`, `hasDraft: ComputedRef<boolean>`. The composable SHALL persist `formData` to `localStorage` under key `contract-form:create` (wizard state including `currentStep`, pending occupants array, and selected services) or `contract-form:edit:<id>` with 500ms debounce after a change, and clear the entry after `submitCreate`/`submitUpdate` succeeds. The draft payload SHALL include a `draftVersion: number` so mismatched-version drafts can be detected.

#### Scenario: isDirty becomes true on field change
- **WHEN** consumer changes any field in `formData`
- **THEN** `isDirty.value === true`

#### Scenario: hasDraft reflects localStorage presence
- **WHEN** a draft exists for the current key
- **THEN** `hasDraft.value === true`

#### Scenario: restoreDraft populates formData and wizard state
- **WHEN** `restoreDraft()` is called and a wizard draft exists with `currentStep=2`, pending occupants, selected services
- **THEN** `formData` is replaced with the draft values, the wizard navigates to step 2, and `isDirty` recomputes against the new baseline

#### Scenario: Draft cleared after successful submit
- **WHEN** `submitCreate(data)` resolves successfully
- **THEN** the localStorage entry is removed and `hasDraft.value === false`

#### Scenario: Draft version mismatch
- **WHEN** `restoreDraft()` is called and the stored `draftVersion` differs from the current code version
- **THEN** an alert is shown indicating "Bản nháp cũ không tương thích" and `restoreDraft()` does not overwrite formData

---

### Requirement: useContractBulkActions composable
`app/composables/contracts/useContractBulkActions.ts` SHALL expose `selectedIds: Ref<string[]>`, `isSelected(id): boolean`, `toggle(id)`, `selectAll(ids: string[])`, `clear()`, and `runAction(action: 'terminate' | 'delete', opts?: { reason?: string }): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }>`. `runAction` SHALL call `POST /api/contracts/bulk` and return the parsed response; on success it SHALL clear selection.

#### Scenario: Toggle adds and removes IDs
- **WHEN** consumer calls `toggle('id-1')` then `toggle('id-1')`
- **THEN** `selectedIds.value` ends as `[]`

#### Scenario: selectAll replaces selection with provided IDs
- **WHEN** `selectAll(['a','b','c'])` is called
- **THEN** `selectedIds.value === ['a','b','c']`

#### Scenario: runAction returns partial-success shape
- **WHEN** `runAction('delete')` is called with 3 IDs and 1 fails
- **THEN** the promise resolves with `{ succeeded: [...], failed: [{ id, reason }] }`

#### Scenario: Selection clears after successful action
- **WHEN** `runAction('terminate')` resolves
- **THEN** `selectedIds.value === []`

---

### Requirement: Contracts validators include list-query and bulk-action schemas
`app/utils/validators/contracts.ts` SHALL export `contractListQuerySchema` (page, limit, q, building_id, room_id, tenant_id, status[], sort, order — all optional with defaults) and `contractBulkActionSchema` (action enum, ids min 1, reason optional). Both schemas SHALL be shared between client (URL parse, request body) and server (validation entry).

#### Scenario: contractListQuerySchema parses URL-shaped data
- **WHEN** `contractListQuerySchema.safeParse({ q: 'x', status: ['active'], sort: 'start_date', order: 'desc' })` is called
- **THEN** `success === true` with parsed values

#### Scenario: contractListQuerySchema accepts missing fields
- **WHEN** `contractListQuerySchema.safeParse({})` is called
- **THEN** `success === true` with defaults applied (`page=1`, `limit=20`, no filters)

#### Scenario: contractBulkActionSchema rejects empty IDs
- **WHEN** `contractBulkActionSchema.safeParse({ action: 'terminate', ids: [] })` is called
- **THEN** `success === false` with error on `ids`

#### Scenario: contractBulkActionSchema rejects invalid action
- **WHEN** `contractBulkActionSchema.safeParse({ action: 'renew', ids: ['x'] })` is called
- **THEN** `success === false` with error on `action`
