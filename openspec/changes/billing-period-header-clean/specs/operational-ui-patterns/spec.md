## MODIFIED Requirements

### Requirement: Operational page structure
Operational pages SHALL use a consistent structure for page context, filters, summary, and content.

#### Scenario: Page header pattern
- **WHEN** a new operational page is built
- **THEN** it uses a compact page header with title, optional description/context, optional back-navigation affordance, and action slot

#### Scenario: Detail-page back navigation
- **WHEN** a detail or workspace page is reached from a list page
- **THEN** the page header SHALL render an optional back-link above the title (icon + label) instead of placing the back action inside the action slot

#### Scenario: Filter toolbar pattern
- **WHEN** a page has filters or search
- **THEN** filters are grouped in a toolbar using consistent control height and spacing

#### Scenario: Summary metrics pattern
- **WHEN** a page shows operational totals
- **THEN** it uses compact metrics suitable for scanning rather than oversized dashboard cards

#### Scenario: Summary metrics non-duplication
- **WHEN** a page exposes a sticky/top-level summary metric strip AND tab-internal summary blocks
- **THEN** tab summaries SHALL NOT repeat metrics already present in the top-level strip; tab summaries either show drill-down metrics specific to the tab or omit the summary block entirely
