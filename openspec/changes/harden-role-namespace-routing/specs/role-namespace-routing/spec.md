## ADDED Requirements

### Requirement: Two isolated route namespaces
The app SHALL organize authenticated routes into exactly two namespaces: `/portal/**` reserved for the `tenant` role, and `/dashboard/**` for internal roles (`admin`, `owner`, `manager`). There SHALL NOT be a separate `/admin` namespace; admin-only pages live under `/dashboard` and are gated by capability at page and service level.

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
The system SHALL expose one helper `getRedirectByRole(role)` that returns `/portal` for `tenant`, `/dashboard` for `admin`/`owner`/`manager`, and `/login` for missing/unknown roles. Login and auth callback SHALL use only this helper to decide the landing route.

#### Scenario: Tenant redirect target
- **WHEN** `getRedirectByRole('tenant')` is called
- **THEN** it returns `/portal`

#### Scenario: Internal redirect target
- **WHEN** `getRedirectByRole('admin' | 'owner' | 'manager')` is called
- **THEN** it returns `/dashboard`

#### Scenario: Unknown role falls back to login
- **WHEN** `getRedirectByRole(null)` or an unknown role is called
- **THEN** it returns `/login`

---

### Requirement: Declare namespace before adding a route
Every new route SHALL be assigned to a namespace (`/portal` or `/dashboard`) before implementation. A route without a declared namespace SHALL NOT be merged.

#### Scenario: New route without namespace
- **WHEN** a route is proposed without a declared namespace
- **THEN** it is rejected until a namespace is assigned
