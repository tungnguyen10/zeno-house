## MODIFIED Requirements

### Requirement: Building occupancy table
The `/` page SHALL display a table/list showing each building's room occupancy: building name, total rooms, available count (green), occupied count (cyan), maintenance count (yellow). Each row SHALL link to `/buildings/<slug>` using `slug` from `buildingBreakdown` and the `buildingPath()` helper in `app/utils/routes/operational.ts`.

#### Scenario: Building breakdown displayed
- **WHEN** buildings with rooms exist
- **THEN** each building shown as a row with colored room counts (available, occupied, maintenance always visible)

#### Scenario: Row links to building detail
- **WHEN** user clicks a building breakdown row
- **THEN** navigates to `/buildings/<slug>` for that building

#### Scenario: Empty buildings
- **WHEN** a building has no rooms
- **THEN** row shows 0 for all counts

#### Scenario: No buildings yet
- **WHEN** `buildingBreakdown` is empty
- **THEN** empty state message shown in the table section

## ADDED Requirements

### Requirement: Dashboard error state
The `/` page SHALL display an error state when `useDashboardSummary()` returns a non-null `error`. The error state SHALL contain a user-friendly message and a "Thử lại" button that calls `refresh()`. When in error state the page SHALL NOT render stale data and SHALL NOT show the loading skeleton.

#### Scenario: API returns 500
- **WHEN** GET /api/dashboard/summary returns 500
- **THEN** page shows error message "Không tải được dữ liệu dashboard. Vui lòng thử lại." and a "Thử lại" button

#### Scenario: Retry refreshes data
- **WHEN** user clicks "Thử lại" while in error state
- **THEN** `refresh()` is called; if successful, page transitions from error state back to data state

#### Scenario: User without dashboard.read sees forbidden state
- **WHEN** authenticated user without `dashboard.read` lands on `/`
- **THEN** page shows a forbidden message and SHALL NOT show partial data

### Requirement: Dashboard data freshness indicator
The `/` page SHALL display a "Cập nhật lúc HH:mm" label sourced from `meta.generatedAt`, accompanied by a refresh button that calls `useDashboardSummary().refresh()`. The label SHALL be formatted using the locale time format helper in `app/utils/format/`.

#### Scenario: Generated-at displayed
- **WHEN** dashboard renders successfully with `meta.generatedAt`
- **THEN** displays "Cập nhật lúc HH:mm" using local time

#### Scenario: Refresh re-fetches data
- **WHEN** user clicks the refresh button
- **THEN** `refresh()` is called; on success, `meta.generatedAt` updates and the label re-renders

### Requirement: Pending operations link built client-side
The pending operations list on `/` SHALL build navigation links on the client from the `building` object and `period` returned by the API, using helpers in `app/utils/routes/operational.ts`. The page SHALL NOT consume any `href` field from the API payload.

#### Scenario: Pending operation row links correctly
- **WHEN** a pending operation row of type `unissued_invoices` is displayed
- **THEN** the row link is built via `billingWorkspacePath(building, year, month)` using `building.slug` and `period`

#### Scenario: No href field is consumed
- **WHEN** the page renders `pendingOperations`
- **THEN** no rendering code reads a `href` property from the items
