## Purpose
Defines client-side building DTOs, validators, mappers, composables, and form behavior.
## Requirements
### Requirement: Building DTO type tách biệt với DB shape
`app/types/buildings.ts` SHALL export `Building` interface, `BuildingStatus` type, `BuildingInput` type (create), `BuildingUpdateInput` type (update, partial). Không import từ `database.types.ts`.

#### Scenario: Building type có đủ fields cho UI
- **WHEN** component nhận prop kiểu `Building`
- **THEN** có thể access `id`, `name`, `address`, `description`, `status`, `totalRooms`, `createdAt`, `updatedAt`

#### Scenario: BuildingStatus là union type
- **WHEN** code assign `building.status`
- **THEN** TypeScript chỉ chấp nhận `'active' | 'inactive'`

---

### Requirement: Zod schemas validate building data
`app/utils/validators/buildings.ts` SHALL export `buildingCreateSchema` (name required, address required, description optional) và `buildingUpdateSchema` (tất cả optional). SHALL export inferred types `BuildingCreateInput` và `BuildingUpdateInput`.

#### Scenario: buildingCreateSchema reject khi thiếu name
- **WHEN** `buildingCreateSchema.safeParse({})` được gọi
- **THEN** `success === false` với error tại field `name`

#### Scenario: buildingUpdateSchema accept partial data
- **WHEN** `buildingUpdateSchema.safeParse({ name: 'New Name' })` được gọi
- **THEN** `success === true`

#### Scenario: buildingCreateSchema validate name length
- **WHEN** name ít hơn 2 ký tự
- **THEN** validation fail với message rõ ràng

---

### Requirement: Mapper chuyển đổi DB row sang Building DTO
`app/utils/mappers/buildings.ts` SHALL export `mapBuilding(row)` chuyển đổi database row (snake_case) sang `Building` DTO (camelCase). Không có logic nào ngoài field mapping.

#### Scenario: mapBuilding chuyển snake_case sang camelCase
- **WHEN** `mapBuilding({ id, name, address, total_rooms: 5, created_at: '...', updated_at: '...' })` được gọi
- **THEN** return `{ id, name, address, totalRooms: 5, createdAt: '...', updatedAt: '...' }`

---

### Requirement: useBuildingList composable fetch và paginate
`app/composables/buildings/useBuildingList.ts` SHALL dùng `useFetch` để gọi `GET /api/buildings`, expose `buildings`, `total`, `page`, `totalPages`, `isLoading`, `error`. Thay đổi `page` SHALL trigger refetch.

#### Scenario: Fetch list khi mount
- **WHEN** composable được khởi tạo
- **THEN** tự động gọi `/api/buildings` và populate `buildings`

#### Scenario: Thay đổi page trigger refetch
- **WHEN** `page.value` thay đổi
- **THEN** `useFetch` refetch với query param `page` mới

#### Scenario: isLoading đúng khi đang fetch
- **WHEN** fetch đang pending
- **THEN** `isLoading` là `true`, sau khi hoàn thành `isLoading` là `false`

---

### Requirement: useBuildingForm composable quản lý form state
`app/composables/buildings/useBuildingForm.ts` SHALL expose `formData` (reactive), `errors` (validation errors), `isLoading`, `submitCreate(data)`, `submitUpdate(id, data)`. Validate bằng Zod trước khi gọi API.

#### Scenario: submitCreate gọi POST /api/buildings
- **WHEN** `submitCreate(data)` được gọi với data hợp lệ
- **THEN** gọi `$fetch('POST /api/buildings', { body: data })` và navigate về `/buildings`

#### Scenario: submitCreate với data không hợp lệ
- **WHEN** `submitCreate({})` được gọi với data thiếu required fields
- **THEN** `errors` được populate với Zod validation errors, không gọi API

#### Scenario: submitUpdate gọi PATCH /api/buildings/:id
- **WHEN** `submitUpdate(id, data)` được gọi
- **THEN** gọi `$fetch('PATCH /api/buildings/:id', { body: data })` và navigate về `/buildings/:id`

### Requirement: Building DTO includes slug
`Building` SHALL include `slug: string` so UI routes can use stable user-facing URLs.

#### Scenario: Building slug available to components
- **WHEN** a component receives a `Building`
- **THEN** it can read `building.slug` and use it for links

### Requirement: Building DTO includes service summary
`Building` list/detail DTOs SHALL include a service summary suitable for building cards and detail headers.

#### Scenario: Building service summary available
- **WHEN** building list data is fetched
- **THEN** each building item includes active service count and active service names or items

### Requirement: Building detail composable accepts id or slug
`useBuildingDetail(identifier)` SHALL accept either a UUID id or a slug string and fetch the corresponding building through the existing building detail API.

#### Scenario: Fetch by slug
- **WHEN** `useBuildingDetail('toa-a')` is initialized
- **THEN** it fetches and exposes the matching building

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

### Requirement: Shared helper implementations keep building form behavior stable
Building client behavior SHALL allow internal implementation via shared helpers (for example query-sync readers or local draft persistence wrappers), while public behavior, key format, debounce timing, and restore semantics defined by this spec remain unchanged.

#### Scenario: Shared draft helper preserves key contract
- **WHEN** building form uses shared draft utility internally
- **THEN** key format remains `building-form:create` or `building-form:edit:<id>`
- **AND** restore/clear behavior stays identical to this spec

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

### Requirement: Owner sees scoped building management controls
Building client pages SHALL show create/update/delete controls to owner when the action is permitted for the current building scope.

#### Scenario: Owner sees create building
- **WHEN** owner opens building list
- **THEN** create building action is visible

#### Scenario: Owner sees edit for scoped building
- **WHEN** owner opens detail page for assigned building
- **THEN** edit action is visible

#### Scenario: Owner does not see unscoped building
- **WHEN** owner opens building list
- **THEN** unassigned buildings are not rendered

### Requirement: Owner destructive controls respect safety state
Owner delete/archive controls SHALL be hidden or disabled when business rules would block the action, and server SHALL remain authoritative.

#### Scenario: Owner delete enabled for empty building
- **WHEN** owner views an assigned building with no delete blockers
- **THEN** delete action is available

#### Scenario: Owner delete disabled for blocked building
- **WHEN** owner views an assigned building with rooms, active contracts, invoices, or payments
- **THEN** delete action is disabled or archive-only with explanatory UI

#### Scenario: Direct API still blocks
- **WHEN** owner bypasses UI and calls delete for a blocked building
- **THEN** API returns 409 Conflict or 403 Forbidden according to the violated rule
