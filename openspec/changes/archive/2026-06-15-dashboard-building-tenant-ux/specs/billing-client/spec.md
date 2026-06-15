## ADDED Requirements

### Requirement: Billing workspace route prefers building slug
Billing workspace links SHALL prefer building slug and period routes, for example `/billing/toa-a/2026-06`, while existing building UUID period links remain valid.

#### Scenario: Billing workspace link uses building slug
- **WHEN** a billing period row has building slug `toa-a` and period `2026-06`
- **THEN** the open action links to `/billing/toa-a/2026-06`

#### Scenario: Billing workspace link falls back to id
- **WHEN** building slug is unavailable
- **THEN** the open action can link to `/billing/<buildingId>/2026-06`

### Requirement: Billing workflow links use slug-aware destinations
Dashboard pending-operation links and building detail billing links SHALL use building slug plus period when available.

#### Scenario: Dashboard pending operation link
- **WHEN** a pending operation item references building slug `toa-a` and period `2026-06`
- **THEN** its workflow link targets `/billing/toa-a/2026-06`
