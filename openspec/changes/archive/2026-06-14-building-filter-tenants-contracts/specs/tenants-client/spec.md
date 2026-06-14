## MODIFIED Requirements

### Requirement: Tenant list page
`/tenants` page SHALL display all tenants in a table/card list. Supports filter by building and search by name or phone (`q` query param). When no building is selected, the page SHALL list tenants from all buildings. Shows loading skeleton and empty state. Admin sees create button. Includes pagination (prev/next) when `totalPages > 1`.

#### Scenario: List loads
- **WHEN** admin navigates to /tenants
- **THEN** tenants displayed with full_name, phone, id_number (neu co), created_at

#### Scenario: Search by name or phone
- **WHEN** admin types in search box
- **THEN** list updates with debounce to show matching tenants; page resets to 1

#### Scenario: Filter by building
- **WHEN** admin selects a building in the tenants toolbar
- **THEN** list updates to show only tenants related to that building through primary contracts or contract occupants

#### Scenario: Clear building filter
- **WHEN** admin clears the selected building
- **THEN** list updates to show tenants from all buildings

#### Scenario: Empty state
- **WHEN** no tenants match search or no tenants exist
- **THEN** empty state message displayed with create button

### Requirement: Tenant composables
`useTenantList` SHALL expose: `tenants`, `total`, `totalPages`, `page`, `q` (search string), `buildingFilter`, `isLoading`, `error`, `refresh`. Reset `page` to 1 when `q` or `buildingFilter` changes. `useTenantDetail(id)` mirrors `useBuildingDetail` pattern. `useTenantForm` handles create/edit with Zod validation.

#### Scenario: Filters reset pagination
- **WHEN** user changes search query or building filter
- **THEN** page resets to 1 automatically

#### Scenario: useTenantDetail reactive id
- **WHEN** id ref changes
- **THEN** composable re-fetches tenant data
