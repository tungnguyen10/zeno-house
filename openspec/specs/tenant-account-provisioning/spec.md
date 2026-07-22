# tenant-account-provisioning Specification

## Purpose
TBD - created by archiving change add-tenant-account-provisioning. Update Purpose after archive.
## Requirements
### Requirement: Operator provisions tenant portal accounts
The system SHALL let `admin` and `owner` provision a Supabase Auth login for an existing `tenants` record, gated by a `tenant.account.provision` capability. Provisioning SHALL set `app_metadata.role = 'tenant'` only via the service-role path (never `/api/users`, never client metadata) and SHALL insert a `tenant_user_links` row binding the auth user to the chosen tenant. `CREATABLE_ROLES` SHALL remain `owner | manager`.

#### Scenario: Admin provisions an existing tenant
- **WHEN** an admin provisions an account for an existing tenant that has no link
- **THEN** an auth user is created with `app_metadata.role = 'tenant'` and a `tenant_user_links` row binds it to that tenant

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

#### Scenario: Owner out of scope
- **WHEN** an owner targets a tenant with no contract in any assigned building and not created by the owner
- **THEN** the request resolves as not found

---

### Requirement: One-time temporary credentials and required onboarding
Provisioning and password reset SHALL generate a server-side random temporary password, confirm the email so the tenant can sign in immediately, return the email and temporary password exactly once, and set a server-controlled `app_metadata.tenant_onboarding = password_required`. The temporary password SHALL NOT be stored or returned again. A tenant with an onboarding state SHALL NOT access portal routes or tenant APIs until all onboarding steps complete.

#### Scenario: Credentials returned once
- **WHEN** an account is provisioned
- **THEN** the response includes the email and a one-time temporary password, and subsequent status reads never include the password

#### Scenario: Initial login starts onboarding
- **WHEN** the tenant signs in with the temporary credentials
- **THEN** the session is accepted and the tenant is routed to `/auth/complete-account`, not `/portal`

#### Scenario: Password step preserves the onboarding session
- **WHEN** the tenant replaces the temporary password during onboarding
- **THEN** Supabase updates the password using that tenant's authenticated session, the same session remains refreshable, and onboarding advances to email verification

#### Scenario: Reset password restarts onboarding
- **WHEN** an operator resets a tenant password
- **THEN** the account returns to `password_required` before it can use portal routes or tenant APIs

### Requirement: Tenant verifies login email and links Google once
The onboarding flow SHALL require a tenant to replace the temporary password, submit a login email, verify the new email through Supabase Auth, and link a Google identity with the same verified email before clearing `tenant_onboarding`. The verified Auth email SHALL be copied to `tenants.email`; self-service portal profile updates SHALL NOT independently change it.

#### Scenario: Email verified before sync
- **WHEN** the tenant requests an email change and has not confirmed the Supabase email link
- **THEN** the portal profile email remains unchanged and onboarding remains blocked

#### Scenario: Google identity proves the same email
- **WHEN** the confirmed Auth account has a Google identity whose verified email equals the Auth email
- **THEN** onboarding is cleared and the tenant is routed to `/portal`

#### Scenario: Mismatched Google identity
- **WHEN** the linked Google identity has a different email
- **THEN** onboarding remains blocked and no portal access is granted

---

### Requirement: Account lifecycle management
The system SHALL expose account status (whether a tenant has a link, its email, and status), and SHALL allow disabling/enabling the link (`status` = `disabled`/`active`), resetting the password, and revoking the account. Revoking SHALL delete the auth user so the `tenant_user_links` row is removed by cascade and the email is freed. All lifecycle actions SHALL be capability-gated, scope-checked, and audited.

#### Scenario: Disable blocks access
- **WHEN** an operator disables a tenant account
- **THEN** the link `status` becomes `disabled` and `resolveTenantId` no longer resolves for that user

#### Scenario: Revoke frees the email
- **WHEN** an operator revokes a tenant account
- **THEN** the auth user is deleted, the link is removed by cascade, and the email can be provisioned again
