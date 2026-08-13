## MODIFIED Requirements

### Requirement: Dark operational token usage
The design system SHALL provide semantic operational color tokens backed by the existing dark palette and an approved light dashboard palette. Dashboard code SHALL consume semantic surface, content, border, action, and status roles instead of appearance-specific color names.

#### Scenario: Semantic surfaces are used consistently
- **WHEN** an operational screen or primitive is built
- **THEN** page canvas, shell chrome, content surface, hover surface, deep surface, subtle border, and strong control border use their corresponding semantic Tailwind tokens

#### Scenario: Text hierarchy is consistent in both themes
- **WHEN** text is rendered in the dashboard
- **THEN** primary, secondary, accent, and on-accent content use semantic tokens that preserve hierarchy and contrast in the resolved theme

#### Scenario: Dark remains the fallback outside dashboard light mode
- **WHEN** semantic primitives render without an active light dashboard document theme
- **THEN** their resolved values match the established dark operational palette

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
