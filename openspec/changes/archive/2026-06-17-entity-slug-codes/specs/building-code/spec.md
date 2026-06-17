## ADDED Requirements

### Requirement: buildings.code column exists and is populated
The `buildings` table SHALL include a non-null `code` column. On creation, the system SHALL auto-generate `code` as the first character of each hyphen-separated word in `building.slug`, lowercase. If the generated code already exists, a numeric suffix SHALL be appended until unique (`zhpn`, `zhpn2`, `zhpn3`…). Existing buildings SHALL be backfilled by migration.

#### Scenario: Code generated from slug
- **WHEN** a building with slug `zeno-house-phu-nhuan` is created
- **THEN** `buildings.code` is set to `zhpn`

#### Scenario: Code conflict resolved with suffix
- **WHEN** `zhpn` already exists and a new building with the same initials is created
- **THEN** `buildings.code` is set to `zhpn2`

#### Scenario: Existing buildings backfilled
- **WHEN** the `add_building_codes` migration is applied
- **THEN** every existing building row has a non-empty `code` derived from its slug

#### Scenario: Code uniqueness enforced at DB level
- **WHEN** two buildings would produce the same code
- **THEN** the database unique index on `buildings.code` prevents duplicate values

---

### Requirement: buildings.code is immutable after first room exists
`buildings.code` SHALL be editable via the building settings API only while the building has zero rooms. Once at least one room exists, any attempt to change `code` SHALL be rejected with a 409 CONFLICT.

#### Scenario: Code editable before rooms
- **WHEN** admin PATCHes `code` on a building with no rooms
- **THEN** the update succeeds and new code is stored

#### Scenario: Code locked after first room
- **WHEN** admin PATCHes `code` on a building that has at least one room
- **THEN** returns 409 CONFLICT: "Building code cannot be changed after rooms have been created"

---

### Requirement: Building DTO includes code
`Building` DTO returned by `GET /api/buildings/:id` and `GET /api/buildings` SHALL include `code: string`.

#### Scenario: Code in list response
- **WHEN** admin calls GET /api/buildings
- **THEN** each building object includes a non-empty `code` field

#### Scenario: Code in detail response
- **WHEN** admin calls GET /api/buildings/:id
- **THEN** building object includes a non-empty `code` field
