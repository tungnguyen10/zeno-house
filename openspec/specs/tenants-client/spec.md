## Purpose

Client-side UI for managing tenants. Includes list page with search (debounced) and pagination, detail page, create and edit pages. Follows the same composable + page pattern as buildings and rooms.

## Requirements

### Requirement: Tenant list page
`/tenants` page SHALL display all tenants in a table/card list. Supports search by name or phone (`q` query param). Shows loading skeleton and empty state. Admin sees create button. Includes pagination (prev/next) when `totalPages > 1`.

#### Scenario: List loads
- **WHEN** admin navigates to /tenants
- **THEN** tenants displayed with full_name, phone, id_number (nếu có), created_at

#### Scenario: Search by name or phone
- **WHEN** admin types in search box
- **THEN** list updates with debounce to show matching tenants; page resets to 1

#### Scenario: Empty state
- **WHEN** no tenants match search or no tenants exist
- **THEN** empty state message displayed with create button

### Requirement: Tenant detail page
`/tenants/:id` page SHALL display all tenant fields including full_name, phone, email, id_number, date_of_birth, permanent_address, notes. Admin sees edit and delete buttons. Delete uses `UiConfirmModal`. The page SHALL also display a read-only "Hợp đồng" section listing all contracts for this tenant (contract id, room number + building, start_date, end_date, status badge), each linking to `/contracts/:id`. When no contracts exist, show a "Chưa có hợp đồng" placeholder.

#### Scenario: Detail view
- **WHEN** admin navigates to /tenants/:id
- **THEN** all tenant fields displayed with edit/delete actions

#### Scenario: Delete with confirmation
- **WHEN** admin clicks Xoá and confirms in UiConfirmModal
- **THEN** tenant deleted, redirected to /tenants

#### Scenario: Not found
- **WHEN** tenant id does not exist
- **THEN** redirected to /tenants

#### Scenario: Show current room when assigned
- **WHEN** tenant has an active room assignment
- **THEN** current room number, floor, and building name are displayed with a link to room detail

#### Scenario: Show no room when unassigned
- **WHEN** tenant has no active room assignment
- **THEN** "Chưa có phòng" placeholder displayed

#### Scenario: Show contracts list
- **WHEN** tenant has one or more contracts
- **THEN** each contract shown with room, dates, and status badge linking to /contracts/:id

#### Scenario: Show no contracts placeholder
- **WHEN** tenant has no contracts
- **THEN** "Chưa có hợp đồng" placeholder displayed in the Hợp đồng section

### Requirement: Create tenant page
`/tenants/create` page SHALL present TenantForm. Required fields: full_name, phone. Optional: email, id_number, date_of_birth, permanent_address, notes. On success redirects to /tenants. Shows API errors inline.

#### Scenario: Create success
- **WHEN** admin fills required fields and submits
- **THEN** tenant created, redirected to /tenants

#### Scenario: Validation error
- **WHEN** admin submits without full_name or phone
- **THEN** field-level error messages shown, no API call made

#### Scenario: Duplicate id_number
- **WHEN** admin submits id_number that already exists
- **THEN** error displayed inline: "Số CMND/CCCD đã tồn tại"

### Requirement: Edit tenant page
`/tenants/:id/edit` page SHALL pre-fill TenantForm with existing data. On success redirects to `/tenants/:id`.

#### Scenario: Edit success
- **WHEN** admin edits and saves
- **THEN** tenant updated, redirected to detail page

#### Scenario: Redirect if not found
- **WHEN** tenant id does not exist
- **THEN** redirected to /tenants

### Requirement: Tenant composables
`useTenantList` SHALL expose: `tenants`, `total`, `totalPages`, `page`, `q` (search string), `isLoading`, `error`, `refresh`. Reset `page` to 1 when `q` changes. `useTenantDetail(id)` mirrors `useBuildingDetail` pattern. `useTenantForm` handles create/edit with Zod validation.

#### Scenario: Search resets pagination
- **WHEN** user changes search query
- **THEN** page resets to 1 automatically

#### Scenario: useTenantDetail reactive id
- **WHEN** id ref changes
- **THEN** composable re-fetches tenant data

### Requirement: Sidebar navigation
AppSidebar SHALL include a "Khách thuê" nav item linking to `/tenants`.

#### Scenario: Sidebar shows tenants link
- **WHEN** admin views sidebar
- **THEN** "Khách thuê" item visible and links to /tenants
