## ADDED Requirements

### Requirement: Shared primitives consume semantic theme tokens
All shared `Ui*` primitives used by dashboard routes SHALL consume semantic Tailwind color tokens for surfaces, content, borders, actions, feedback, focus, loading, disabled, error, and success states. They SHALL resolve to the existing dark presentation outside an active light dashboard.

#### Scenario: Primitive renders in light dashboard
- **WHEN** a shared primitive renders while the dashboard document theme is light
- **THEN** every theme-sensitive state uses the light semantic values without requiring a theme prop

#### Scenario: Primitive retains dark auth fallback
- **WHEN** the same primitive renders on an auth route without an active light dashboard theme
- **THEN** it retains the established dark operational presentation

#### Scenario: Overlay primitive follows dashboard theme
- **WHEN** a primitive teleports its content to the document body
- **THEN** the teleported content resolves the active dashboard semantic variables
