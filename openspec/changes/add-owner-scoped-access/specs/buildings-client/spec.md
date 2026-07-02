## ADDED Requirements

### Requirement: Owner sees scoped building management controls
Building client pages SHALL show create/update/delete controls to owner when the action is permitted for the current building scope.

#### Scenario: Owner sees create building
- **WHEN** owner opens building list
- **THEN** create building action is visible

#### Scenario: Owner sees edit for scoped building
- **WHEN** owner opens detail page for assigned building
- **THEN** edit action is visible

#### Scenario: Owner does not see unscoped building
- **WHEN** owner opens building list
- **THEN** unassigned buildings are not rendered

---

### Requirement: Owner destructive controls respect safety state
Owner delete/archive controls SHALL be hidden or disabled when business rules would block the action, and server SHALL remain authoritative.

#### Scenario: Owner delete enabled for empty building
- **WHEN** owner views an assigned building with no delete blockers
- **THEN** delete action is available

#### Scenario: Owner delete disabled for blocked building
- **WHEN** owner views an assigned building with rooms, active contracts, invoices, or payments
- **THEN** delete action is disabled or archive-only with explanatory UI

#### Scenario: Direct API still blocks
- **WHEN** owner bypasses UI and calls delete for a blocked building
- **THEN** API returns 409 Conflict or 403 Forbidden according to the violated rule
