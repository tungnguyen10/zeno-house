## Purpose
Defines authenticated role namespaces, centralized landing redirects, and the route-declaration boundary between the internal dashboard and tenant portal.

## Requirements

### Requirement: Two isolated route namespaces
The app SHALL organize authenticated routes into exactly two namespaces: `/portal/**` for the `tenant` role, and `/dashboard/**` for internal roles (`admin`, `owner`, `manager`). The API surface SHALL mirror this isolation: `/api/tenant/**` is reserved for the `tenant` role, and internal `/api/**` is reserved for internal roles. The server namespace guard SHALL enforce both directions. There SHALL NOT be a separate `/admin` namespace; admin-only pages live under `/dashboard` and are gated by capability at page and service level.

#### Scenario: Tenant JWT blocked from internal API
- **WHEN** a `tenant`-role JWT calls an internal `/api/**` endpoint
- **THEN** the server rejects it with a consistent forbidden/not-found response

#### Scenario: Internal role blocked from tenant API
- **WHEN** an `admin`/`owner`/`manager` JWT calls a `/api/tenant/**` endpoint
- **THEN** the server rejects it

#### Scenario: Internal roles use dashboard namespace
- **WHEN** an `admin`, `owner`, or `manager` navigates to an internal feature
- **THEN** the route lives under `/dashboard/**`

#### Scenario: Portal namespace reserved for tenant
- **WHEN** a route under `/portal/**` is requested
- **THEN** only a `tenant`-role user may render it; all other roles are redirected out

#### Scenario: No separate admin namespace
- **WHEN** an admin-only page (user management, audit history) is added
- **THEN** it is placed under `/dashboard` and guarded by capability, not by an `/admin` prefix

---

### Requirement: Single redirect decision source
The system SHALL expose one helper `getRedirectByRole(role)` that returns `/portal` for tenant, `/dashboard` for admin/owner/manager, `/auth/pending` for a missing role, and `/login` for an unknown non-empty role. Login, registration session completion, OAuth callback, guest middleware, pending approval refresh, and root landing SHALL use this helper.

#### Scenario: Tenant redirect target
- **WHEN** `getRedirectByRole('tenant')` is called
- **THEN** it returns `/portal`

#### Scenario: Internal redirect target
- **WHEN** `getRedirectByRole('admin' | 'owner' | 'manager')` is called
- **THEN** it returns `/dashboard`

#### Scenario: Missing role becomes pending
- **WHEN** `getRedirectByRole(null | undefined)` is called
- **THEN** it returns `/auth/pending`

#### Scenario: Unknown role returns to login
- **WHEN** `getRedirectByRole('unknown')` is called
- **THEN** it returns `/login`

---

### Requirement: Auth API namespace accepts pending sessions only for auth lifecycle
The API classifier SHALL identify `/api/auth/**` as an auth namespace. Namespace middleware SHALL permit any authenticated JWT into that namespace, while endpoints SHALL still call `requireAuth`; missing-role JWTs SHALL remain rejected from internal and tenant namespaces.

#### Scenario: Pending user reads own request
- **WHEN** a missing-role JWT calls `/api/auth/access-request/me`
- **THEN** namespace middleware allows the endpoint to perform its authenticated self lookup

#### Scenario: Pending user calls internal API
- **WHEN** the same JWT calls a non-auth internal API
- **THEN** namespace middleware rejects it as not found

---

### Requirement: Declare namespace before adding a route
Every new route SHALL be assigned to a namespace (`/portal` or `/dashboard`) before implementation. A route without a declared namespace SHALL NOT be merged.

#### Scenario: New route without namespace
- **WHEN** a route is proposed without a declared namespace
- **THEN** it is rejected until a namespace is assigned
