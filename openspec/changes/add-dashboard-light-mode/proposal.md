## Why

The internal dashboard is hard-coded to a dark palette, so operators cannot use a readable light presentation or follow their operating-system preference. The current color names also encode appearance instead of semantic roles, making a second theme unsafe to add through isolated overrides.

## What Changes

- Add system-aware light and dark preferences for every `/dashboard` route, with persisted explicit selection and a global header toggle.
- Apply the resolved dashboard theme before first paint and across teleported overlays without changing auth or tenant portal theming.
- Introduce semantic Tailwind color tokens backed by CSS variables and migrate dashboard surfaces, content, controls, status treatments, charts, and interaction states to those tokens.
- Preserve invoice print colors, dashboard density, Inter typography, cyan identity in dark mode, and existing status meaning.
- Update design-system guidance and automated tests to prevent dark-only utilities from returning to dashboard UI.

## Capabilities

### New Capabilities
- `dashboard-color-theme`: Dashboard theme preference, resolution, persistence, first-paint behavior, toggle interaction, and route scoping.

### Modified Capabilities
- `design-system-tokens`: Replace the dark-only operational color contract with semantic dual-theme tokens.
- `ui-dark-theme`: Make service-related operational UI render correctly in both dashboard themes while retaining the historical capability path.
- `admin-shell`: Add the global theme action and theme lifecycle to the internal shell.
- `ui-primitives`: Require shared primitives to consume semantic tokens and render correctly in either dashboard theme.

## Impact

- Affects Tailwind configuration, global theme variables, dashboard layout/header, shared UI primitives, dashboard/domain components, and Chart.js presentation options.
- Adds a dashboard-only browser preference stored under `dashboard-theme-preference`; no API, database, permission, or route contract changes.
- Adds no runtime dependency. Auth remains dark-first and tenant portal continues to use its independent `--portal-*` theme contract.
