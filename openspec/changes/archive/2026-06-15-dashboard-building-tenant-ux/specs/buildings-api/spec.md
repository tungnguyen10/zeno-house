## ADDED Requirements

### Requirement: Building responses include slug and service summary
Building list and detail API responses SHALL include `slug` and building service summary fields needed by the building UI.

#### Scenario: List response includes slug and services
- **WHEN** authenticated user calls GET /api/buildings
- **THEN** each returned building includes `slug` and service summary data

#### Scenario: Detail response includes slug and services
- **WHEN** authenticated user calls GET /api/buildings/:identifier
- **THEN** the returned building includes `slug` and service summary data

### Requirement: GET /api/buildings/:identifier supports id or slug
`server/api/buildings/[id].get.ts` SHALL treat the route parameter as an identifier and find a building by UUID id when it is a UUID, otherwise by slug.

#### Scenario: Lookup building by id
- **WHEN** authenticated user sends GET /api/buildings/<uuid>
- **THEN** response 200 returns the matching building

#### Scenario: Lookup building by slug
- **WHEN** authenticated user sends GET /api/buildings/toa-a
- **THEN** response 200 returns the matching building

#### Scenario: Unknown slug
- **WHEN** authenticated user sends GET /api/buildings/unknown-building
- **THEN** response 404 with `error.code === 'NOT_FOUND'`
