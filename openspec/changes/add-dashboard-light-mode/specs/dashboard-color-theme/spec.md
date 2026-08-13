## ADDED Requirements

### Requirement: Dashboard resolves and persists color theme
The dashboard SHALL support `system`, `light`, and `dark` preferences. A missing or invalid stored value SHALL resolve from the operating-system preference, while an explicit light or dark selection SHALL persist for future dashboard visits.

#### Scenario: First visit follows the system
- **WHEN** an operator visits `/dashboard` without a valid stored preference
- **THEN** the dashboard resolves to the current `prefers-color-scheme` value

#### Scenario: Explicit selection is remembered
- **WHEN** an operator changes the dashboard from its resolved theme
- **THEN** the resulting explicit light or dark preference is stored and used on the next dashboard visit

#### Scenario: System preference remains reactive
- **WHEN** the preference is `system` and the operating-system color scheme changes
- **THEN** the rendered dashboard updates to the new resolved scheme

### Requirement: Dashboard theme is applied before paint and scoped to dashboard
The resolved dashboard theme SHALL be applied to the document before the dashboard first paints, SHALL cover overlays teleported outside the dashboard layout node, and SHALL be removed when the dashboard shell is no longer active.

#### Scenario: Dashboard reload does not flash the wrong theme
- **WHEN** `/dashboard` loads with a stored light preference or a light system preference
- **THEN** the light document theme is present before dashboard styles paint

#### Scenario: Teleported surfaces inherit theme
- **WHEN** a modal, drawer, dropdown, or toast is rendered under the light dashboard
- **THEN** it uses the same light semantic tokens as the dashboard content

#### Scenario: Theme does not leak to other shells
- **WHEN** client navigation leaves `/dashboard` for auth or portal routes
- **THEN** the dashboard document theme is cleared and the destination shell retains its own theme contract

### Requirement: Dashboard exposes an accessible theme toggle
The dashboard global action rail SHALL expose an icon-only control that switches between explicit light and dark preferences without changing routes or page state.

#### Scenario: Toggle communicates the next action
- **WHEN** the resolved dashboard theme is dark
- **THEN** the control displays the sun icon and an accessible Vietnamese label for switching to light mode

#### Scenario: Toggle is keyboard and touch accessible
- **WHEN** the control is focused or used at a mobile viewport
- **THEN** it has a visible focus indicator and a target of at least 44 by 44 CSS pixels

### Requirement: Dashboard light palette preserves operational readability
The light dashboard SHALL use the approved cool operational palette and semantic status roles, with normal text and interactive indicators meeting their applicable contrast targets.

#### Scenario: Light operational palette
- **WHEN** the resolved dashboard theme is light
- **THEN** the canvas is `#F4F7FA`, surfaces are white, primary text is `#17212B`, muted text is `#5B6B7A`, and accent is `#007C91`

#### Scenario: Status meaning remains stable
- **WHEN** an entity, billing, warning, success, or danger state renders in either theme
- **THEN** its semantic category and label remain unchanged while its foreground and soft-surface colors adapt for contrast
