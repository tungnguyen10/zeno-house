# tenant-account-provisioning Specification

## Purpose
TBD - created by archiving change add-tenant-account-provisioning. Update Purpose after archive.
## Requirements
### Requirement: Operator provisions tenant portal accounts
The system SHALL let `admin` and `owner` provision a Supabase Auth login for an existing `tenants` record, gated by a `tenant.account.provision` capability. Provisioning SHALL set `app_metadata.role = 'tenant'` only via the service-role path (never `/api/users`, never client metadata) and SHALL insert a `tenant_user_links` row binding the auth user to the chosen tenant. `CREATABLE_ROLES` SHALL remain `owner | manager`.

#### Scenario: Admin provisions an existing tenant
- **WHEN** an admin provisions an account for an existing tenant that has no link
- **THEN** an auth user is created with `app_metadata.role = 'tenant'` and a `tenant_user_links` row binds it to that tenant

#### Scenario: Operator provisions an active roommate
- **WHEN** an operator selects a tenant whose active assignment role is `roommate`
- **THEN** the existing provisioning flow links the Auth user to that roommate's own tenant record and the UI shows their room, role, and primary tenant before confirmation

#### Scenario: Non-authorized role cannot provision
- **WHEN** a `manager` or `tenant` requests provisioning
- **THEN** the request is rejected for lack of the `tenant.account.provision` capability

#### Scenario: Tenant already linked
- **WHEN** provisioning targets a tenant that already has a link
- **THEN** the request fails with a conflict and no new auth user remains

---

### Requirement: Owner provisioning is building-scoped
An `owner` SHALL be able to provision or manage an account only for a tenant that has a contract in a building assigned to the owner, or that the owner created. Admin SHALL be unscoped. Out-of-scope targets SHALL be treated as not found.

#### Scenario: Owner within scope
- **WHEN** an owner provisions a tenant that has a contract in an assigned building
- **THEN** provisioning succeeds

#### Scenario: Roommate inherits provisioning building scope
- **WHEN** an owner provisions an active occupant of a contract in an assigned building
- **THEN** the roommate is considered in scope without changing the account API or link model

#### Scenario: Owner out of scope
- **WHEN** an owner targets a tenant with no contract in any assigned building and not created by the owner
- **THEN** the request resolves as not found

---

### Requirement: One-time temporary credentials and required onboarding
Provisioning and password reset SHALL generate a server-side random temporary password, confirm the email so the tenant can sign in immediately, return the email and temporary password exactly once, and set a server-controlled `app_metadata.tenant_onboarding = password_required`. The temporary password SHALL NOT be stored or returned again. A tenant in `password_required` SHALL NOT access portal routes or tenant APIs until the password is changed.

#### Scenario: Credentials returned once
- **WHEN** an account is provisioned
- **THEN** the response includes the email and a one-time temporary password, and subsequent status reads never include the password

#### Scenario: Initial login starts onboarding
- **WHEN** the tenant signs in with the temporary credentials
- **THEN** the session is accepted and the tenant is routed to `/auth/complete-account`, not `/portal`

#### Scenario: Password step preserves the onboarding session
- **WHEN** the tenant replaces the temporary password during onboarding
- **THEN** Supabase updates the password using that tenant's authenticated session, clears `tenant_onboarding`, refreshes the same session, and routes the tenant to `/portal`

#### Scenario: Reset password restarts onboarding
- **WHEN** an operator resets a tenant password
- **THEN** the account returns to `password_required` before it can use portal routes or tenant APIs

### Requirement: Login and contact emails remain independent
The Supabase Auth login email and `tenants.email` SHALL be treated as independent fields. Tenant
onboarding SHALL NOT change or synchronize either email and SHALL NOT require a linked Google
identity. Legacy `email_required` and `google_required` metadata SHALL be ignored without a data
migration.

#### Scenario: Legacy metadata no longer blocks an account
- **WHEN** an existing tenant has `tenant_onboarding = email_required` or `google_required`
- **THEN** the tenant can access `/portal` and tenant APIs without completing another onboarding step

#### Scenario: Google remains an optional login method
- **WHEN** a tenant uses a valid Google login associated with the same Auth user
- **THEN** the existing Auth user and tenant link are preserved without making Google a portal prerequisite

---

### Requirement: Account lifecycle management
The system SHALL expose joined account health, email, link status, and lifecycle outcome; allow disabling/enabling the link, resetting the password, and revoking the account; and SHALL return the actual revoke result as `deleted` or `deactivated`. Revocation SHALL disable the link before the Auth operation, prefer Auth hard-delete, use irreversible Auth soft-delete only when hard-delete is blocked, remove the link, and make the email reusable. All lifecycle actions SHALL be capability-gated, scope-checked, and audited without discarding one-time credentials or truthful mutation results when a secondary audit append fails.

#### Scenario: Disable blocks access
- **WHEN** an operator disables a tenant account
- **THEN** the link `status` becomes `disabled` and `resolveTenantId` no longer resolves for that user

#### Scenario: Hard revoke frees the email
- **WHEN** an operator revokes an account whose Auth identity can be hard-deleted
- **THEN** the result is `deleted`, the link is removed, and the email can be provisioned again

#### Scenario: Blocked hard delete uses soft delete
- **WHEN** Auth hard-delete is blocked by a retained dependency
- **THEN** the identity is irreversibly soft-deleted, the link is removed, the result is `deactivated`, and the UI does not claim physical deletion

#### Scenario: Audit failure does not lose credentials
- **WHEN** provisioning or password reset changes Auth successfully but the audit append fails
- **THEN** the API returns the generated one-time credentials and emits structured server telemetry for the audit failure

#### Scenario: Provisioning link failure is compensated
- **WHEN** Auth identity creation succeeds but link creation fails
- **THEN** the new Auth identity is deleted or soft-deleted and no active orphan remains

### Requirement: Orphan reconciliation is explicit
Admin SHALL be able to list and reconcile tenant-role Auth identities that have no tenant link. Reconciliation SHALL never auto-link an identity to a tenant and SHALL record the actual deletion outcome.

#### Scenario: Reconcile one orphan
- **WHEN** admin confirms one orphan identity
- **THEN** the system removes or soft-deletes that identity and refreshes the drift list
