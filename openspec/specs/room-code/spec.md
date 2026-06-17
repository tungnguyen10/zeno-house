## Purpose
Defines the slug and globally unique code identifiers for rooms, enabling human-readable and stable room URLs independent of building context.

## Requirements

### Requirement: rooms.slug column exists and is scoped per building
The `rooms` table SHALL include a `slug` column. On creation, `slug` SHALL be set to `slugify(room_number)`. The combination `(building_id, slug)` SHALL be unique. Existing rooms SHALL be backfilled by migration.

#### Scenario: Slug generated from room_number
- **WHEN** a room with `room_number = "B201"` is created
- **THEN** `rooms.slug` is set to `b201`

#### Scenario: Slug uniqueness scoped to building
- **WHEN** two different buildings each have a room `b201`
- **THEN** both rows are valid — uniqueness is enforced per building, not globally

#### Scenario: Slug collision within same building rejected
- **WHEN** a room is created in a building that already has a room with `slug = "b201"`
- **THEN** the database unique constraint `UNIQUE(building_id, slug)` rejects the insert

#### Scenario: Existing rooms backfilled
- **WHEN** the `add_room_slugs_codes` migration is applied
- **THEN** every existing room row has a non-empty `slug` derived from `room_number`

---

### Requirement: rooms.code column exists and is globally unique
The `rooms` table SHALL include a `code` column. `code` SHALL be computed as `{building.code}-{room.slug}` and stored at creation time. `code` SHALL be globally unique across all rooms. Existing rooms SHALL be backfilled by migration.

#### Scenario: Code composed from building code and room slug
- **WHEN** a room with slug `b201` belongs to a building with code `zhpn`
- **THEN** `rooms.code` is `zhpn-b201`

#### Scenario: Code uniqueness enforced at DB level
- **WHEN** two rooms in different buildings would produce the same code (impossible given building code uniqueness, but enforced regardless)
- **THEN** the database unique index on `rooms.code` prevents duplicate values

#### Scenario: Existing rooms backfilled with correct code
- **WHEN** the `add_room_slugs_codes` migration is applied
- **THEN** every room has `code = building.code || '-' || room.slug`

---

### Requirement: Room API resolves by code or UUID
`GET /api/rooms/:identifier` SHALL accept either a UUID or a `rooms.code` value. When `identifier` is not a UUID, the server SHALL look up by `code` column.

#### Scenario: Fetch room by code
- **WHEN** admin calls GET /api/rooms/zhpn-b201
- **THEN** returns the room with code `zhpn-b201`

#### Scenario: Fetch room by UUID still works
- **WHEN** admin calls GET /api/rooms/:uuid
- **THEN** returns the matching room (backward compatibility)

#### Scenario: Unknown identifier returns 404
- **WHEN** identifier matches neither UUID nor code
- **THEN** returns 404 NOT_FOUND

---

### Requirement: Room DTO includes slug and code
Room DTOs returned by the API SHALL include `slug: string` and `code: string`.

#### Scenario: Room list includes slug and code
- **WHEN** admin calls GET /api/rooms or GET /api/buildings/:id/rooms
- **THEN** each room object includes non-empty `slug` and `code` fields

#### Scenario: Room detail includes slug and code
- **WHEN** admin calls GET /api/rooms/:identifier
- **THEN** room object includes non-empty `slug` and `code` fields
