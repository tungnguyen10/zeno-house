## MODIFIED Requirements

### Requirement: Pending account decisions are audited
The system SHALL define and append audit actions for access-request creation, approval, rejection, and automated stale-request reconciliation. Approval metadata SHALL include the granted role and selected scope identifiers; rejection metadata SHALL include the reason. Reconciliation SHALL use an explicit system actor and include only the reconciliation reason, current role, and access-request identifier. Audit payloads SHALL NOT contain passwords, OAuth tokens, recovery tokens, session data, or other credentials. Existing audit history SHALL remain append-only during reconciliation.

#### Scenario: Approval audit
- **WHEN** admin successfully approves a request
- **THEN** one `user.access_request.approved` event identifies the target user, granted role, and scope without secrets

#### Scenario: Rejection audit
- **WHEN** admin rejects a request
- **THEN** one `user.access_request.rejected` event identifies the target user and reason without secrets

#### Scenario: Pending creation audit is service-owned
- **WHEN** the application first observes a trigger-created pending request
- **THEN** it records `user.access_request.created` at most once for that request

#### Scenario: Stale provisioned request reconciliation is audited
- **WHEN** the system removes an untouched pending request because the Auth user already has a valid application role
- **THEN** it first appends one `user.access_request.reconciled` event with a system actor, reason, role, and request identifier without deleting prior audit events
