## MODIFIED Requirements

### Requirement: Dashboard stat cards
The `/` page SHALL display operational KPI cards for room occupancy, contract status, and current-month billing health. The primary metric for rooms SHALL be the occupancy ratio rendered as a percentage (`occupied / total`), accompanied by per-status counts (available, occupied, maintenance) in a caption. The primary metric for contracts SHALL be the active count, accompanied by `expiringSoon` (≤30 days) and `expiringUrgent` (≤7 days) tiers. Current-month billing health SHALL be expressed primarily through a "collection rate" visual (see "Dashboard collection hero") rather than a numeric strip. KPI cards SHALL use the existing operational card style and SHALL show loading skeletons while data is fetching.

#### Scenario: Stats load and display
- **WHEN** admin navigates to /
- **THEN** the dashboard displays the room occupancy percent, contract active/soon/urgent tiers, and the collection hero, all sourced from `useDashboardSummary()`

#### Scenario: Loading state
- **WHEN** dashboard summary data is being fetched
- **THEN** skeleton placeholders are shown in place of KPI values, hero donut, and chart areas

#### Scenario: Zero rooms shows 0% safely
- **WHEN** `summary.rooms.total === 0`
- **THEN** the occupancy KPI shows `0%` without throwing a division error

### Requirement: Dashboard collection hero
The `/` page SHALL render a single signature element: a half-donut chart showing the current-month collection rate. The donut SHALL use Chart.js (registered via the chart client plugin), with `paidAmount` filling the cyan arc and `outstandingAmount` filling the muted track. The center of the donut SHALL display the percentage (`Math.round(collectionRate * 100) + '%'`) and a caption showing `paid / invoiceTotal` and `outstandingAmount`.

#### Scenario: Collection hero renders with data
- **WHEN** the dashboard loads successfully and `summary.billing.currentMonth.invoiceTotal > 0`
- **THEN** the half-donut shows the cyan arc proportional to `collectionRate`, the center text shows the percent, and the caption shows formatted paid/total and outstanding amounts

#### Scenario: Collection hero with no invoices yet
- **WHEN** `summary.billing.currentMonth.invoiceTotal === 0`
- **THEN** the donut renders as a fully muted track (0% cyan), the center text shows `0%`, and the caption shows an empty-state hint (e.g., "Chưa phát hành hoá đơn tháng này")

#### Scenario: Collection hero is the only Chart.js-rendered signature
- **WHEN** the dashboard renders without errors
- **THEN** the collection hero is the visually dominant element above the fold; no other UI element on the page uses a comparably large radial/donut visual

### Requirement: Building occupancy bars use per-row ratio
The `/` page SHALL display per-building occupancy as horizontal stacked bars where each bar occupies 100% of the row width and segments (available, occupied, maintenance) are proportional to that building's own room counts. Bars SHALL NOT normalize widths across buildings (the previous `n / max(allBuildings)` approach is forbidden).

#### Scenario: Bars reflect each building's own ratio
- **WHEN** building A has 10/10 occupied (100%) and building B has 5/20 occupied (25%)
- **THEN** the bar for building A is fully filled with the occupied color and the bar for building B shows 25% occupied / remainder available

#### Scenario: Occupancy percent label per row
- **WHEN** a building has at least one room
- **THEN** the row displays the occupancy percent (rounded) on the right side of the bar alongside the total room count

#### Scenario: Empty building shows muted bar
- **WHEN** a building has zero rooms
- **THEN** the bar renders as a fully muted track and the row shows `0/0 phòng` without a percent

#### Scenario: No buildings at all
- **WHEN** `buildingBreakdown` is an empty array
- **THEN** the occupancy list renders a `UiEmptyState` block with a hint to add buildings; no rows are rendered

### Requirement: Dashboard revenue and debt chart
The `/` page SHALL display a stacked column chart for the most recent billing periods (up to 6) showing three layers per period: `Đã thu` (paid), `Chưa thu trong hạn` (`outstandingAmount - overdueAmount`), and `Quá hạn` (`overdueAmount`). The chart SHALL be implemented with Chart.js (registered via the chart client plugin) and SHALL derive all colors, grid lines, and tooltip styling from the shared `useChartTheme()` composable.

#### Scenario: Revenue debt chart displayed
- **WHEN** dashboard summary includes monthly billing trend data
- **THEN** the dashboard displays a stacked column chart with X axis = period token (YYYY-MM), Y axis = currency, and one stacked column per period with the three layers above

#### Scenario: Revenue debt chart axis formatting
- **WHEN** the chart Y axis renders values
- **THEN** values are formatted with the compact currency helper (e.g., `120tr`, `1.2tỷ`) instead of full `Intl.NumberFormat` currency strings

