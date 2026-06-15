## Purpose

UI spec cho dashboard page (`/`). Hiển thị stat cards và building occupancy table.
## Requirements
### Requirement: Dashboard stat cards
The `/` page SHALL display operational KPI cards for room status, contract status, and current-month billing health. Room KPIs SHALL include available, occupied, and maintenance room counts. Contract KPIs SHALL include active contracts and expiring-soon contracts. Billing KPIs SHALL include current-month invoice total, paid amount, and outstanding amount. KPI cards SHALL use the existing operational card style and SHALL show loading skeletons while data is fetching.

#### Scenario: Stats load and display
- **WHEN** admin navigates to /
- **THEN** the dashboard displays real room-status, contract-status, and current-month billing KPIs

#### Scenario: Loading state
- **WHEN** dashboard summary data is being fetched
- **THEN** skeleton placeholders are shown in place of KPI values

### Requirement: Building occupancy table
The `/` page SHALL display a table/list showing each building's room occupancy: building name, total rooms, available count (green), occupied count (cyan), maintenance count (yellow). Each row links to `/rooms?buildingId=<id>`.

#### Scenario: Building breakdown displayed
- **WHEN** buildings with rooms exist
- **THEN** each building shown as a row with colored room counts (available, occupied, maintenance always visible)

#### Scenario: Empty buildings
- **WHEN** a building has no rooms
- **THEN** row shows 0 for all counts

#### Scenario: No buildings yet
- **WHEN** buildingBreakdown is empty
- **THEN** empty state message shown in the table section

### Requirement: AppStatCard component
`AppStatCard` SHALL be a shell component at `app/components/app/AppStatCard.vue`. Props: `title` (string), `value` (string | number), `description` (optional string). Renders a card with dark surface background matching existing card styles.

#### Scenario: Renders title and value
- **WHEN** AppStatCard receives title="Tòa nhà" value=5
- **THEN** displays "Tòa nhà" label and "5" as prominent value

### Requirement: Dashboard occupancy chart
The `/` page SHALL display an occupancy-by-building chart showing available, occupied, and maintenance room counts for each building.

#### Scenario: Occupancy chart displayed
- **WHEN** dashboard summary includes building occupancy data
- **THEN** each building is represented with segmented or grouped visual bars for available, occupied, and maintenance rooms

#### Scenario: Empty occupancy chart
- **WHEN** no buildings exist
- **THEN** the dashboard shows an empty state in the occupancy chart section

### Requirement: Dashboard revenue and debt chart
The `/` page SHALL display a month-by-month revenue/debt chart using paid amount and outstanding amount for recent billing months.

#### Scenario: Revenue debt chart displayed
- **WHEN** dashboard summary includes monthly billing trend data
- **THEN** the dashboard displays paid and outstanding amounts by month

#### Scenario: Revenue debt empty state
- **WHEN** no billing trend data exists
- **THEN** the dashboard shows an empty state in the revenue/debt chart section

### Requirement: Dashboard operations action table
The `/` page SHALL display a pending operations table for the current month, including buildings or periods with missing meter readings, unissued invoices, or overdue invoices.

#### Scenario: Pending work displayed
- **WHEN** dashboard summary includes pending operation items
- **THEN** the dashboard lists the item type, building, period, count, severity, and a link to the relevant workflow

#### Scenario: No pending work
- **WHEN** no pending operation items exist
- **THEN** the dashboard shows a clear empty state for the pending operations section

