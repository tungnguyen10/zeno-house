## ADDED Requirements

### Requirement: Auth supports owner role
System SHALL support `owner` as a Supabase Auth `app_metadata.role` value in addition to `admin` and `manager`.

#### Scenario: Owner login
- **WHEN** user logs in with `app_metadata.role = 'owner'`
- **THEN** session is accepted and role-derived helpers expose owner role state

#### Scenario: Missing role remains unauthorized for capabilities
- **WHEN** logged-in user has no `app_metadata.role`
- **THEN** protected capabilities return false and server actions reject the user

---

### Requirement: Client auth store exposes role-derived helpers
Client auth state SHALL expose role-derived helpers needed for UI visibility: `isAdmin`, `isOwner`, `isManager`, and user-management visibility derived from capability or role.

#### Scenario: Owner helper
- **WHEN** current user has `app_metadata.role = 'owner'`
- **THEN** `isOwner` is true and `isAdmin` is false

#### Scenario: Admin helper
- **WHEN** current user has `app_metadata.role = 'admin'`
- **THEN** `isAdmin` is true and `isOwner` is false
