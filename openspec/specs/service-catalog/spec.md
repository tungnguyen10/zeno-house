## Purpose

Defines service catalog behavior used by building-level and contract-level billable services.

## Requirements

### Requirement: List default and building custom service catalog items
`GET /api/service-catalog` SHALL require auth and `building-services.read`. When `building_id` is provided, the response SHALL include global catalog items plus custom catalog items scoped to that building. When `building_id` is omitted, the response SHALL include only global catalog items.

#### Scenario: List catalog for a building
- **WHEN** an authenticated user with access to building `B` calls `GET /api/service-catalog?building_id=B`
- **THEN** the response includes global services and services whose `buildingId` is `B`
- **AND** it excludes custom services from other buildings

#### Scenario: List global catalog
- **WHEN** an authenticated user calls `GET /api/service-catalog` without `building_id`
- **THEN** the response includes only services with no building scope

#### Scenario: Read requires permission and scope
- **WHEN** a user lacks `building-services.read` or cannot access the requested building
- **THEN** the API rejects the request

### Requirement: Create building custom service catalog item
`POST /api/service-catalog` SHALL require auth and `building-services.write`, validate name, pricing type, unit, and description, resolve `building_id` by id or slug, and create a catalog item scoped only to that building.

#### Scenario: Create custom service
- **WHEN** a scoped user posts a valid service for building `B`
- **THEN** the API creates a service catalog item with `buildingId = B`
- **AND** the item appears in subsequent catalog lists for `B`

#### Scenario: Duplicate custom service name
- **WHEN** building `B` already has a custom service with the same name
- **THEN** the API rejects the request with a conflict

#### Scenario: Custom service does not leak to other buildings
- **WHEN** building `B` has a custom service and building `C` lists its catalog
- **THEN** the response for `C` does not include building `B`'s custom service
