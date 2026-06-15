## ADDED Requirements

### Requirement: Building DTO includes slug
`Building` SHALL include `slug: string` so UI routes can use stable user-facing URLs.

#### Scenario: Building slug available to components
- **WHEN** a component receives a `Building`
- **THEN** it can read `building.slug` and use it for links

### Requirement: Building DTO includes service summary
`Building` list/detail DTOs SHALL include a service summary suitable for building cards and detail headers.

#### Scenario: Building service summary available
- **WHEN** building list data is fetched
- **THEN** each building item includes active service count and active service names or items

### Requirement: Building detail composable accepts id or slug
`useBuildingDetail(identifier)` SHALL accept either a UUID id or a slug string and fetch the corresponding building through the existing building detail API.

#### Scenario: Fetch by slug
- **WHEN** `useBuildingDetail('toa-a')` is initialized
- **THEN** it fetches and exposes the matching building
