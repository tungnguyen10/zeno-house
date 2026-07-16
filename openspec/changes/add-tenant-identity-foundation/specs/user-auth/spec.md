## MODIFIED Requirements

### Requirement: Auth supports owner role
System SHALL support `owner` and `tenant` as Supabase Auth `app_metadata.role` values in addition to `admin` and `manager`. The `tenant` role is isolated from internal roles and is not creatable through internal user management.

#### Scenario: Owner login
- **WHEN** user logs in with `app_metadata.role = 'owner'`
- **THEN** session is accepted and role-derived helpers expose owner role state

#### Scenario: Tenant login
- **WHEN** user logs in with `app_metadata.role = 'tenant'`
- **THEN** session is accepted and `isTenant` is true while internal role helpers are false

#### Scenario: Missing role remains unauthorized for capabilities
- **WHEN** logged-in user has no `app_metadata.role`
- **THEN** protected capabilities return false and server actions reject the user

---

### Requirement: Client auth store exposes role-derived helpers
Client auth state SHALL expose role-derived helpers needed for UI visibility: `isAdmin`, `isOwner`, `isManager`, `isTenant`, and user-management visibility derived from capability or role.

#### Scenario: Tenant helper
- **WHEN** current user has `app_metadata.role = 'tenant'`
- **THEN** `isTenant` is true and all internal role helpers are false

#### Scenario: Owner helper
- **WHEN** current user has `app_metadata.role = 'owner'`
- **THEN** `isOwner` is true and `isAdmin` is false
