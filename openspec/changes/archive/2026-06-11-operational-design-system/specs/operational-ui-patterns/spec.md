## ADDED Requirements

### Requirement: Operational page structure
Operational pages SHALL use a consistent structure for page context, filters, summary, and content.

#### Scenario: Page header pattern
- **WHEN** a new operational page is built
- **THEN** it uses a compact page header with title, optional description/context, and action slot

#### Scenario: Filter toolbar pattern
- **WHEN** a page has filters or search
- **THEN** filters are grouped in a toolbar using consistent control height and spacing

#### Scenario: Summary metrics pattern
- **WHEN** a page shows operational totals
- **THEN** it uses compact metrics suitable for scanning rather than oversized dashboard cards

### Requirement: Data table pattern
Operational lists SHALL prefer structured tables or dense rows over decorative cards when users need to scan, compare, or act on many records.

#### Scenario: Many rows
- **WHEN** a screen displays many comparable entities
- **THEN** it uses `UiTable` or a dense list pattern instead of card grids

#### Scenario: Monetary and numeric values
- **WHEN** rows include money, meter readings, totals, or counts
- **THEN** numeric columns are right-aligned and use stable formatting

#### Scenario: Row actions
- **WHEN** rows support open/edit/correction actions
- **THEN** actions are placed consistently at the row end or in a toolbar action area

### Requirement: Workspace pattern
Multi-step operational workflows SHALL use a workspace pattern with persistent context and tabbed/step navigation.

#### Scenario: Workspace context
- **WHEN** a user enters a workspace
- **THEN** the top of the workspace shows the subject, period/context, status, and primary actions

#### Scenario: Workspace tabs
- **WHEN** a workspace has multiple operational steps
- **THEN** the steps are navigable through tabs or a comparable stable workspace navigation primitive

#### Scenario: Blocked step
- **WHEN** a workspace step cannot proceed due to missing input or invalid state
- **THEN** the UI shows the blocker through a consistent alert/status pattern

### Requirement: Form pattern
Forms SHALL use standardized controls, sectioning, and action placement.

#### Scenario: Form controls
- **WHEN** a form needs input, select, textarea, checkbox, or toggle controls
- **THEN** it uses the corresponding UI primitive instead of hand-written control classes

#### Scenario: Form actions
- **WHEN** a form has save/cancel actions
- **THEN** actions are grouped consistently at the end of the form or modal footer

#### Scenario: Inline help
- **WHEN** a field needs explanatory text
- **THEN** it uses primitive hint/helper text styling rather than ad-hoc muted paragraphs

### Requirement: Feedback states
Operational screens SHALL represent loading, empty, error, warning, and blocked states consistently.

#### Scenario: Loading state
- **WHEN** content is loading
- **THEN** the page uses skeleton/table loading states that preserve layout

#### Scenario: Empty state
- **WHEN** a list or table has no records
- **THEN** the page uses `UiEmptyState` or table empty state with optional action

#### Scenario: Error state
- **WHEN** an API or workflow error occurs
- **THEN** the page uses `UiAlert` with appropriate severity

#### Scenario: Blocked state
- **WHEN** a workflow cannot proceed because of business rules
- **THEN** the page uses warning/danger alert and disables unsafe actions

### Requirement: Correction surface pattern
Operational corrections SHALL use explicit surfaces that preserve context and avoid silent edits.

#### Scenario: Short destructive confirmation
- **WHEN** a user confirms a destructive action such as void
- **THEN** the UI uses a modal with clear title, reason/context, and destructive action

#### Scenario: Dense correction form
- **WHEN** a user edits dense correction data such as utility usage override or adjustment line
- **THEN** the UI uses a modal or drawer with structured fields, visible source context, and explicit save/cancel actions

### Requirement: Primitive showcase page
The system SHALL provide a single internal page that renders every primitive in `app/components/ui/` so the design system can be reviewed visually without launching every domain screen.

#### Scenario: Showcase covers all primitives
- **WHEN** a primitive is added or changed in `app/components/ui/`
- **THEN** the showcase page renders an example of it with its main variants/states (variants, sizes, error/disabled/loading, slots) so a reviewer can confirm the visual without cross-referencing domain pages

#### Scenario: Showcase composes itself from primitives
- **WHEN** the showcase page is implemented
- **THEN** it uses `UiPageHeader`, `UiSection`, and other primitives for its own layout instead of ad-hoc markup, demonstrating the patterns it documents

