## ADDED Requirements

### Requirement: Room links support building-scoped slugs
Room UI links SHALL prefer building-scoped readable URLs when building slug and room slug are available, while preserving existing `/rooms/:id` links.

#### Scenario: Room link uses building and room slug
- **WHEN** a room has building slug `toa-a` and room slug `a101`
- **THEN** the preferred room detail link is `/buildings/toa-a/rooms/a101`

#### Scenario: Room link falls back to id
- **WHEN** a room does not have enough slug context
- **THEN** the UI can link to `/rooms/<id>`

### Requirement: Room detail accepts id route and scoped route
The room detail UI SHALL be reachable from existing UUID room URLs and from building-scoped room slug URLs.

#### Scenario: Existing room id URL works
- **WHEN** user opens `/rooms/<uuid>`
- **THEN** the room detail page loads the matching room

#### Scenario: Scoped room slug URL works
- **WHEN** user opens `/buildings/toa-a/rooms/a101`
- **THEN** the room detail page loads room A101 in building Toa A
