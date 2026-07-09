## Purpose

Client-side UI for managing rooms. Includes list page with filters, detail page, create and edit pages. Status badge uses color coding per room occupancy state.
## Requirements
### Requirement: Room list page
`/rooms` page SHALL display all rooms in a table/card list. Supports filter by building (dropdown), status (dropdown), floor (input). Shows loading skeleton and empty state. Admin sees create button.

#### Scenario: List loads
- **WHEN** admin navigates to /rooms
- **THEN** rooms are displayed with building name, room_number, floor, status, monthly_rent

#### Scenario: Filter by building
- **WHEN** admin selects a building from filter dropdown
- **THEN** list updates to show only rooms in that building

#### Scenario: Empty state
- **WHEN** no rooms match filter or no rooms exist
- **THEN** empty state message displayed with create button

### Requirement: Room detail page
`/rooms/:id` page SHALL display room master data, occupancy status, current active contract summary, and a read-only contract history. Admin sees edit/delete actions and occupancy lifecycle actions where allowed. The page SHALL NOT host monthly billing entry, monthly utility input, invoice state, payment state, or billing calculations.

#### Scenario: Detail view
- **WHEN** admin navigates to `/rooms/:id`
- **THEN** room detail is displayed with edit and delete actions

#### Scenario: Not found
- **WHEN** room id does not exist
- **THEN** 404 page shown

#### Scenario: Show current tenant when occupied
- **WHEN** room has an active contract (`status = 'active'`)
- **THEN** current tenant's name and phone are displayed with a link to tenant detail

#### Scenario: Show assign button when no active contract
- **WHEN** room has no active contract and room.status is not `maintenance` and user is admin
- **THEN** a "Giao phòng" button is shown that navigates to `/contracts/create?room_id=<id>`

#### Scenario: Show unassign button when occupied
- **WHEN** room has an active contract and user is admin
- **THEN** a "Thu phòng" button is shown with `UiConfirmModal`; confirm calls `PATCH /api/contracts/:id` with status `terminated`

#### Scenario: Show contracts list
- **WHEN** room has one or more contracts
- **THEN** each contract shown with tenant name, dates, and status badge linking to /contracts/:id

#### Scenario: Show no contracts placeholder
- **WHEN** room has no contracts
- **THEN** "Chưa có hợp đồng" placeholder displayed in the Hợp đồng section

#### Scenario: Monthly billing is not performed from room detail
- **WHEN** user needs to enter monthly readings or review monthly charges
- **THEN** the UI directs them to the Monthly Billing Workspace instead of a room-detail workflow

#### Scenario: Effective rent reflects active contract when present
- **WHEN** the room has an active contract whose `monthly_rent` differs from the room's `monthly_rent`
- **THEN** the page displays the active contract's `monthly_rent` as the effective rent
- **AND** the page shows a helper note indicating the value comes from the active contract

#### Scenario: Catalog rent shown when vacant
- **WHEN** the room has no active contract
- **THEN** the page displays `room.monthly_rent` without the active-contract note

#### Scenario: No helper note when rents already match
- **WHEN** the active contract's `monthly_rent` equals the room's `monthly_rent`
- **THEN** the page displays the rent without the active-contract helper note

### Requirement: Room form labels rent as the canonical price
The room create/edit form's monthly rent input SHALL include helper text indicating that this is the room's canonical price and that new contracts default to this value.

#### Scenario: Helper text shown on the form
- **WHEN** an admin opens the room create or edit form
- **THEN** a helper text below the "Giá thuê / tháng" input explains that this is the room's standard price and new contracts will default to it

### Requirement: Create room page
`/rooms/create` page SHALL present RoomForm. On success redirects to /rooms. Shows API errors inline.

#### Scenario: Create success
- **WHEN** admin fills valid form and submits
- **THEN** room created, redirected to /rooms

#### Scenario: Duplicate room number
- **WHEN** admin submits duplicate room_number in same building
- **THEN** error displayed inline without page reload

### Requirement: Edit room page
`/rooms/:id/edit` page SHALL pre-fill RoomForm with existing data. On success redirects to /rooms/:id.

#### Scenario: Edit success
- **WHEN** admin edits and saves
- **THEN** room updated, redirected to detail page

### Requirement: Room status badge
Status badge SHALL use color coding: `available` → green, `occupied` → cyan, `maintenance` → yellow.

