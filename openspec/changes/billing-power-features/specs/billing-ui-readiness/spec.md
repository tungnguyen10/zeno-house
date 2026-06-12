## MODIFIED Requirements

### Requirement: Billing-ready compact editing
Billing UI readiness SHALL include compact primitive controls for meter readings, charge review, invoice adjustments, correction reason capture, and payment entry, plus support for clipboard paste and keyboard-driven row navigation in the meter readings grid.

#### Scenario: Meter reading entry can use compact controls
- **WHEN** the monthly billing workspace renders a readings table
- **THEN** old reading, new reading, billable usage, replacement/reset flags, and notes can be entered with compact primitive controls

#### Scenario: Meter reading entry supports clipboard paste
- **WHEN** the user pastes multi-row text into a focused new-reading cell
- **THEN** the design system supports cell-level paste, multi-row fill, and visual highlight of affected cells

#### Scenario: Meter reading entry supports keyboard navigation
- **WHEN** the user presses `Tab`, `Shift+Tab`, `Enter`, or `Shift+Enter` in a draft cell
- **THEN** focus moves predictably between editable cells using the documented navigation pattern

#### Scenario: Charge review can use compact controls
- **WHEN** the monthly billing workspace renders charge review lines
- **THEN** quantities, unit prices, adjustments, and notes can be displayed or edited without custom inline form classes

#### Scenario: Required reason capture
- **WHEN** the user performs a destructive billing action (void invoice, reissue invoice, unissue period, save meter override, create negative adjustment of significant magnitude)
- **THEN** the design system provides a textarea pattern with a live character counter and disables submit until the trimmed reason reaches the minimum length

## ADDED Requirements

### Requirement: Bulk-select pattern in billing tables
The design system SHALL provide a bulk-select pattern for billing tables consisting of a leading checkbox column, a select-all toggle in the header, and a sticky action bar that surfaces aggregate actions when at least one row is selected.

#### Scenario: Per-row checkbox
- **WHEN** a billing table supports a bulk action (e.g. payments tab, future invoice operations)
- **THEN** rows that qualify expose a leading checkbox primitive that contributes to the selection state

#### Scenario: Select-all in header
- **WHEN** the table header is rendered with bulk-select enabled
- **THEN** a header checkbox toggles selection of all currently visible eligible rows

#### Scenario: Sticky action bar
- **WHEN** at least one row is selected
- **THEN** a sticky action bar appears showing the selected count and one or more aggregate action buttons; clearing the selection hides the bar

### Requirement: Inline 2-line mobile data row
The design system SHALL document an inline 2-line row pattern for dense data tables on mobile, used by the billing draft grid and other table-like views.

#### Scenario: Two-line layout
- **WHEN** a dense table is adapted to mobile widths
- **THEN** line one shows primary identity plus the most important editable value; line two shows breakdown in compact muted typography

#### Scenario: Pattern documented in design system
- **WHEN** developers consult the design system documentation
- **THEN** the inline 2-line row pattern is shown with examples and class conventions, replacing ad-hoc `hideOnMobile` flags
