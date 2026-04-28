## ADDED Requirements

### Requirement: usePermissionsStore loads and caches building grants for the current user
The system SHALL have a `usePermissionsStore` Pinia store that fetches `GET /api/me/permissions` after login and caches the result. The endpoint returns the current user's `building_managers` rows. The store MUST be cleared on logout.

#### Scenario: Store loads permissions after login
- **WHEN** a manager logs in successfully
- **THEN** `usePermissionsStore.loadPermissions()` is called and `grants` is populated with their building_managers records

#### Scenario: Admin store always returns full access
- **WHEN** the current user has `role = 'admin'`
- **THEN** `hasPermission(buildingId, feature)` returns `true` for any `buildingId` and `feature` without querying the database

#### Scenario: Permissions cleared on logout
- **WHEN** the user logs out
- **THEN** `usePermissionsStore.$reset()` is called and `grants` becomes an empty array

### Requirement: hasPermission composable checks building-feature access
The store SHALL expose a `hasPermission(buildingId: string, feature: string): boolean` method that returns `true` if the current user (admin or manager with a matching grant) may access the given feature in the given building.

#### Scenario: Manager with grant returns true
- **WHEN** `hasPermission('bldg-1', 'rooms')` is called and the store has a grant `{building_id: 'bldg-1', permissions: ['rooms', 'invoices']}`
- **THEN** `true` is returned

#### Scenario: Manager without grant returns false
- **WHEN** `hasPermission('bldg-1', 'contracts')` is called and the store has a grant for `bldg-1` but `permissions` does not include `'contracts'`
- **THEN** `false` is returned

#### Scenario: No grant for building returns false
- **WHEN** `hasPermission('bldg-99', 'rooms')` is called and the store has no row for `bldg-99`
- **THEN** `false` is returned

### Requirement: hasAnyPermission checks cross-building feature access
The store SHALL expose `hasAnyPermission(feature: string): boolean` that returns `true` if the user has at least one building grant that includes the given feature. Used to show/hide top-level nav items.

#### Scenario: Manager with at least one building grant for feature
- **WHEN** `hasAnyPermission('rooms')` is called and the store has one or more grants where `permissions` includes `'rooms'`
- **THEN** `true` is returned

#### Scenario: Manager with zero grants for feature
- **WHEN** `hasAnyPermission('contracts')` is called and no grant includes `'contracts'`
- **THEN** `false` is returned

### Requirement: GET /api/me/permissions returns current user's building grants
The system SHALL expose a `GET /api/me/permissions` server route that returns an array of `{ building_id, building_name, permissions }` objects for the authenticated user. Admin users receive a synthetic response indicating full access.

#### Scenario: Manager receives their grants
- **WHEN** a manager calls `GET /api/me/permissions`
- **THEN** the response is an array of `{ building_id, building_name, permissions }` for buildings they manage

#### Scenario: Admin receives full-access indicator
- **WHEN** an admin calls `GET /api/me/permissions`
- **THEN** the response contains `{ isAdmin: true }` allowing the client store to bypass per-permission checks

#### Scenario: Unauthenticated request returns 401
- **WHEN** an unauthenticated user calls `GET /api/me/permissions`
- **THEN** the server responds with HTTP 401 Unauthorized
