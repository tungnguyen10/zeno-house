## ADDED Requirements

### Requirement: Building automatic invoice-email setting
When invoice email is globally enabled, building settings SHALL present a focused automatic invoice-email control using the existing design system and building-scope permissions.

#### Scenario: Owner or admin views editable setting
- **WHEN** an admin or scoped owner opens building settings
- **THEN** the page shows the current auto-send value, explains that it applies only to future issued invoices, and permits saving the toggle

#### Scenario: Manager views read-only setting
- **WHEN** a scoped manager opens the same settings surface
- **THEN** the value and explanatory state are visible but no mutation control is available

#### Scenario: Automatic delivery is enabled
- **WHEN** an authorized user confirms enabling auto-send
- **THEN** the saved state applies to future period issue, issue-and-pay, and reissue operations and does not enqueue historical invoices

#### Scenario: Save fails
- **WHEN** the setting update fails validation, permission, scope, or server persistence
- **THEN** the prior toggle value remains visible and an inline retryable error is shown without affecting other building settings

#### Scenario: Email feature is disabled globally
- **WHEN** the global invoice-email feature flag is off
- **THEN** the automation control is unavailable and no parallel theme, primitive, or settings convention is introduced

