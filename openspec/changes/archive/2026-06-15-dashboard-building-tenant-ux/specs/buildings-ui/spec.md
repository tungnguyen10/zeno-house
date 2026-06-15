## ADDED Requirements

### Requirement: Building pages use slug links
Building list cards, detail links, edit links, settings links, and related navigation SHALL prefer `/buildings/<slug>` URLs when a building slug is available. Existing UUID URLs SHALL continue to resolve.

#### Scenario: Building card links by slug
- **WHEN** a building card renders a building with slug `toa-a`
- **THEN** the card links to `/buildings/toa-a`

#### Scenario: Existing UUID detail URL still works
- **WHEN** user opens `/buildings/<uuid>` for an existing building
- **THEN** the detail page loads that building successfully

### Requirement: Building service summary on list and detail
Building list and detail surfaces SHALL show a concise summary of building-level services, including active service count and visible active service names when space allows.

#### Scenario: Service summary displayed on building list
- **WHEN** building list data includes service summary
- **THEN** each building card displays active service count and a concise active service label list

#### Scenario: Service summary displayed on detail
- **WHEN** user opens building detail
- **THEN** the page displays active services and provides a clear path to manage service settings

### Requirement: Fast building service toggle
Building detail SHALL allow admin users to toggle building-level service active state without first opening the full settings page. The UI SHALL use existing building service APIs and refresh the service summary after changes.

#### Scenario: Admin toggles service active state
- **WHEN** admin toggles an active building service off from building detail
- **THEN** the service is updated and the detail summary reflects the new inactive state

#### Scenario: Manager cannot toggle service
- **WHEN** manager views building detail
- **THEN** service toggles are not editable

### Requirement: Building detail removes redundant month operation CTA
Building detail SHALL not show a month-specific "Van hanh thang <month>" primary action when the billing or operations workflow is already available through clearer navigation.

#### Scenario: Redundant operation button hidden
- **WHEN** user views building detail
- **THEN** the header actions do not include the old month-specific operation button
