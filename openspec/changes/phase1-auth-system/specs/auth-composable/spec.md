## ADDED Requirements

### Requirement: useAuth composable exposes login and logout actions
The system SHALL provide a `useAuth()` composable in `app/composables/useAuth.ts` that exposes `login(email, password)` and `logout()` functions. `login()` calls Supabase Auth and updates the store; `logout()` calls Supabase signOut and resets all stores.

#### Scenario: Successful login updates store and redirects
- **WHEN** `login(email, password)` is called with valid credentials
- **THEN** the auth store is populated with `user` and `profile`, and the caller can redirect based on role

#### Scenario: Failed login throws with message
- **WHEN** `login(email, password)` is called with invalid credentials
- **THEN** the function throws an error with a user-readable message (no store update)

#### Scenario: Logout clears all store state
- **WHEN** `logout()` is called
- **THEN** `useAuthStore.$reset()` is called, the Supabase session is cleared, and the user is redirected to `/login`

### Requirement: useAuth composable exposes role-based computed flags
The system SHALL expose `isAdmin`, `isManager`, and `isTenant` as computed refs derived from `useAuthStore().profile.role`. These are read-only and reactive.

#### Scenario: isAdmin is true for admin role
- **WHEN** the auth store has `profile.role === 'admin'`
- **THEN** `isAdmin.value` is `true` and `isManager.value`, `isTenant.value` are `false`

#### Scenario: isAdmin is false when not logged in
- **WHEN** the auth store has no profile
- **THEN** all three flags are `false`

### Requirement: useAuth composable exposes hasPermission helper
The system SHALL expose a `hasPermission(role: Role)` function that returns `true` if the current user's role matches or is higher privilege (admin > manager > tenant).

#### Scenario: Admin has permission for manager-level access
- **WHEN** `hasPermission('manager')` is called with an authenticated admin
- **THEN** it returns `true`

#### Scenario: Tenant does not have manager permission
- **WHEN** `hasPermission('manager')` is called with an authenticated tenant
- **THEN** it returns `false`

### Requirement: useAuth composable exposes fetchProfile
The system SHALL expose `fetchProfile()` that calls `GET /api/auth/me` and updates the store. Does nothing if profile is already cached.

#### Scenario: fetchProfile populates store on first call
- **WHEN** `fetchProfile()` is called with no cached profile
- **THEN** the store's `user` and `profile` are populated from the API response

#### Scenario: fetchProfile is a no-op on subsequent calls
- **WHEN** `fetchProfile()` is called when profile is already cached
- **THEN** no API call is made

### Requirement: Per-role middleware files guard pages declaratively
The system SHALL provide `admin.ts`, `manager.ts`, and `tenant.ts` middleware files that pages can declare via `definePageMeta`. Each checks the current user's role and throws 403 if the role does not match.

#### Scenario: Admin middleware blocks non-admin
- **WHEN** a manager navigates to a page with `middleware: ['auth', 'admin']`
- **THEN** they are redirected to `/login` with an unauthorized message

#### Scenario: Manager middleware allows admin
- **WHEN** an admin navigates to a page with `middleware: ['auth', 'manager']`
- **THEN** access is allowed (admin is a superset of manager)
