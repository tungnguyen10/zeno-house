## ADDED Requirements

### Requirement: Buildings carry an admin-controlled visibility flag
A building SHALL carry a boolean `is_hidden` flag, exposed to clients as `isHidden`, defaulting to false and independent of `status`. Archiving a building SHALL NOT change its visibility, and hiding a building SHALL NOT change its status.

#### Scenario: New building is visible
- **WHEN** a building is created
- **THEN** `isHidden` is false

#### Scenario: Archiving does not hide
- **WHEN** a building is archived and its `status` becomes `inactive`
- **THEN** `isHidden` remains unchanged

### Requirement: Only administrators change building visibility
Changing visibility SHALL require the `buildings.visibility.manage` capability, which SHALL be granted to admin only. Owners and managers SHALL NOT change visibility even for buildings inside their assignment scope.

#### Scenario: Admin hides a building
- **WHEN** an admin sends PATCH /api/buildings/:id/visibility with `{ is_hidden: true }`
- **THEN** response 200 with `{ data: Building }` where `isHidden` is true

#### Scenario: Owner is refused
- **WHEN** an owner sends PATCH /api/buildings/:id/visibility for an assigned building
- **THEN** response 403 with `error.code === 'FORBIDDEN'`

#### Scenario: Visibility is not part of the generic update
- **WHEN** any user sends PATCH /api/buildings/:id with a visibility field in the body
- **THEN** the field is ignored and visibility is unchanged

### Requirement: Visibility changes are audited
A successful visibility change SHALL append an audit event with the building id, the `BUILDING_VISIBILITY_CHANGED` action, entity type `building`, and before/after snapshots.

#### Scenario: Hiding writes an audit event
- **WHEN** an admin hides a building
- **THEN** an audit event records the actor, the building, and the before/after visibility

### Requirement: Building list hides hidden buildings
`GET /api/buildings` SHALL omit hidden buildings by default. It SHALL accept `include_hidden=true` to return them, and SHALL reject that flag for non-admin callers.

#### Scenario: Hidden building omitted by default
- **WHEN** an authenticated user lists buildings and one building is hidden
- **THEN** the hidden building is absent from `data` and not counted in `meta.total`

#### Scenario: Admin enumerates hidden buildings
- **WHEN** an admin lists buildings with `include_hidden=true`
- **THEN** hidden buildings are present and carry `isHidden: true`

#### Scenario: Non-admin cannot enumerate hidden buildings
- **WHEN** an owner or manager lists buildings with `include_hidden=true`
- **THEN** response 403 with `error.code === 'FORBIDDEN'`

### Requirement: Hidden buildings remain reachable by direct access
`GET /api/buildings/:id` and every detail or write endpoint scoped to a building SHALL continue to resolve for a hidden building, subject only to the caller's assignment scope and capabilities.

#### Scenario: Detail read of a hidden building
- **WHEN** a user with the building in scope requests GET /api/buildings/:id for a hidden building
- **THEN** response 200 with `{ data: Building }` where `isHidden` is true

#### Scenario: Records inside a hidden building stay reachable
- **WHEN** a user opens a room, contract, or invoice that belongs to a hidden building by its identifier
- **THEN** the record resolves normally
