## ADDED Requirements

### Requirement: useBuildingList accepts filter/sort/URL-sync refs
`useBuildingList()` SHALL expose reactive refs for `q: string`, `status: BuildingStatus[]`, `sort: 'name' | 'created_at' | 'total_rooms'`, `order: 'asc' | 'desc'` in addition to existing `page`, `limit`. These refs SHALL be two-way synchronized with `useRoute().query` so that updating a ref pushes to URL and navigating with new query updates the refs. Changes to `q`, `status`, or `sort` SHALL reset `page` to 1.

#### Scenario: Query refs initialize from URL
- **WHEN** composable mounts on `/buildings?q=toa&status=active&sort=name&order=asc&page=2`
- **THEN** `q.value === 'toa'`, `status.value === ['active']`, `sort.value === 'name'`, `order.value === 'asc'`, `page.value === 2`

#### Scenario: Updating a ref pushes to URL
- **WHEN** consumer assigns `q.value = 'sunrise'`
- **THEN** the route query updates to include `q=sunrise` and `page=1`

#### Scenario: Refetch on filter change
- **WHEN** any of `q`, `status`, `sort`, `order` change
- **THEN** `useFetch` automatically refetches `/api/buildings` with the new query params

---

### Requirement: useBuildingForm exposes dirty state and draft persistence
`useBuildingForm()` SHALL expose `isDirty: ComputedRef<boolean>` indicating whether `formData` has diverged from the initial snapshot. It SHALL also expose `restoreDraft()`, `clearDraft()`, `hasDraft: ComputedRef<boolean>`. The composable SHALL persist `formData` to `localStorage` under key `building-form:create` or `building-form:edit:<id>` with 500ms debounce after a change, and clear the entry after `submitCreate` or `submitUpdate` succeeds.

#### Scenario: isDirty becomes true on field change
- **WHEN** consumer changes any field in `formData`
- **THEN** `isDirty.value === true`

#### Scenario: hasDraft reflects localStorage presence
- **WHEN** a draft exists for the current key
- **THEN** `hasDraft.value === true`

#### Scenario: restoreDraft populates formData
- **WHEN** `restoreDraft()` is called and a draft exists
- **THEN** `formData` is replaced with the draft values and `isDirty` recomputes against the new baseline

#### Scenario: Draft cleared after successful submit
- **WHEN** `submitCreate(data)` resolves successfully
- **THEN** the localStorage entry is removed and `hasDraft.value === false`

#### Scenario: Draft autosaved with debounce
- **WHEN** user types continuously for 1 second
- **THEN** localStorage is written at most a few times (debounced 500ms), and the final saved value matches the latest input

---

### Requirement: useBuildingBulkActions composable
`app/composables/buildings/useBuildingBulkActions.ts` SHALL expose `selectedIds: Ref<string[]>`, `isSelected(id): boolean`, `toggle(id)`, `selectAll(ids: string[])`, `clear()`, and `runAction(action: 'archive' | 'activate' | 'delete'): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }>`. `runAction` SHALL call `POST /api/buildings/bulk` and return the parsed response; on success it SHALL clear selection.

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
- **WHEN** `runAction('archive')` resolves
- **THEN** `selectedIds.value === []`

---

### Requirement: Buildings validators include list-query and bulk-action schemas
`app/utils/validators/buildings.ts` SHALL export `buildingListQuerySchema` (page, limit, q, status[], sort, order — all optional with defaults) and `buildingBulkActionSchema` (action enum, ids min 1). Both schemas SHALL be shared between client (URL parse, request body) and server (validation entry).

#### Scenario: buildingListQuerySchema parses URL-shaped data
- **WHEN** `buildingListQuerySchema.safeParse({ q: 'x', status: ['active'], sort: 'name', order: 'asc' })` is called
- **THEN** `success === true` with parsed values

#### Scenario: buildingListQuerySchema accepts missing fields
- **WHEN** `buildingListQuerySchema.safeParse({})` is called
- **THEN** `success === true` with defaults applied (`page=1`, `limit=20`, no filters)

#### Scenario: buildingBulkActionSchema rejects empty IDs
- **WHEN** `buildingBulkActionSchema.safeParse({ action: 'archive', ids: [] })` is called
- **THEN** `success === false` with error on `ids`

#### Scenario: buildingBulkActionSchema rejects invalid action
- **WHEN** `buildingBulkActionSchema.safeParse({ action: 'wipe', ids: ['x'] })` is called
- **THEN** `success === false` with error on `action`
