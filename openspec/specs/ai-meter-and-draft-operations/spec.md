# ai-meter-and-draft-operations Specification

## Purpose
Define deterministic, scope-safe AI workflows for meter import and correction, server-authoritative billing draft explanation, and confirmed utility usage overrides with atomic audited writes.
## Requirements
### Requirement: Meter import reads authoritative stored message content
The AI assistant SHALL parse meter input deterministically from the current authenticated user's stored message and SHALL NOT accept model-generated raw text or numeric reading arrays as the import source.

#### Scenario: User pastes supported tabular data
- **WHEN** the user sends a message containing a supported header and delimited meter rows and invokes meter import preview
- **THEN** the server reloads that owned stored message and derives the numeric rows with the deterministic parser

#### Scenario: Model supplies numeric rows
- **WHEN** a model attempts to pass reconstructed readings or alternate raw text to the import tool
- **THEN** the tool schema does not accept those values and no action plan is created from them

#### Scenario: Stored message is foreign or stale
- **WHEN** the parser cannot load the current message as an owned message in the active conversation
- **THEN** the preview fails without exposing message content or creating a plan

### Requirement: Meter import preview is scoped and classified
The meter import planner SHALL resolve the building within user scope, resolve rooms exactly within that building, and return normalized rows with warnings and blockers before creating an action plan.

#### Scenario: Every row is valid
- **WHEN** all room references resolve uniquely, values are valid, and affected resources are editable
- **THEN** the preview returns normalized UUID-based readings and may create one pending import action

#### Scenario: A row cannot be resolved
- **WHEN** a room is unknown or ambiguous within the resolved building
- **THEN** the preview identifies the source row as a blocker and creates no action plan

#### Scenario: Input contains malformed or duplicate values
- **WHEN** a numeric cell is invalid or the paste repeats the same room and meter
- **THEN** the preview returns line-specific blockers and creates no action plan

#### Scenario: Input contains a non-blocking anomaly
- **WHEN** a valid reading is unusually low, unusually high, or leaves an optional utility cell blank
- **THEN** the preview preserves the normalized supplied values and returns an explicit warning for user review

### Requirement: Meter import commit uses the previewed payload
The AI assistant SHALL store the complete normalized import payload and resource versions in the action plan and SHALL commit that exact payload only after direct action-card confirmation.

#### Scenario: User confirms a valid import plan
- **WHEN** the owner confirms a pending meter import action and resource versions and locks remain valid
- **THEN** all previewed readings and their audit rows are committed atomically without reparsing or asking the model to reproduce the data

#### Scenario: One commit row fails
- **WHEN** any reading fails validation, lock, persistence, or version checks during confirmation
- **THEN** no reading or audit row from the action is committed

#### Scenario: Previewed resource changed
- **WHEN** a reading, period, or invoice state changes after preview
- **THEN** confirmation returns a conflict, marks the action stale when applicable, and performs no partial save

### Requirement: Conversational meter correction is planned and versioned
The AI assistant SHALL expose meter-reading correction only as a pending action containing the reading ID, corrected fields, before/after preview, and expected reading version.

#### Scenario: Correction is confirmed
- **WHEN** the owner confirms a valid correction action and the expected version still matches
- **THEN** the reading and its audit event are updated atomically

#### Scenario: Concurrent correction wins first
- **WHEN** another request updates the reading before confirmation
- **THEN** confirmation returns an optimistic conflict and does not overwrite the newer value

#### Scenario: Chat contains confirmation text
- **WHEN** the user or model says the correction is confirmed in chat
- **THEN** no reading changes until the action-card endpoint is invoked

### Requirement: AI draft calculation is server authoritative
The AI assistant SHALL calculate billing drafts through the existing scoped billing draft service and SHALL return deterministic totals, line items, warnings, blockers, and next-step categories without performing a mutation.

#### Scenario: Draft is ready
- **WHEN** an authorized user requests a draft for an accessible period with complete inputs
- **THEN** the tool returns server-computed draft rows and a summary derived from those rows

#### Scenario: Draft has input problems
- **WHEN** draft calculation reports missing readings, negative usage, unsupported pricing, or another blocker
- **THEN** the tool preserves the authoritative blocker details and identifies correction as the next step

#### Scenario: Model proposes a different total
- **WHEN** model text conflicts with a tool-returned total
- **THEN** no stored billing value changes and the server-returned calculation remains authoritative

### Requirement: Utility usage override is planned before commit
The AI assistant SHALL validate and preview a scoped utility usage override, store its complete normalized payload and expected version, and commit it only through a registered confirmed executor.

#### Scenario: New override is confirmed
- **WHEN** an authorized owner confirms a valid override plan for an editable room and period
- **THEN** the override and its audit event are committed atomically from the stored payload

#### Scenario: Existing override is stale
- **WHEN** the existing override changes after planning
- **THEN** confirmation returns an optimistic conflict and preserves the newer override

#### Scenario: Room has active invoice
- **WHEN** the target room has a non-void invoice for the period
- **THEN** planning or confirmation rejects the override and creates no billing change

### Requirement: Meter and draft tools remain policy controlled
The server SHALL expose each meter/draft tool and executor only through the deny-by-default registry when the authenticated user holds its required capability.

#### Scenario: Read-only user requests a draft
- **WHEN** the user holds `billing.read`
- **THEN** the draft calculation tool may be exposed without exposing meter or override mutation planners

#### Scenario: User lacks write capability
- **WHEN** the user lacks the capability required by a meter or override planner
- **THEN** that planner and its executor are unavailable and no action is created
