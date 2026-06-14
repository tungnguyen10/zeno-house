## ADDED Requirements

### Requirement: Billing APIs accept building id or slug
Billing period and workspace APIs SHALL accept a building identifier that can be either UUID id or building slug, resolving it to the building id before querying or mutating billing data.

#### Scenario: Open period by building id
- **WHEN** the API receives building UUID and period `2026-06`
- **THEN** it opens or retrieves the billing period for that building

#### Scenario: Open period by building slug
- **WHEN** the API receives building slug `toa-a` and period `2026-06`
- **THEN** it resolves the slug and opens or retrieves the billing period for that building

#### Scenario: Unknown building slug
- **WHEN** the API receives unknown building slug for a billing period request
- **THEN** it returns 404 NOT_FOUND
