## ADDED Requirements

### Requirement: AI provider routing is free-only and observable
The system SHALL route production AI chat through distinct configured OpenRouter primary and fallback models whose catalog pricing is zero and which support tool calling, SHALL prohibit implicit paid fallback, and SHALL report the model that actually produced the response.

#### Scenario: Primary succeeds
- **WHEN** the configured free primary completes a chat request
- **THEN** the terminal event, persistence metadata, and telemetry identify the primary model and report that fallback was not used

#### Scenario: Primary fails before streaming
- **WHEN** OpenRouter cannot use the primary before any response token is emitted
- **THEN** OpenRouter attempts the configured free fallback and the system reports the selected fallback model

#### Scenario: Free model contract is invalid
- **WHEN** either configured production model is missing, paid, duplicated, or lacks tool support
- **THEN** release verification fails and the server does not silently route to a paid model

### Requirement: Chat turns are atomic and context-bounded
The system SHALL atomically resolve or create an owned conversation, append its user message, extend retention, and return ordered bounded history, and SHALL apply both message-count and content-budget limits before provider transmission.

#### Scenario: Owned chat turn begins
- **WHEN** an authenticated internal user starts or resumes a valid conversation
- **THEN** one database transaction persists the turn and returns only that user's ordered bounded history

#### Scenario: Context exceeds its content budget
- **WHEN** stored history exceeds the configured provider context budget
- **THEN** the server sends the newest complete messages that fit while retaining the current user message

### Requirement: Provider controls are distributed
The system SHALL enforce the provider circuit and global daily chat quota using shared database state while retaining the per-user distributed rate limit.

#### Scenario: Failures occur across serverless instances
- **WHEN** consecutive provider failures across instances reach the configured threshold
- **THEN** subsequent chat calls fail fast until the shared cooldown permits a probe

#### Scenario: Free daily quota is exhausted
- **WHEN** the configured global daily chat count is consumed
- **THEN** further model requests are rejected before provider invocation with a capacity-specific retryable response

### Requirement: Action execution is integrity-checked and recoverable
The system SHALL verify the canonical stored payload hash before claim and SHALL allow an expired execution lease to retry the same domain operation with the plan's durable idempotency key.

#### Scenario: Stored action payload was altered
- **WHEN** the canonical payload and resource-version hash does not equal the stored payload hash at confirmation
- **THEN** the plan becomes stale and no executor is dispatched

#### Scenario: Domain commit outlives plan completion
- **WHEN** a domain mutation commits but recording the succeeded plan fails
- **THEN** the plan remains executing and a confirmation after lease expiry replays the domain result with the same idempotency key before completing the plan

#### Scenario: Concurrent confirmation occurs during a lease
- **WHEN** another confirmation arrives before the active execution lease expires
- **THEN** it receives a retryable conflict and does not dispatch the executor

## MODIFIED Requirements

### Requirement: Typed agent event stream
The AI chat endpoint SHALL stream typed events for assistant text, tool status, action plans, errors, and completion, SHALL preserve request and conversation correlation identifiers, and SHALL identify the requested and actually selected model plus whether fallback was used.

#### Scenario: Text and tool events share a stream
- **WHEN** the model emits text and invokes an allowed read tool
- **THEN** the client receives parseable ordered events and renders the final assistant text plus tool summary

#### Scenario: Stream chunks split an event
- **WHEN** an SSE event is divided across multiple network chunks
- **THEN** the client buffers the fragments and processes the event exactly once after the frame is complete

#### Scenario: Client disconnects
- **WHEN** the client disconnects after sending a valid message
- **THEN** the registered request-lifecycle work continues consuming the model stream and persists the completed assistant message or normalized failure state

### Requirement: AI requests and actions are bounded
The system SHALL apply per-user distributed request and action-confirmation rate limits, a global daily chat quota, provider timeouts, and a distributed bounded provider circuit without logging message content or secrets.

#### Scenario: User exceeds request limit
- **WHEN** an authenticated user exceeds the configured chat request budget for the current window
- **THEN** the endpoint returns a retryable rate-limit response before invoking the model

#### Scenario: Provider exceeds timeout
- **WHEN** the configured provider deadline elapses
- **THEN** the model call is aborted, a normalized failure is persisted, and no unconfirmed mutation executes

#### Scenario: Provider circuit is open
- **WHEN** consecutive provider failures reach the configured threshold during its cooldown across any application instance
- **THEN** new model calls fail fast while direct authorized action confirmation remains governed by its own switches
