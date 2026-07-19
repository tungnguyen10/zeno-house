## Purpose

Defines the private pending identity lifecycle and admin-only role/scope approval boundary.

## Requirements

### Requirement: Unprovisioned registrations enter a pending lifecycle
The system SHALL create exactly one service-owned access request when Supabase Auth creates an email or OAuth user without `app_metadata.role`. Accounts created through an existing server provisioning path with a valid application role SHALL NOT create a pending request.

#### Scenario: New Google identity becomes pending
- **WHEN** Google OAuth creates an auth user without an application role
- **THEN** an access request is created with status `pending` and no application capability is granted

#### Scenario: Provisioned identity skips pending
- **WHEN** an admin or owner provisioning service creates an auth user with a valid role
- **THEN** no access request is created for that user

#### Scenario: Existing provisioned email uses Google
- **WHEN** Supabase links a verified Google identity to an existing provisioned email
- **THEN** the existing user id, role, assignments, and tenant link remain authoritative and no pending request is created

### Requirement: Pending storage is private and deny-by-default
`access_requests` SHALL have RLS enabled, SHALL grant no table access to `anon` or `authenticated`, and SHALL be accessed only through service-owned repositories. A missing-role JWT SHALL be rejected from internal and tenant API namespaces.

#### Scenario: Pending user queries table directly
- **WHEN** an authenticated pending user queries `access_requests` through the Data API
- **THEN** the query is denied regardless of matching user id

#### Scenario: Pending user calls a domain API
- **WHEN** a missing-role JWT calls an internal or tenant API
- **THEN** namespace middleware returns the same not-found response used for role mismatch

### Requirement: Admin approves pending identities with required scope
Only a user holding `users.approve.pending` SHALL list or decide access requests, and that capability SHALL be granted only to `admin`. Approval SHALL reject unverified email identities, SHALL forbid the `admin` target role, SHALL require one or more buildings for `owner`/`manager`, and SHALL require an unlinked existing tenant for `tenant`.

#### Scenario: Admin approves internal account
- **WHEN** admin approves a verified pending request as owner or manager with valid building ids
- **THEN** assignments are created before `app_metadata.role` is granted and the request becomes `approved`

#### Scenario: Admin approves tenant account
- **WHEN** admin approves a verified pending request as tenant with an unlinked tenant id
- **THEN** an active `tenant_user_links` row is created before the tenant role is granted and the request becomes `approved`

#### Scenario: Owner attempts approval
- **WHEN** owner calls an access-request listing or decision endpoint
- **THEN** the server returns forbidden and the request is unchanged

#### Scenario: Email is unverified
- **WHEN** admin attempts to approve an email-signup user whose email is not confirmed
- **THEN** approval is rejected and no role, assignment, or tenant link is written

### Requirement: Approval is concurrency-safe and recoverable
Approval SHALL claim a pending request with a conditional transition and a per-claim fencing token before writing grants. Grants created by the decision SHALL carry the same token. Concurrent or repeated decisions SHALL NOT grant multiple roles or duplicate scope. A failure before confirmed role assignment SHALL either remove only claim-owned grants or preserve a fenced `processing` state that the same decision can resume idempotently.

#### Scenario: Two admins approve concurrently
- **WHEN** two admins attempt to approve the same pending request
- **THEN** exactly one claim succeeds and the other receives a conflict without additional grants

#### Scenario: Auth role update fails
- **WHEN** building assignments or tenant link were created but the Auth role update fails
- **THEN** the request preserves its claim-owned grants in a fenced processing state, and retrying the same decision completes missing scope without granting application access early

### Requirement: Rejection is durable and terminal in v1
Admin SHALL reject a pending request only with a non-empty reason. Rejection SHALL retain the auth user and request for audit, SHALL grant no role, and SHALL not provide a self-service reopen or re-registration path.

#### Scenario: Admin rejects request
- **WHEN** admin submits a valid rejection reason for a pending request
- **THEN** the request becomes `rejected`, retains the reason, and the user remains unable to access application namespaces

### Requirement: Pending user reads only their own status
An authenticated missing-role user SHALL retrieve only the access request associated with their JWT subject through `GET /api/auth/access-request/me`. The page SHALL poll only while visible, refresh the Auth session after approval, and show the rejection reason after rejection.

#### Scenario: Approval detected while pending page is open
- **WHEN** polling observes an approved request
- **THEN** the client refreshes the session and redirects through `getRedirectByRole`

#### Scenario: Rejection detected
- **WHEN** polling observes a rejected request
- **THEN** the pending page displays the stored reason and offers logout without exposing another request
