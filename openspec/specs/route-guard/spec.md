## Purpose
Defines authentication and guest route guard behavior for protected internal, portal, and pending routes.

## Requirements

### Requirement: Global auth middleware bảo vệ tất cả admin routes
`middleware/auth.global.ts` SHALL run on every navigation. Unauthenticated users outside public auth routes SHALL redirect to `/login`. A resolved missing-role session SHALL be locked to `/auth/pending`; a tenant SHALL be locked to `/portal`; and an internal role SHALL be redirected out of `/portal` and `/auth/pending` to `/dashboard`. The middleware SHALL retain the `auth.getSession()` timing fallback and SHALL NOT evaluate building scope.

Public auth routes SHALL include `/login`, `/register`, `/forgot-password`, `/auth/callback`, and `/auth/reset-password`. `/auth/pending` SHALL require a session but accept a missing application role.

#### Scenario: Unauthenticated user accesses protected route
- **WHEN** unauthenticated user navigates to dashboard, portal, or pending route
- **THEN** middleware redirects to `/login`

#### Scenario: Unauthenticated user accesses public auth route
- **WHEN** unauthenticated user navigates to a listed public auth route
- **THEN** middleware renders the route without redirect

#### Scenario: Missing-role user is locked to pending
- **WHEN** an authenticated session without role navigates outside `/auth/pending` or required callback/recovery handling
- **THEN** middleware redirects to `/auth/pending` before render

#### Scenario: Known role leaves pending
- **WHEN** an approved admin, owner, manager, or tenant navigates to `/auth/pending`
- **THEN** middleware redirects through `getRedirectByRole`

#### Scenario: Tenant namespace isolation
- **WHEN** tenant navigates outside `/portal`
- **THEN** middleware redirects to `/portal`

#### Scenario: Internal namespace isolation
- **WHEN** internal role navigates to `/portal`
- **THEN** middleware redirects to `/dashboard`

#### Scenario: Session fallback after sign-in
- **WHEN** `useSupabaseUser()` has not updated immediately after authentication
- **THEN** middleware resolves `auth.getSession()` before choosing a route

### Requirement: Guest middleware redirect authenticated user khỏi login page
`middleware/guest.ts` SHALL be applied to login, registration, and forgot-password. An authenticated user SHALL redirect through `getRedirectByRole(role)`, including `/auth/pending` for missing role.

#### Scenario: Authenticated user opens a guest page
- **WHEN** a session navigates to login, registration, or forgot-password
- **THEN** middleware redirects to dashboard, portal, or pending according to role

#### Scenario: Unauthenticated user opens a guest page
- **WHEN** no session exists
- **THEN** middleware renders the requested guest page
