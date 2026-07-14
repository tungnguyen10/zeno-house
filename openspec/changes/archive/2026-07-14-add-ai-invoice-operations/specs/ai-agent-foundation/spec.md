## ADDED Requirements

### Requirement: AI runtime has server-authoritative rollout and kill switches
The server SHALL enforce independent AI chat, read-tool, mutation-planning, and mutation-execution switches, including per-invoice-action switches, regardless of public UI visibility.

#### Scenario: Chat UI is visible but server chat is disabled
- **WHEN** a client calls the chat endpoint while private chat enablement is off
- **THEN** the server rejects the request before persisting a message or invoking a model

#### Scenario: Mutation execution is disabled after planning
- **WHEN** an action card is pending and its executor switch is turned off
- **THEN** confirmation fails closed without dispatching the domain mutation

### Requirement: AI requests and actions are bounded
The system SHALL apply per-user distributed request and action-confirmation rate limits, provider timeouts, and a bounded provider circuit breaker without logging message content or secrets.

#### Scenario: User exceeds request limit
- **WHEN** an authenticated user exceeds the configured chat request budget for the current window
- **THEN** the endpoint returns a retryable rate-limit response before invoking the model

#### Scenario: Provider exceeds timeout
- **WHEN** the configured provider deadline elapses
- **THEN** the model call is aborted, a normalized failure is persisted, and no unconfirmed mutation executes

#### Scenario: Provider circuit is open
- **WHEN** consecutive provider failures reach the configured threshold during its cooldown
- **THEN** new model calls fail fast while direct authorized action confirmation remains governed by its own switches

### Requirement: Prompt injection cannot expand tool authority
The system SHALL treat conversation content and tool-returned labels as untrusted data and SHALL rely on registered schemas, capabilities, scope checks, and direct confirmation rather than model instructions for authorization.

#### Scenario: User asks to ignore policy
- **WHEN** a prompt requests an unregistered tool, hidden identifier, direct mutation, or fabricated confirmation
- **THEN** tool exposure and executor dispatch remain unchanged and no unauthorized data or mutation is produced

#### Scenario: Stored business label contains instructions
- **WHEN** a building, room, tenant, or invoice label contains prompt-like text
- **THEN** the text is handled as data and cannot change tool policy or confirmation state

### Requirement: Expired AI state is cleaned on schedule
The system SHALL run bounded scheduled cleanup for conversations past their 30-day expiry and SHALL cascade deletion to stored messages and action plans without deleting unexpired conversations.

#### Scenario: Daily cleanup runs
- **WHEN** the retention task processes an expired conversation batch
- **THEN** expired conversations and dependent AI rows are deleted and only counts/duration are emitted to telemetry

#### Scenario: Cleanup is retried
- **WHEN** the scheduled task runs again after a partial bounded batch
- **THEN** it safely continues with remaining expired rows and preserves unexpired state

### Requirement: AI production rollout is feature flagged and observable
The system SHALL default production AI mutation exposure to off, SHALL document configuration and recovery steps, and SHALL emit correlated request, tool, action, rate-limit, timeout, circuit, and cleanup outcomes without sensitive content.

#### Scenario: Production starts without mutation opt-in
- **WHEN** production deploys without explicit mutation enablement
- **THEN** invoice planners/executors remain unavailable while documented read-only rollout can be enabled independently

#### Scenario: Operator disables one mutation class
- **WHEN** an operator disables invoice mutations during an incident
- **THEN** invoice plans and confirmations fail closed while unrelated direct billing APIs continue to operate
