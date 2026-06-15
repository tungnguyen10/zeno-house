## ADDED Requirements

### Requirement: Room API supports scoped slug lookup
Room read APIs SHALL support lookup by UUID id and by building identifier plus room slug where scoped room URLs are used.

#### Scenario: Lookup room by id
- **WHEN** authenticated user requests a room by UUID id
- **THEN** the API returns the matching room DTO

#### Scenario: Lookup room by building slug and room slug
- **WHEN** authenticated user requests room `a101` under building slug `toa-a`
- **THEN** the API returns the matching room DTO for that building

#### Scenario: Unknown scoped room slug
- **WHEN** authenticated user requests unknown room slug under a valid building
- **THEN** the API returns 404 NOT_FOUND
