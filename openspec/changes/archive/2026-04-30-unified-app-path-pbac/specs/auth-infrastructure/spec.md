## MODIFIED Requirements

### Requirement: Role middleware enforces role-based route access
The system SHALL replace the URL-prefix-based `role.ts` middleware with an `app-guard.ts` middleware. The new middleware checks that the user has `role = 'admin'` or `role = 'manager'` to access `/app/*` routes. The old `role.ts`, `admin.ts`, and `manager.ts` middleware files SHALL be removed.

#### Scenario: Admin accesses /app routes
- **WHEN** a user with `role = 'admin'` navigates to `/app/rooms`
- **THEN** the page renders normally

#### Scenario: Manager accesses /app routes
- **WHEN** a user with `role = 'manager'` navigates to `/app/rooms`
- **THEN** the page renders normally

#### Scenario: Tenant blocked from /app routes
- **WHEN** a user with `role = 'tenant'` navigates to `/app`
- **THEN** they are redirected to `/login`

#### Scenario: Unauthenticated user blocked from /app routes
- **WHEN** an unauthenticated user navigates to `/app`
- **THEN** they are redirected to `/login`

## ADDED Requirements

### Requirement: usePermissionsStore is loaded after successful login
The system SHALL call `usePermissionsStore().loadPermissions()` as part of the post-login flow so that permissions are available before the first `/app/*` page renders.

#### Scenario: Permissions available on first page load after login
- **WHEN** a manager logs in and is redirected to `/app`
- **THEN** `usePermissionsStore.grants` is already populated before the dashboard component mounts

#### Scenario: Permissions available on hard refresh
- **WHEN** a manager hard-refreshes a page at `/app/rooms`
- **THEN** `usePermissionsStore.loadPermissions()` is called in the `app-guard` middleware if grants are empty, ensuring the page renders with correct permissions

## REMOVED Requirements

### Requirement: Role middleware enforces role-based route access (old URL-prefix version)
**Reason**: Replaced by `app-guard.ts` which checks role membership (`admin` | `manager`) without relying on URL prefix
**Migration**: Remove `app/middleware/role.ts`, `app/middleware/admin.ts`, `app/middleware/manager.ts`. Update all `definePageMeta` to use `middleware: ['auth', 'app-guard']`
