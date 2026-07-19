## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Auth API namespace accepts pending sessions only for auth lifecycle
The API classifier SHALL identify `/api/auth/**` as an auth namespace. Namespace middleware SHALL permit any authenticated JWT into that namespace, while endpoints SHALL still call `requireAuth`; missing-role JWTs SHALL remain rejected from internal and tenant namespaces.

#### Scenario: Pending user reads own request
- **WHEN** a missing-role JWT calls `/api/auth/access-request/me`
- **THEN** namespace middleware allows the endpoint to perform its authenticated self lookup

#### Scenario: Pending user calls internal API
- **WHEN** the same JWT calls a non-auth internal API
- **THEN** namespace middleware rejects it as not found
