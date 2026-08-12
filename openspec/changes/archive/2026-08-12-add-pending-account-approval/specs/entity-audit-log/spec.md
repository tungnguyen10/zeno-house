## ADDED Requirements

### Requirement: Pending account decisions are audited
The system SHALL define and append audit actions for access-request creation, approval, and rejection. Approval metadata SHALL include the granted role and selected scope identifiers; rejection metadata SHALL include the reason. Audit payloads SHALL NOT contain passwords, OAuth tokens, recovery tokens, or session data.

#### Scenario: Approval audit
- **WHEN** admin successfully approves a request
- **THEN** one `user.access_request.approved` event identifies the target user, granted role, and scope without secrets

#### Scenario: Rejection audit
- **WHEN** admin rejects a request
- **THEN** one `user.access_request.rejected` event identifies the target user and reason without secrets

#### Scenario: Pending creation audit is service-owned
- **WHEN** the application first observes a trigger-created pending request
- **THEN** it records `user.access_request.created` at most once for that request
