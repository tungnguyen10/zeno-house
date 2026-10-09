## ADDED Requirements

### Requirement: Scope resolution separates permission from visibility
`server/utils/scope.ts` SHALL expose a visibility-aware building scope alongside the existing assignment scope. The assignment scope SHALL keep its current semantics, returning `null` for admin and the assigned identifiers for owner and manager. The visibility-aware scope SHALL return the assignment scope minus hidden buildings, and SHALL return `null` for an admin only when no building is hidden. Both SHALL resolve at most once per request.

#### Scenario: Admin with no hidden buildings stays unscoped
- **WHEN** an admin resolves the visibility-aware scope and no building is hidden
- **THEN** the result is `null`

#### Scenario: Admin with hidden buildings receives an explicit list
- **WHEN** an admin resolves the visibility-aware scope and at least one building is hidden
- **THEN** the result lists every non-hidden building identifier

#### Scenario: Manager loses hidden assignments
- **WHEN** a manager assigned to two buildings resolves the visibility-aware scope and one of them is hidden
- **THEN** the result contains only the visible assigned building

#### Scenario: Assignment scope ignores visibility
- **WHEN** any user resolves the assignment scope
- **THEN** hidden buildings are still present in the result

### Requirement: List and aggregate reads exclude hidden buildings
Services returning browsable collections or aggregated figures SHALL scope by the visibility-aware building scope. This SHALL cover building, room, contract, tenant, and meter-reading listings, invoice, billing-period and billing queries, the operator support-request queue, the dashboard summary, and AI building listing and resolution.

Administrative surfaces that manage accounts and permissions SHALL keep the assignment scope, because hiding is a presentation choice and must not remove an operator's ability to administer an account. This SHALL cover manager assignment management, internal user management, and the tenant-account list.

#### Scenario: Rooms of a hidden building disappear from the list
- **WHEN** a user lists rooms and one building is hidden
- **THEN** no room belonging to that building is returned

#### Scenario: Billing periods of a hidden building disappear from the queue
- **WHEN** a user lists billing periods and one building is hidden
- **THEN** no period belonging to that building is returned

#### Scenario: Account administration still reaches a hidden building
- **WHEN** an administrator opens manager assignments or the tenant-account list
- **THEN** records belonging to a hidden building are still listed

#### Scenario: Dashboard totals drop a hidden building
- **WHEN** a building is hidden
- **THEN** the dashboard summary no longer counts its rooms, contracts, or revenue

#### Scenario: Cached dashboard reflects a visibility change
- **WHEN** a building's visibility changes while a cached dashboard summary is still within its time-to-live
- **THEN** the next summary request reflects the new visibility rather than the cached value

### Requirement: Detail and write authorization ignores visibility
Building-scoped authorization checks for a single record SHALL NOT consider visibility. A hidden building SHALL behave exactly as a visible one for authorization, returning not-found only when the caller lacks assignment scope and forbidden only when the caller lacks the capability.

#### Scenario: Write to a hidden building in scope
- **WHEN** a user with the capability and assignment scope writes to a record in a hidden building
- **THEN** the write succeeds

#### Scenario: Tenant portal is unaffected
- **WHEN** a tenant whose contract belongs to a hidden building loads the portal
- **THEN** their contract, room, and invoices resolve normally
