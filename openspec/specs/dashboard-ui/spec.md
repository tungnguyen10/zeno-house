## Purpose

UI spec cho dashboard page (`/dashboard`). Hiển thị stat cards, collection hero, per-building occupancy, billing trend, và pending operations.
## Requirements
### Requirement: Dashboard stat cards
The `/dashboard` page SHALL display operational KPI cards for room occupancy, contract status, and current-month billing health. The primary metric for rooms SHALL be the occupancy ratio rendered as a percentage (`occupied / total`), accompanied by per-status counts (available, occupied, maintenance) in a caption. The primary metric for contracts SHALL be the active count, accompanied by `expiringSoon` (≤30 days) and `expiringUrgent` (≤7 days) tiers. Current-month billing health SHALL be expressed primarily through a collection-rate visual rather than a numeric strip. KPI cards SHALL use `UiSurfacePanel` and SHALL show shape-matched loading skeletons while data is fetching.

#### Scenario: Stats load and display
- **WHEN** admin navigates to `/dashboard`
- **THEN** the dashboard displays the room occupancy percent, contract active/soon/urgent tiers, and the collection hero, all sourced from `useDashboardSummary()`

#### Scenario: Loading state
- **WHEN** dashboard summary data is being fetched
- **THEN** skeleton placeholders are shown in place of KPI values, hero donut, and chart areas

#### Scenario: Zero rooms shows 0% safely
- **WHEN** `summary.rooms.total === 0`
- **THEN** the occupancy KPI shows `0%` without throwing a division error

### Requirement: Dashboard collection hero
The `/dashboard` page SHALL render a single signature element: a full segmented donut showing current-month collection health. The donut SHALL use Chart.js (registered via the chart client plugin) and split `invoiceTotal` into `paidAmount`, in-grace outstanding (`outstandingAmount - overdueAmount`), and `overdueAmount` using the canonical success, warning, and danger colors. The center SHALL display `Math.round(collectionRate * 100) + '%'`; the adjacent legend SHALL show the formatted amount for each segment and the footer SHALL show the total issued amount.

#### Scenario: Collection hero renders with data
- **WHEN** the dashboard loads successfully and `summary.billing.currentMonth.invoiceTotal > 0`
- **THEN** the donut shows paid, in-grace, and overdue segments proportional to `invoiceTotal`, the center shows the collection percent, and the legend shows all three formatted amounts

#### Scenario: Collection hero with no invoices yet
- **WHEN** `summary.billing.currentMonth.invoiceTotal === 0`
- **THEN** the donut renders as a fully muted track, the center text shows `0%`, and all formatted amounts remain zero without fabricating data

#### Scenario: Collection hero is the only Chart.js-rendered signature
- **WHEN** the dashboard renders without errors
- **THEN** the collection hero is the visually dominant element above the fold; no other UI element on the page uses a comparably large radial/donut visual

### Requirement: Building occupancy bars use per-row ratio
The `/dashboard` page SHALL display per-building occupancy as horizontal stacked bars where each bar occupies 100% of the row width and segments (available, occupied, maintenance) are proportional to that building's own room counts. Bars SHALL NOT normalize widths across buildings (the previous `n / max(allBuildings)` approach is forbidden).

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

### Requirement: AppStatCard component
`AppStatCard` SHALL be a shell component at `app/components/app/AppStatCard.vue`. Props: `title` (string), `value` (string | number), `description` (optional string). Renders a card with dark surface background matching existing card styles.

#### Scenario: Renders title and value
- **WHEN** AppStatCard receives title="Tòa nhà" value=5
- **THEN** displays "Tòa nhà" label and "5" as prominent value

### Requirement: Dashboard annual revenue overview
The `/dashboard` page SHALL display an annual revenue surface composed of three summary metrics (`Tổng doanh thu`, `Đã thu`, `Còn lại`), a category-share bar, a category breakdown list, and a stacked area chart for the 12 calendar months of the current year. Each chart layer SHALL represent a revenue category in canonical order (`rent`, `electricity`, `water`, `service`, `other`). The chart SHALL use Chart.js and SHALL derive axes, grid lines, and tooltip styling from `useChartTheme()`.

