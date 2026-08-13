## Purpose

Establishes Zeno House as a dual-theme operational UI and codifies semantic visual tokens — surfaces, text hierarchy, typography scale, radius/spacing, and status categories — that every primitive, pattern, and screen must reuse so operational pages stay dense, predictable, and consistent.

## Requirements

### Requirement: Dark operational token usage
The design system SHALL provide semantic operational color tokens backed by the existing dark palette and an approved light dashboard palette. Dashboard code SHALL consume semantic surface, content, border, action, and status roles instead of appearance-specific color names.

#### Scenario: Semantic surfaces are used consistently
- **WHEN** a new operational screen is built
- **THEN** page canvas, shell chrome, content surface, hover surface, deep surface, subtle border, and strong control border use their corresponding semantic Tailwind tokens

#### Scenario: Text hierarchy is consistent in both themes
- **WHEN** text is rendered in the dashboard
- **THEN** primary, secondary, accent, and on-accent content use semantic tokens that preserve hierarchy and contrast in the resolved theme

#### Scenario: Dark remains the fallback outside dashboard light mode
- **WHEN** semantic primitives render without an active light dashboard document theme
- **THEN** their resolved values match the established dark operational palette

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
The design system SHALL define semantic status categories whose foreground and soft-surface values adapt to the resolved dashboard theme without changing domain meaning.

#### Scenario: Neutral status
- **WHEN** an item is draft, inactive, or informational
- **THEN** it uses a theme-aware muted/neutral style

#### Scenario: In-progress status
- **WHEN** an item is active, readings, collecting, or in progress
- **THEN** it uses the theme-aware accent style

#### Scenario: Success status
- **WHEN** an item is paid, closed, complete, or successful
- **THEN** it uses the theme-aware success style

#### Scenario: Warning status
- **WHEN** an item needs review, is partial, replacement, or adjustment
- **THEN** it uses the theme-aware warning style

#### Scenario: Danger status
- **WHEN** an item is overdue, blocked, void, destructive, or error
- **THEN** it uses the theme-aware danger style
