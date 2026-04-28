## ADDED Requirements

### Requirement: requireBuildingPermission utility enforces per-building feature access
The system SHALL provide a `requireBuildingPermission(event, buildingId, feature)` utility in `server/utils/requireBuildingPermission.ts`. Admin users bypass the check. Manager users must have a matching `building_managers` row with the given feature in `permissions`.

#### Scenario: Admin bypasses building permission check
- **WHEN** a server route calls `requireBuildingPermission(event, 'bldg-1', 'rooms')` and the user has `role = 'admin'`
- **THEN** the utility returns without throwing

#### Scenario: Manager with permission passes
- **WHEN** `requireBuildingPermission(event, 'bldg-1', 'rooms')` is called and the manager has a `building_managers` row for `bldg-1` with `'rooms'` in `permissions`
- **THEN** the utility returns without throwing

#### Scenario: Manager without building grant is rejected
- **WHEN** `requireBuildingPermission(event, 'bldg-99', 'rooms')` is called and the manager has no row for `bldg-99`
- **THEN** the utility throws a 403 error "Forbidden"

#### Scenario: Manager with building grant but missing feature is rejected
- **WHEN** `requireBuildingPermission(event, 'bldg-1', 'contracts')` is called and the manager's `building_managers.permissions` for `bldg-1` does not include `'contracts'`
- **THEN** the utility throws a 403 error "Forbidden"

#### Scenario: Unauthenticated request is rejected before permission check
- **WHEN** `requireBuildingPermission` is called with no valid session
- **THEN** the utility throws a 401 error "Unauthorized"
