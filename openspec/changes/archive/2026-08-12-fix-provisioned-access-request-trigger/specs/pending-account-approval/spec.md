## MODIFIED Requirements

### Requirement: Unprovisioned registrations enter a pending lifecycle
The system SHALL create exactly one service-owned access request when Supabase Auth creates an email or OAuth user whose final persisted `app_metadata.role` is absent at the end of the Auth creation transaction. Accounts created through an existing server provisioning path with a valid application role SHALL NOT create a pending request, including when Supabase applies that role after the initial Auth row insert within the same transaction. The system SHALL reconcile only untouched `pending` requests for users who already hold a valid application role and SHALL NOT reconcile requests in `processing`, `approved`, or `rejected` state.

#### Scenario: New Google identity becomes pending
- **WHEN** Google OAuth creates an auth user without an application role
- **THEN** an access request is created with status `pending` and no application capability is granted

#### Scenario: Provisioned identity role is applied after insert
- **WHEN** an admin or owner provisioning service creates an Auth user and Supabase applies the valid application role after the initial row insert in the same transaction
- **THEN** the final Auth state is evaluated and no access request is created for that user

#### Scenario: Existing provisioned email uses Google
- **WHEN** Supabase links a verified Google identity to an existing provisioned email
- **THEN** the existing user id, role, assignments, and tenant link remain authoritative and no pending request is created

#### Scenario: Untouched provisioned request is reconciled
- **WHEN** an existing `pending` request has no claim, review, decision, scope, or rejection data and its Auth user has a valid application role
- **THEN** the system records reconciliation and removes the stale request

#### Scenario: Decided request is preserved
- **WHEN** an access request is `processing`, `approved`, or `rejected`
- **THEN** automated provisioned-account reconciliation leaves the request unchanged
