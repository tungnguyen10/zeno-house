## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Orphan reconciliation is explicit
Admin SHALL be able to list and reconcile tenant-role Auth identities that have no tenant link. Reconciliation SHALL never auto-link an identity to a tenant and SHALL record the actual deletion outcome.

#### Scenario: Reconcile one orphan
- **WHEN** admin confirms one orphan identity
- **THEN** the system removes or soft-deletes that identity and refreshes the drift list
