# ai-agent-foundation Specification

## Purpose
Define the trusted server-owned conversation, tool-policy, structured-streaming, action-plan, idempotency, telemetry, and retention foundation used by domain-specific Zeno House AI operations.
## Requirements
### Requirement: Server-owned conversation persistence
The system SHALL persist authenticated AI conversations and their user and assistant messages as server-owned state, SHALL restrict API access to the owning user, and SHALL expire the conversation state after 30 days.

#### Scenario: Authenticated conversation resumes
- **WHEN** an authenticated user sends another message using an unexpired conversation they own
- **THEN** the server loads the authoritative stored history and appends the new exchange

#### Scenario: Foreign conversation is hidden
- **WHEN** a user requests or appends to a conversation owned by another user
- **THEN** the system returns NOT_FOUND without revealing that the conversation exists

#### Scenario: Expired conversation is unavailable
- **WHEN** a user sends a message using a conversation whose retention window has expired
- **THEN** the system rejects the stale conversation and requires a new conversation

### Requirement: Direct database access to agent state is denied
The system SHALL enable RLS on AI persistence tables and SHALL deny direct `anon` and `authenticated` table access so conversation and action state is reachable only through authorized server services.

#### Scenario: Authenticated Data API access is attempted
- **WHEN** an authenticated browser client directly selects, inserts, updates, or deletes an AI persistence row
- **THEN** Postgres privileges and RLS deny the operation

### Requirement: Deny-by-default tool policy
The agent SHALL expose only explicitly registered tools whose required capability is held by the authenticated user, and the model SHALL have no database, web-browsing, external side-effect, or generic commit tool.

#### Scenario: User lacks tool capability
- **WHEN** an authenticated user lacks the capability required by a registered tool
- **THEN** that tool is omitted from the model-visible registry

#### Scenario: Unknown tool is requested
- **WHEN** a model response attempts to invoke a tool that is not in the request registry
- **THEN** the request does not execute any domain operation

#### Scenario: Tool loop reaches its limit
- **WHEN** model tool execution reaches the configured per-request step limit
- **THEN** the system stops further tool execution and emits a structured terminal error or completion

### Requirement: Typed agent event stream
The AI chat endpoint SHALL stream typed events for assistant text, tool status, action plans, errors, and completion, and SHALL preserve request and conversation correlation identifiers.

#### Scenario: Text and tool events share a stream
- **WHEN** the model emits text and invokes an allowed read tool
- **THEN** the client receives parseable ordered events and renders the final assistant text plus tool summary

#### Scenario: Stream chunks split an event
- **WHEN** an SSE event is divided across multiple network chunks
- **THEN** the client buffers the fragments and processes the event exactly once after the frame is complete

#### Scenario: Client disconnects
- **WHEN** the client disconnects after sending a valid message
- **THEN** the server continues consuming the model stream and persists the completed assistant message or normalized failure state

### Requirement: Server-owned action plan lifecycle
The system SHALL represent every proposed mutation as an owned, expiring action plan with normalized payload, payload hash, preview, resource versions, server-generated idempotency key, and a compare-and-set lifecycle.

#### Scenario: Plan is created
- **WHEN** an allowed planning tool produces a valid mutation preview
- **THEN** the server stores a pending action plan with a server-generated idempotency key and returns an action-card event without executing the mutation

#### Scenario: Model attempts direct confirmation
- **WHEN** model output contains confirmation language, `confirmed: true`, or an idempotency value
- **THEN** no mutation executes because confirmation is accepted only by the authenticated action confirmation endpoint

#### Scenario: Plan expires before confirmation
- **WHEN** the owner confirms a plan after its expiry
- **THEN** the system marks or treats the plan as expired and performs no mutation

### Requirement: Action confirmation and cancellation
The system SHALL allow only the owning authenticated user to confirm or cancel a pending action plan through dedicated server endpoints, and SHALL revalidate current policy and resource versions before dispatching an executor.

#### Scenario: Owner confirms pending plan
- **WHEN** the owner confirms an unexpired pending plan and authorization and versions remain valid
- **THEN** the system claims the plan once and dispatches its registered executor

#### Scenario: Foreign user confirms plan
- **WHEN** a different user attempts to confirm or cancel the plan
- **THEN** the system returns NOT_FOUND and performs no action

#### Scenario: Owner cancels pending plan
- **WHEN** the owner cancels an unexpired pending plan
- **THEN** the plan becomes cancelled and cannot later execute

#### Scenario: Resource version changed
- **WHEN** a confirmation finds that an update target no longer matches the plan resource version
- **THEN** the system returns CONFLICT, marks the plan stale, and performs no mutation

### Requirement: Idempotent action replay
The system SHALL generate and durably store the idempotency key for each plan and SHALL return the stored result when a succeeded plan is confirmed again.

#### Scenario: Successful plan is reconfirmed
- **WHEN** the owner repeats confirmation for a succeeded plan
- **THEN** the system returns the prior result without dispatching the executor again

#### Scenario: Concurrent confirmations race
- **WHEN** two confirmations attempt to claim the same pending plan concurrently
- **THEN** at most one confirmation dispatches the executor

### Requirement: Foundation does not expose billing mutations
The foundation wave SHALL retain authorized read tools but SHALL NOT expose direct billing mutation tools until a later domain change implements the action-plan contract.

#### Scenario: Existing direct period-open tool is requested
- **WHEN** the model attempts to call the legacy direct period-opening tool after the foundation is enabled
- **THEN** the tool is unavailable and no period is created

### Requirement: Agent lifecycle telemetry
The system SHALL record structured request, model, tool, action-plan, duration, and error correlation metadata without logging full message content or secrets.

#### Scenario: Tool execution completes
- **WHEN** an allowed tool succeeds or fails
- **THEN** structured diagnostics include request ID, conversation ID, tool name, duration, outcome, and normalized error category

### Requirement: Current-state documentation
The project SHALL maintain current architecture and status documentation for the implemented agent foundation and SHALL describe later billing waves only as planned work.

#### Scenario: Foundation change is archived
- **WHEN** the foundation implementation is verified and archived
- **THEN** architecture, routing, invariants, and project-status docs match the source and do not claim later billing tools are implemented

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

