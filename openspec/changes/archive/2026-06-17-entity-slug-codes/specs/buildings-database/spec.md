## ADDED Requirements

### Requirement: buildings table has unique code column
The `buildings` table SHALL include a non-null `code` column of type `text`. A unique index SHALL be enforced on `buildings(code)`. The migration SHALL backfill codes for all existing buildings before applying the NOT NULL constraint.

#### Scenario: Migration adds code column
- **WHEN** the `add_building_codes` migration is applied
- **THEN** `buildings` table has a non-null `code` column with a unique index

#### Scenario: Tables<'buildings'> type includes code
- **WHEN** developer uses `Tables<'buildings'>`
- **THEN** TypeScript type includes `code: string` in the Row shape

---

### Requirement: Building code edit is validated server-side
`PATCH /api/buildings/:id` SHALL accept an optional `code` field. If provided and the building has at least one room, the request SHALL be rejected with 409 CONFLICT. If provided and the building has no rooms, the new code SHALL be validated as non-empty, lowercase alphanumeric, and unique before being stored.

#### Scenario: Code update accepted when no rooms
- **WHEN** admin PATCHes `code` on a building with zero rooms
- **THEN** the building code is updated and 200 is returned

#### Scenario: Code update rejected when rooms exist
- **WHEN** admin PATCHes `code` on a building that has rooms
- **THEN** returns 409 CONFLICT

#### Scenario: Duplicate code rejected
- **WHEN** admin PATCHes `code` to a value already used by another building
- **THEN** returns 409 CONFLICT
