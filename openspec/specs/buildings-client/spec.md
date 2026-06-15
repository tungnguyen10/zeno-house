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