#### Scenario: Annual category chart displayed
- **WHEN** dashboard summary includes monthly billing trend data
- **THEN** the dashboard displays a stacked area chart with X axis = month, Y axis = currency, and only revenue categories with non-zero data

#### Scenario: Revenue overview can be filtered by building
- **WHEN** the authorized scope contains more than one building and the user selects one building
- **THEN** the summary metrics, category rows, and chart are projected from that building's `byBuilding` buckets without refetching

#### Scenario: Revenue debt chart axis formatting
- **WHEN** the chart Y axis renders values
- **THEN** values are formatted with the compact currency helper (e.g., `120tr`, `1.2tỷ`) instead of full `Intl.NumberFormat` currency strings

#### Scenario: Annual revenue empty state
- **WHEN** all 12 `billingTrend` buckets have zero revenue
- **THEN** the chart area is replaced by a `UiEmptyState` block; Chart.js is not mounted

#### Scenario: Chart renders client-only
- **WHEN** the dashboard SSRs
- **THEN** the chart component is wrapped in `<ClientOnly>` and renders a skeleton fallback on the server; Chart.js is not imported into the server bundle

### Requirement: Dashboard responsive composition
The dashboard SHALL use one column on mobile, an adaptive one-to-two-column composition on tablet, and three KPI columns plus two equal detail columns on desktop. Mobile reading order SHALL be collection health, rooms, contracts, annual revenue, occupancy, then pending operations. The page SHALL have no horizontal overflow at 320, 375, 414, or 768 CSS pixels.

#### Scenario: Tablet KPI composition
- **WHEN** viewport width is between the `md` and `lg` breakpoints
- **THEN** the collection card occupies the full first row and the rooms and contracts cards share the next row

#### Scenario: Mobile composition
- **WHEN** viewport width is below the `md` breakpoint
- **THEN** all dashboard panels render in the defined single-column reading order and interactive labels remain on one line

### Requirement: Pending operations sorted with severity and amount
The `/dashboard` page SHALL render `pendingOperations` in the order provided by the API (which sorts by severity desc, amount desc, period desc, building name asc). Each row SHALL display a severity-dot indicator matching the item's `severity`, the operation type label, the building name (linked), the period, the count, and the formatted amount when present.

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

### Requirement: Dashboard error state
The `/dashboard` page SHALL display an error state when `useDashboardSummary()` returns a non-null `error`. The error state SHALL contain a user-friendly message and a "Thử lại" button that calls `refresh()`. When in error state the page SHALL NOT render stale data and SHALL NOT show the loading skeleton.

#### Scenario: API returns 500
- **WHEN** GET /api/dashboard/summary returns 500
- **THEN** page shows error message "Không tải được dữ liệu dashboard. Vui lòng thử lại." and a "Thử lại" button

#### Scenario: Retry refreshes data
- **WHEN** user clicks "Thử lại" while in error state
- **THEN** `refresh()` is called; if successful, page transitions from error state back to data state

#### Scenario: User without dashboard.read sees forbidden state
- **WHEN** authenticated user without `dashboard.read` lands on `/dashboard`
- **THEN** page shows a forbidden message and SHALL NOT show partial data

### Requirement: Dashboard data freshness indicator
The `/dashboard` page SHALL display a relative time label sourced from `meta.generatedAt`, accompanied by a refresh button that calls `useDashboardSummary().refresh()`. The relative label SHALL re-render on a client-side interval (at most every 30 seconds) without re-fetching dashboard data. The label SHALL include the absolute time as a `title` attribute for hover/tooltip access.

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

### Requirement: Pending operations link built client-side
The pending operations list on `/dashboard` SHALL build navigation links on the client from the `building` object and `period` returned by the API, using helpers in `app/utils/routes/operational.ts`. The page SHALL NOT consume any `href` field from the API payload.

#### Scenario: Pending operation row links correctly
- **WHEN** a pending operation row of type `unissued_invoices` is displayed
- **THEN** the row link is built via `billingWorkspacePath(building, year, month)` using `building.slug` and `period`

#### Scenario: No href field is consumed
- **WHEN** the page renders `pendingOperations`
- **THEN** no rendering code reads a `href` property from the items
