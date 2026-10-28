## MODIFIED Requirements

### Requirement: Dashboard collection hero
The `/dashboard` page SHALL render a single signature element: a full segmented donut showing current-month collection health. The donut SHALL use Chart.js (registered via the chart client plugin) and split `invoiceTotal` into `paidAmount`, in-grace outstanding (`outstandingAmount - overdueAmount`), and `overdueAmount` using the canonical success, warning, and danger colors. The center SHALL display only `Math.round(collectionRate * 100) + '%'`; the month-over-month change SHALL render as a caption outside the donut; the adjacent legend SHALL show the formatted amount for each segment without truncating labels and the footer SHALL show the total issued amount.

#### Scenario: Collection hero renders with data
- **WHEN** the dashboard loads successfully and `summary.billing.currentMonth.invoiceTotal > 0`
- **THEN** the donut shows paid, in-grace, and overdue segments proportional to `invoiceTotal`, the center shows the collection percent, and the legend shows all three formatted amounts

#### Scenario: Collection hero with no invoices yet
- **WHEN** `summary.billing.currentMonth.invoiceTotal === 0`
- **THEN** the donut renders as a fully muted track, the center text shows `0%`, and all formatted amounts remain zero without fabricating data

#### Scenario: Month-over-month caption
- **WHEN** a prior period with invoices exists
- **THEN** a caption below the card title shows the change in percentage points versus the previous month, or states that it is unchanged

#### Scenario: Collection hero is the only Chart.js-rendered signature
- **WHEN** the dashboard renders without errors
- **THEN** the collection hero is the visually dominant element above the fold; no other UI element on the page uses a comparably large radial/donut visual

### Requirement: Dashboard annual revenue overview
The `/dashboard` page SHALL display an annual revenue surface composed of three summary metrics (`Tổng doanh thu`, `Đã thu`, `Còn lại`), a category breakdown list with share percentages, and a stacked column chart for the 12 calendar months of the current year. Each column segment SHALL represent a revenue category in canonical order (`rent`, `electricity`, `water`, `service`, `other`). Months after the current period SHALL render without columns rather than as zero. Category colors SHALL resolve per dashboard theme from `useChartTheme()` and SHALL NOT reuse status success, warning, or danger colors. The chart SHALL use Chart.js and SHALL derive axes, grid lines, and tooltip styling from `useChartTheme()`.

#### Scenario: Annual category chart displayed
- **WHEN** dashboard summary includes monthly billing trend data
- **THEN** the dashboard displays a stacked column chart with X axis = month, Y axis = currency, and only revenue categories with non-zero data

#### Scenario: Future months render empty
- **WHEN** the current period is October
- **THEN** November and December keep their axis labels but render no columns

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
The dashboard SHALL render the collection card full width with rooms and contracts as a paired row below `lg`, and three KPI columns followed by two equal detail columns and a full-width revenue section on desktop. Below `sm`, rooms and contracts SHALL render as compact tiles, and occupancy, pending, and revenue category rows SHALL follow native list-row anatomy (title and subtitle on the left, value and optional chevron on the right). Reading order SHALL be collection health, rooms, contracts, pending operations, occupancy, then annual revenue. The page SHALL have no horizontal overflow at 320, 375, 414, or 768 CSS pixels.

#### Scenario: Tablet KPI composition
- **WHEN** viewport width is between the `md` and `lg` breakpoints
- **THEN** the collection card occupies the full first row and the rooms and contracts cards share the next row

#### Scenario: Mobile composition
- **WHEN** viewport width is below the `sm` breakpoint
- **THEN** the collection card spans the full width, rooms and contracts render as two compact tiles in one row, the remaining panels stack in the defined reading order, and list values stay right-aligned on the first line of each row
