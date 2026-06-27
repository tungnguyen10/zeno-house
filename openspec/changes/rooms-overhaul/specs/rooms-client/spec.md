## ADDED Requirements

### Requirement: useRoomList accepts filter/sort/URL-sync refs
`useRoomList()` SHALL expose reactive refs for `q: string`, `status: RoomStatus[]`, `sort: 'room_number' | 'floor' | 'monthly_rent' | 'created_at'`, `order: 'asc' | 'desc'` in addition to existing `buildingId`, `floor`, `page`, `limit`. These refs SHALL be two-way synchronized with `useRoute().query` so that updating a ref pushes to URL and navigating with new query updates the refs. Changes to `q`, `status`, `sort`, `buildingId`, or `floor` SHALL reset `page` to 1.

#### Scenario: Query refs initialize from URL
- **WHEN** composable mounts on `/rooms?q=a&status=available&sort=monthly_rent&order=desc&page=2`
- **THEN** `q.value === 'a'`, `status.value === ['available']`, `sort.value === 'monthly_rent'`, `order.value === 'desc'`, `page.value === 2`

#### Scenario: Updating a ref pushes to URL
- **WHEN** consumer assigns `q.value = 'b201'`
- **THEN** the route query updates to include `q=b201` and `page=1`

#### Scenario: Refetch on filter change
- **WHEN** any of `q`, `status`, `sort`, `order` change
- **THEN** `useFetch` automatically refetches `/api/rooms` with the new query params

---

### Requirement: useRoomForm exposes dirty state and draft persistence
`useRoomForm()` SHALL expose `isDirty: ComputedRef<boolean>` indicating whether `formData` has diverged from the initial snapshot. It SHALL also expose `restoreDraft()`, `clearDraft()`, `hasDraft: ComputedRef<boolean>`. The composable SHALL persist `formData` to `localStorage` under key `room-form:create:<buildingId|none>` or `room-form:edit:<id>` with 500ms debounce after a change, and clear the entry after `submitCreate` or `submitUpdate` succeeds.

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

### Requirement: useRoomBulkActions composable
`app/composables/rooms/useRoomBulkActions.ts` SHALL expose `selectedIds: Ref<string[]>`, `isSelected(id): boolean`, `toggle(id)`, `selectAll(ids: string[])`, `clear()`, and `runAction(action: 'archive' | 'activate' | 'set_maintenance' | 'delete'): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }>`. `runAction` SHALL call `POST /api/rooms/bulk` and return the parsed response; on success it SHALL clear selection.

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

### Requirement: Rooms validators include list-query and bulk-action schemas
`app/utils/validators/rooms.ts` SHALL export `roomListQuerySchema` (page, limit, q, status[], building_id, floor, sort, order — all optional with defaults) and `roomBulkActionSchema` (action enum, ids min 1). Both schemas SHALL be shared between client (URL parse, request body) and server (validation entry).

#### Scenario: roomListQuerySchema parses URL-shaped data
- **WHEN** `roomListQuerySchema.safeParse({ q: 'x', status: ['available'], sort: 'room_number', order: 'asc' })` is called
- **THEN** `success === true` with parsed values

#### Scenario: roomListQuerySchema accepts missing fields
- **WHEN** `roomListQuerySchema.safeParse({})` is called
- **THEN** `success === true` with defaults applied (`page=1`, `limit=20`, no filters)

#### Scenario: roomBulkActionSchema rejects empty IDs
- **WHEN** `roomBulkActionSchema.safeParse({ action: 'archive', ids: [] })` is called
- **THEN** `success === false` with error on `ids`

#### Scenario: roomBulkActionSchema rejects invalid action
- **WHEN** `roomBulkActionSchema.safeParse({ action: 'wipe', ids: ['x'] })` is called
- **THEN** `success === false` with error on `action`
