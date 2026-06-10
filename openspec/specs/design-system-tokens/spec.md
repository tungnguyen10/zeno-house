## Purpose

Establishes Zeno House as a dark operational UI and codifies the visual tokens — surfaces, text hierarchy, typography scale, radius/spacing, and semantic status categories — that every primitive, pattern, and screen must reuse so operational pages stay dense, predictable, and consistent.

## Requirements

### Requirement: Dark operational token usage
The design system SHALL define Zeno House as a dark operational UI using the existing Tailwind tokens as the primary visual source of truth.

#### Scenario: Dark surfaces are used consistently
- **WHEN** a new operational screen is built
- **THEN** page background uses `dark`, shell surfaces use `dark-card`, content surfaces use `dark-surface`, hover states use `dark-hover`, and dividers use `dark-border`

#### Scenario: Text hierarchy is consistent
- **WHEN** text is rendered on dark surfaces
- **THEN** primary text uses `text-white`, secondary/helper text uses `text-muted`, and accent links/actions use `text-cyan` where appropriate

#### Scenario: No light theme assumption
- **WHEN** a component is implemented
- **THEN** it is optimized for the existing dark theme and does not require light-mode styles

### Requirement: Operational typography scale
The design system SHALL define a compact typography scale for operational screens.

#### Scenario: Page title
- **WHEN** a page title is rendered
- **THEN** it uses compact page title scale, approximately `text-xl font-semibold`

#### Scenario: Section title
- **WHEN** a section title is rendered inside a workspace or panel
- **THEN** it uses smaller section scale, approximately `text-sm font-semibold`

#### Scenario: Dense body text
- **WHEN** tables, forms, and workspace rows are rendered
- **THEN** primary body text uses `text-sm` and metadata/helper text uses `text-xs text-muted`

### Requirement: Radius and spacing rules
The design system SHALL define radius and spacing rules that keep operational screens dense and predictable.

#### Scenario: Controls
- **WHEN** buttons, inputs, selects, and textareas are rendered
- **THEN** they use control radius around `rounded-md`

#### Scenario: Panels
- **WHEN** repeated panels or cards are rendered
- **THEN** they use no more than `rounded-xl` unless an existing primitive requires otherwise

#### Scenario: No nested card pattern
- **WHEN** a page section contains repeated content
- **THEN** the implementation avoids unnecessary card-inside-card visual nesting

### Requirement: Semantic status tokens
The design system SHALL define semantic status categories mapped to existing dark theme colors.

#### Scenario: Neutral status
- **WHEN** an item is draft, inactive, or informational
- **THEN** it uses a muted/neutral style

#### Scenario: In-progress status
- **WHEN** an item is active, readings, collecting, or in progress
- **THEN** it uses a cyan/accent style

#### Scenario: Success status
- **WHEN** an item is paid, closed, complete, or successful
- **THEN** it uses a success style

#### Scenario: Warning status
- **WHEN** an item needs review, is partial, replacement, or adjustment
- **THEN** it uses a warning style

#### Scenario: Danger status
- **WHEN** an item is overdue, blocked, void, destructive, or error
- **THEN** it uses an error/danger style
