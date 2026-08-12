## ADDED Requirements

### Requirement: Durable cross-system audit intent
The system SHALL persist a secret-free audit operation intent before invoking Supabase Auth, Storage, or an external provider for a business mutation.

#### Scenario: Intent persistence fails
- **WHEN** the audit operation intent cannot be committed
- **THEN** the external mutation is not attempted

#### Scenario: External mutation completes before final audit
- **WHEN** an external mutation succeeds but the request stops before final audit completion
- **THEN** the persisted operation remains recoverable and the change is not silent

### Requirement: Idempotent operation completion
Each audit operation SHALL have a unique idempotency key and SHALL append its semantic completion event at most once.

#### Scenario: Completion is retried
- **WHEN** the same operation completion is submitted more than once
- **THEN** exactly one semantic audit event exists and the stored completed result is returned

### Requirement: Stale operation reconciliation
The system SHALL lease and reconcile stale pending or executing audit operations through a private service-role endpoint without exposing secrets in logs or audit payloads.

#### Scenario: Verifiable external state matches intent
- **WHEN** reconciliation confirms that the intended external state was applied
- **THEN** it appends the semantic completion event and marks the operation completed

#### Scenario: Outcome cannot be verified
- **WHEN** reconciliation cannot prove whether a non-readable external mutation completed
- **THEN** it records an unresolved outcome for operator review without fabricating success
