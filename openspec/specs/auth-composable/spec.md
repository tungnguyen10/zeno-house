## Requirements

### Requirement: useAuth composable exposes login and logout actions
The system SHALL provide a `useAuth()` composable in `app/composables/useAuth.ts` that exposes `login(email, password)`, `logout()`, and `signOut()` functions.

- `login()` calls `supabase.auth.signInWithPassword()` then queries the `profiles` table directly via the Supabase client (not via `/api/auth/me`) to populate the store immediately — this avoids the SSR cookie timing issue where the server-side API call fires before the session cookie is set. If no profile row exists, the session is cleared and an error is thrown.
- `logout()` calls `signOut()` then redirects to `/login`.
- `signOut()` clears the Supabase session and resets the store without redirecting — used when the caller needs to handle navigation itself (e.g. blocking wrong-role login).

#### Scenario: Successful login updates store and redirects
- **WHEN** `login(email, password)` is called with valid credentials
- **THEN** the auth store is populated with `user` and `profile` via direct Supabase client query, and the caller can redirect based on role

#### Scenario: Login with no profile row signs out and throws
- **WHEN** `login(email, password)` is called and no `profiles` row exists for the user
- **THEN** the Supabase session is cleared and an `invalid_credentials` error is thrown

#### Scenario: Failed login throws with message
- **WHEN** `login(email, password)` is called with invalid credentials
- **THEN** the function throws an error with a user-readable message (no store update)

#### Scenario: Logout clears all store state
- **WHEN** `logout()` is called
- **THEN** `useAuthStore.$reset()` is called, the Supabase session is cleared, and the user is redirected to `/login`

#### Scenario: signOut clears state without redirect
- **WHEN** `signOut()` is called
- **THEN** `useAuthStore.$reset()` is called and the Supabase session is cleared, but no navigation occurs

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

### Requirement: useAuth composable exposes Google OAuth login
The system SHALL expose `loginWithGoogle()` that calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with `redirectTo` set to `{origin}/auth/callback`. On success, the browser is redirected to Google's consent page — no store update occurs at this point.

#### Scenario: Google login redirects to provider
- **WHEN** `loginWithGoogle()` is called
- **THEN** the browser is redirected to Google's OAuth consent page

#### Scenario: Google login error surfaces to caller
- **WHEN** Supabase returns an error from `signInWithOAuth`
- **THEN** `loginWithGoogle()` throws with the Supabase error message

### Requirement: Per-role middleware files guard pages declaratively
The system SHALL provide `admin.ts`, `manager.ts`, and `tenant.ts` middleware files that pages can declare via `definePageMeta`. Each checks the current user's role and redirects to `/login` if the role does not match. Must always be paired with the `auth` middleware: `definePageMeta({ middleware: ['auth', 'admin'] })`.

#### Scenario: Admin middleware blocks non-admin
- **WHEN** a manager navigates to a page with `middleware: ['auth', 'admin']`
- **THEN** they are redirected to `/login`

#### Scenario: Manager middleware allows admin
- **WHEN** an admin navigates to a page with `middleware: ['auth', 'manager']`
- **THEN** access is allowed (admin is a superset of manager)
