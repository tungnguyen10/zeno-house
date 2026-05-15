## Purpose

UI spec cho dashboard page (`/`). Hiển thị stat cards và building occupancy table.

## Requirements

### Requirement: Dashboard stat cards
The `/` page SHALL display 4 stat cards: total buildings, total rooms (with breakdown tooltip/subtitle), total tenants, active contracts. Each card uses `AppStatCard` component. Shows loading skeleton while data is fetching.

#### Scenario: Stats load and display
- **WHEN** admin navigates to /
- **THEN** 4 stat cards display real data: buildings count, rooms count, tenants count, active contracts count

#### Scenario: Loading state
- **WHEN** data is being fetched
- **THEN** skeleton placeholders shown in place of stat values

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
