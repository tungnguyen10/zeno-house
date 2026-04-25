## Requirements

### Requirement: server/api/auth/me returns authenticated user profile
The system SHALL expose a `GET /api/auth/me` server route that returns the authenticated user's `id`, `email`, `role`, and `full_name` from the `profiles` table. Returns 401 if the request is unauthenticated.

#### Scenario: Authenticated user gets profile
- **WHEN** an authenticated user calls `GET /api/auth/me`
- **THEN** the response includes `id`, `email`, `role`, and `full_name`

#### Scenario: Unauthenticated request is rejected
- **WHEN** an unauthenticated request calls `GET /api/auth/me`
- **THEN** the server responds with HTTP 401 Unauthorized

#### Scenario: Role null when profile missing
- **WHEN** an authenticated user has no `profiles` row (e.g. created before trigger)
- **THEN** `role` is returned as `null` and the client redirects to `/tenant` by default

### Requirement: Auth middleware protects all non-public routes
The system SHALL have an `auth.ts` Nuxt route middleware that redirects unauthenticated users to `/login`.

#### Scenario: Unauthenticated access to protected route
- **WHEN** an unauthenticated user navigates to any route other than `/login`
- **THEN** they are redirected to `/login`

#### Scenario: Authenticated user passes through
- **WHEN** an authenticated user navigates to a protected route
- **THEN** the page renders without redirect

### Requirement: Role middleware enforces role-based route access
The system SHALL have a `role.ts` Nuxt route middleware that checks the user's role against the route prefix (`/admin`, `/manager`, `/tenant`) and redirects to `/login` on mismatch.

#### Scenario: Admin accesses /admin routes
- **WHEN** a user with `role = 'admin'` navigates to `/admin/rooms`
- **THEN** the page renders normally

#### Scenario: Tenant blocked from /admin routes
- **WHEN** a user with `role = 'tenant'` navigates to `/admin`
- **THEN** they are redirected to `/login`

#### Scenario: Admin can access /manager routes
- **WHEN** a user with `role = 'admin'` navigates to `/manager`
- **THEN** access is allowed (admin is a superset of manager)

### Requirement: Auth Pinia store caches role to avoid duplicate API calls
The system SHALL have a `useAuthStore` Pinia store that caches the authenticated user's `user` object (from Supabase Auth) and full `profile` (from `profiles` table). `role` is derived from `profile.role`. Subsequent calls within the same session return the cached value. The store exposes:
- `$reset()` — clears all state on logout
- `setProfile(data: Profile)` — directly populates `user` and `profile` from a Profile object (used by `useAuth.login()` to bypass the server-side `/api/auth/me` call during login)
- `fetchProfile()` — fetches from `GET /api/auth/me` and populates the store; used by middleware on subsequent page navigations

#### Scenario: Role fetched once per session
- **WHEN** a user logs in and navigates between pages
- **THEN** `/api/auth/me` is called at most once per session; subsequent role reads hit the store cache

#### Scenario: setProfile populates store directly
- **WHEN** `setProfile(profile)` is called with a valid Profile object
- **THEN** `user` and `profile` are populated immediately without an API call

#### Scenario: Cache cleared on logout
- **WHEN** a user logs out
- **THEN** `$reset()` is called, clearing `user`, `profile`, and `role`

#### Scenario: Store exposes user and profile
- **WHEN** a component reads `useAuthStore().profile`
- **THEN** it receives the full profile object including `full_name`, `email`, `role`

### Requirement: Login page authenticates users and redirects by role
The system SHALL have a login page at `/login` with an email/password form. On successful login, the user is immediately redirected to their role-based dashboard without visiting the index route.

#### Scenario: Successful login redirects to correct dashboard
- **WHEN** an admin logs in with valid credentials
- **THEN** they are redirected to `/admin`

#### Scenario: Successful manager login
- **WHEN** a manager logs in
- **THEN** they are redirected to `/manager`

#### Scenario: Login with null role falls back to /tenant
- **WHEN** a user logs in but their profile has no role set
- **THEN** they are redirected to `/tenant`

#### Scenario: Wrong credentials shows error
- **WHEN** a user submits incorrect email or password
- **THEN** an error alert is shown on the login page and no redirect occurs

### Requirement: Index page redirects unauthenticated users to login
The system SHALL have an index page at `/` that redirects unauthenticated users to `/login`. Authenticated users are redirected by the login page flow.

#### Scenario: Unauthenticated visit to /
- **WHEN** an unauthenticated user visits `/`
- **THEN** they are redirected to `/login`

### Requirement: Scaffold pages exist for all role-based routes
The system SHALL have scaffold (placeholder) pages for all role-based routes so navigation and middleware can be verified before feature implementation in Phase 1+.

#### Scenario: Admin scaffold pages accessible
- **WHEN** an admin navigates to `/admin`, `/admin/properties`, `/admin/rooms`, `/admin/tenants`, `/admin/contracts`, `/admin/invoices`, `/admin/settings`
- **THEN** each page renders without 404 errors

#### Scenario: Manager scaffold pages accessible
- **WHEN** a manager navigates to `/manager`, `/manager/rooms`, `/manager/tenants`, `/manager/contracts`, `/manager/invoices`
- **THEN** each page renders without 404 errors

#### Scenario: Tenant scaffold pages accessible
- **WHEN** a tenant navigates to `/tenant`, `/tenant/room`, `/tenant/contracts`, `/tenant/invoices`
- **THEN** each page renders without 404 errors
