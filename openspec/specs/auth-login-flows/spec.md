## Requirements

### Requirement: Tenant login page exists at /tenant/login
The system SHALL provide a dedicated login page at `/tenant/login` for tenant users, separate from the admin/manager login at `/login`. On successful login, tenants are redirected to `/tenant`.

The admin/manager login at `/login` SHALL block tenant-role users: if a tenant successfully authenticates at `/login`, the session is cleared via `signOut()` and an `auth.errors.wrong_role` error is displayed. This mirrors the same guard on `/tenant/login` for non-tenants.

#### Scenario: Tenant logs in successfully
- **WHEN** a tenant submits valid credentials on `/tenant/login`
- **THEN** they are authenticated and redirected to `/tenant`

#### Scenario: Non-tenant blocked from tenant portal after login
- **WHEN** an admin or manager submits credentials on `/tenant/login`
- **THEN** `signOut()` is called and they see `auth.errors.wrong_role` error

#### Scenario: Tenant blocked from admin/manager portal
- **WHEN** a tenant submits credentials on `/login`
- **THEN** `logout()` is called and they see `auth.errors.wrong_role` error

#### Scenario: Unauthenticated visit to /tenant/login
- **WHEN** an already-authenticated user visits `/tenant/login`
- **THEN** they are redirected to their role dashboard (guest middleware)

### Requirement: Forgot password page sends reset email
The system SHALL provide a `/forgot-password` page where users can enter their email to receive a Supabase password reset link. The `forgotPassword(email)` composable function calls `supabase.auth.resetPasswordForEmail()` with `redirectTo` set to `{origin}/reset-password`.

Note: the `/reset-password` page is not yet implemented — it is a future requirement.

#### Scenario: Valid email triggers reset email
- **WHEN** a user submits a valid email on `/forgot-password`
- **THEN** Supabase sends a password reset email with a link back to `/reset-password`, and the page shows a success message

#### Scenario: Unknown email shows generic success
- **WHEN** a user submits an email that doesn't exist in auth.users
- **THEN** the page shows the same success message (no enumeration of valid emails)

#### Scenario: Empty email shows validation error
- **WHEN** a user submits the forgot-password form with no email
- **THEN** a validation error is shown inline

### Requirement: OAuth callback page handles post-Google-login session
The system SHALL provide a page at `/auth/callback` (layout: false) that handles the OAuth redirect after Google login. On mount it reads the established Supabase session, fetches the user's `profiles` row directly via the Supabase client, calls `authStore.setProfile()`, then redirects to the role dashboard. If no profile row exists the session is cleared and the user is redirected to `/login`.

#### Scenario: Successful Google login populates store and redirects
- **WHEN** a user completes Google OAuth and lands on `/auth/callback`
- **THEN** the profile is fetched, the store is populated, and the user is redirected to their role dashboard (`/admin`, `/manager`, or `/tenant`)

#### Scenario: Google login with no profile row signs out
- **WHEN** a user completes Google OAuth but has no `profiles` row
- **THEN** the Supabase session is cleared and the user is redirected to `/login`

#### Scenario: Session not yet ready on mount uses auth state change listener
- **WHEN** `getSession()` returns null immediately after OAuth redirect (race condition)
- **THEN** an `onAuthStateChange` listener handles the session once it is established, then unsubscribes

### Requirement: Auth layout wraps login pages without sidebar
The system SHALL provide an `auth.vue` layout that renders only a centered content area with no sidebar, header, or navigation. Login pages use `definePageMeta({ layout: 'auth' })`.

#### Scenario: Login page renders without sidebar
- **WHEN** a user visits `/login` or `/tenant/login`
- **THEN** no sidebar or top navigation is visible

### Requirement: Guest middleware redirects authenticated users from login pages
The system SHALL have a `guest.ts` middleware that redirects already-authenticated users away from login and forgot-password pages to their role dashboard.

#### Scenario: Authenticated admin visits /login
- **WHEN** an authenticated admin navigates to `/login`
- **THEN** they are redirected to `/admin`

#### Scenario: Authenticated tenant visits /tenant/login
- **WHEN** an authenticated tenant navigates to `/tenant/login`
- **THEN** they are redirected to `/tenant`