#### Scenario: Revenue debt empty state
- **WHEN** `billingTrend` is an empty array
- **THEN** the chart area is replaced by a `UiEmptyState` block; Chart.js is not mounted

#### Scenario: Chart renders client-only
- **WHEN** the dashboard SSRs
- **THEN** the chart component is wrapped in `<ClientOnly>` and renders a skeleton fallback on the server; Chart.js is not imported into the server bundle

### Requirement: Pending operations sorted with severity and amount
The `/` page SHALL render `pendingOperations` in the order provided by the API (which sorts by severity desc, amount desc, period desc, building name asc). Each row SHALL display a severity-dot indicator matching the item's `severity`, the operation type label, the building name (linked), the period, the count, and the formatted amount when present.

#### Scenario: Severity-dot indicator
- **WHEN** a pending operation row renders
- **THEN** the leftmost element is a small filled dot whose color matches the severity (`danger` → error, `warning` → warning, `info` → cyan)

#### Scenario: Amount displayed for overdue invoices
- **WHEN** a pending operation has `amount` defined
- **THEN** the row displays the formatted currency amount (using `formatCurrency`); when `amount` is undefined, the cell shows an em-dash (`—`)

#### Scenario: Row links via existing helper
- **WHEN** a pending operation row is rendered
- **THEN** the link target is built via `pendingOperationPath(item)` from `app/utils/routes/operational.ts`; no `href` field from the API is consumed

#### Scenario: No pending work
- **WHEN** `pendingOperations` is empty
- **THEN** the section renders `UiEmptyState` with a positive empty-state message

### Requirement: Dashboard data freshness indicator
The `/` page SHALL display a relative time label sourced from `meta.generatedAt`, accompanied by a refresh button that calls `useDashboardSummary().refresh()`. The relative label SHALL re-render on a client-side interval (at most every 30 seconds) without re-fetching dashboard data. The label SHALL include the absolute time as a `title` attribute for hover/tooltip access.

#### Scenario: Relative label rendered
- **WHEN** dashboard renders successfully with `meta.generatedAt` within the last 60 seconds
- **THEN** displays `"Vừa cập nhật"`

#### Scenario: Minutes-ago label
- **WHEN** `meta.generatedAt` is between 1 minute and 60 minutes ago
- **THEN** displays `"X phút trước"`

#### Scenario: Hours-ago label
- **WHEN** `meta.generatedAt` is between 1 hour and 24 hours ago
- **THEN** displays `"X giờ trước"`

#### Scenario: Older falls back to absolute
- **WHEN** `meta.generatedAt` is older than 24 hours
- **THEN** displays a date+time fallback in `DD/MM HH:mm` format (via `formatDateTimeShort`) instead of a relative label

#### Scenario: Refresh re-fetches data
- **WHEN** user clicks the refresh button
- **THEN** `refresh()` is called; on success, `meta.generatedAt` updates and the label re-renders to `"Vừa cập nhật"`

#### Scenario: Hover shows absolute time
- **WHEN** the user hovers the relative label
- **THEN** the `title` attribute exposes the absolute `HH:mm` time

### Requirement: AppStatCard component
`AppStatCard` SHALL be a shell component at `app/components/app/AppStatCard.vue`. Props: `title` (string), `value` (string | number), `description` (optional string). Renders a card with dark surface background matching existing card styles.

#### Scenario: Renders title and value
- **WHEN** AppStatCard receives title="Tòa nhà" value=5
- **THEN** displays "Tòa nhà" label and "5" as prominent value

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

### Requirement: Pending operations link built client-side
The pending operations list on `/` SHALL build navigation links on the client from the `building` object and `period` returned by the API, using helpers in `app/utils/routes/operational.ts`. The page SHALL NOT consume any `href` field from the API payload.

#### Scenario: Pending operation row links correctly
- **WHEN** a pending operation row of type `unissued_invoices` is displayed
- **THEN** the row link is built via `billingWorkspacePath(building, year, month)` using `building.slug` and `period`

#### Scenario: No href field is consumed
- **WHEN** the page renders `pendingOperations`
- **THEN** no rendering code reads a `href` property from the items

## REMOVED Requirements

### Requirement: Building occupancy table
**Reason**: Replaced by "Building occupancy bars use per-row ratio" — the previous table-based requirement allowed normalize-by-max bars, which was misleading. The new requirement specifies per-row 100%-width stacked bars and an explicit occupancy percent per row, which supersedes the table format.

**Migration**: The list/bar implementation moves into a dedicated `app/components/dashboard/DashboardOccupancyList.vue`. Routing via `buildingPath()` is preserved.

### Requirement: Dashboard occupancy chart
**Reason**: Subsumed by "Building occupancy bars use per-row ratio". The previous requirement only said "segmented or grouped visual bars" without constraining the normalization, leaving room for the misleading cross-row scaling that exists today.