#### Scenario: Badge colors
- **WHEN** room has status 'available'
- **THEN** badge displays with green color variant

---

### Requirement: Room list pagination
The `/rooms` list page SHALL support pagination matching the buildings list pattern. `useRoomList` SHALL expose `page` (reactive, default 1), `totalPages` (computed), and reset `page` to 1 when filters change. UI shows prev/next buttons when `totalPages > 1`.

#### Scenario: Next page
- **WHEN** user clicks next page button
- **THEN** page increments and list reloads with next page of results

#### Scenario: Filter resets page
- **WHEN** user changes building or status filter
- **THEN** page resets to 1 automatically

### Requirement: Room links support building-scoped slugs
Room UI links SHALL prefer building-scoped readable URLs when building slug and room slug are available, while preserving existing `/rooms/:id` links.

#### Scenario: Room link uses building and room slug
- **WHEN** a room has building slug `toa-a` and room slug `a101`
- **THEN** the preferred room detail link is `/buildings/toa-a/rooms/a101`

#### Scenario: Room link falls back to id
- **WHEN** a room does not have enough slug context
- **THEN** the UI can link to `/rooms/<id>`

### Requirement: Room detail accepts id route and scoped route
The room detail UI SHALL be reachable from existing UUID room URLs and from building-scoped room slug URLs.

#### Scenario: Existing room id URL works
- **WHEN** user opens `/rooms/<uuid>`
- **THEN** the room detail page loads the matching room

#### Scenario: Scoped room slug URL works
- **WHEN** user opens `/buildings/toa-a/rooms/a101`
- **THEN** the room detail page loads room A101 in building Toa A

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

### Requirement: Shared helper implementations keep room form behavior stable
Room client behavior SHALL allow internal implementation via shared helpers (query-sync readers, draft persistence wrappers), while route-query contract and room draft semantics in this spec remain unchanged.

#### Scenario: Shared draft helper preserves room envelope semantics
- **WHEN** room form uses shared draft utility internally
- **THEN** stored payload keeps room-compatible draft shape and restore timestamp behavior
- **AND** key contract stays `room-form:create:<buildingId|none>` or `room-form:edit:<id>`

---

### Requirement: useRoomBulkActions composable
`app/composables/rooms/useRoomBulkActions.ts` SHALL compose shared selection state via `useBulkSelection()` and expose `selectedIds: Ref<string[]>`, `isSelected(id): boolean`, `toggle(id)`, `selectAll(ids: string[])`, `clear()`, and `runAction(action: 'archive' | 'activate' | 'set_maintenance' | 'delete', opts?: { reason?: string }): Promise<{ succeeded: string[]; failed: { id: string; reason: string }[] }>`. `runAction` SHALL call `POST /api/rooms/bulk` and return the parsed response. `runAction` SHALL NOT clear selection; callers clear in page-level `onDone` handling after toast + refresh.

#### Scenario: Toggle adds and removes IDs
- **WHEN** consumer calls `toggle('id-1')` then `toggle('id-1')`
- **THEN** `selectedIds.value` ends as `[]`

#### Scenario: selectAll replaces selection with provided IDs
- **WHEN** `selectAll(['a','b','c'])` is called
- **THEN** `selectedIds.value === ['a','b','c']`

#### Scenario: runAction returns partial-success shape
- **WHEN** `runAction('delete')` is called with 3 IDs and 1 fails
- **THEN** the promise resolves with `{ succeeded: [...], failed: [{ id, reason }] }`

#### Scenario: Selection is cleared by caller after result handling
- **WHEN** `runAction('archive')` resolves
- **THEN** selection remains unchanged until caller invokes `clear()`

---

### Requirement: Rooms validators include list-query and bulk-action schemas
`app/utils/validators/rooms.ts` SHALL export `roomListQuerySchema` (page, limit, q, status[], building_id, floor, sort, order — all optional with defaults) and `roomBulkActionSchema` (action enum, ids min 1, optional `reason` that is required when `action='delete'`). Both schemas SHALL be shared between client (URL parse, request body) and server (validation entry).

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

#### Scenario: roomBulkActionSchema requires reason for delete
- **WHEN** `roomBulkActionSchema.safeParse({ action: 'delete', ids: ['x'] })` is called
- **THEN** `success === false` with error on `reason`

