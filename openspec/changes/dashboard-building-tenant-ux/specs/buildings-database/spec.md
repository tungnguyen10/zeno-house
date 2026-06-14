## ADDED Requirements

### Requirement: Buildings have unique slugs
The `buildings` table SHALL include a non-null `slug` column. Existing rows SHALL be backfilled from `name`, and slugs SHALL be unique across buildings.

#### Scenario: Existing buildings receive slugs
- **WHEN** the slug migration is applied
- **THEN** every existing building row has a non-empty slug derived from its name

#### Scenario: Slug uniqueness enforced
- **WHEN** two building names normalize to the same slug
- **THEN** the stored slugs remain unique

#### Scenario: New building receives slug
- **WHEN** a new building is created without an explicit slug
- **THEN** the system stores a unique slug derived from the building name
