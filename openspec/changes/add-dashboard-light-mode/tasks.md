## 1. Theme Foundation

- [x] 1.1 Add failing unit tests for preference resolution, persistence, system changes, storage failures, and lifecycle cleanup
- [x] 1.2 Implement the dashboard theme resolver/composable and pre-paint bootstrap
- [x] 1.3 Add semantic Tailwind color mappings and dark/light CSS variable palettes

## 2. Shell and Shared Presentation

- [x] 2.1 Add failing AppHeader/layout tests for the accessible theme toggle and document lifecycle
- [x] 2.2 Integrate theme initialization, cleanup, browser theme color, and the global header toggle
- [x] 2.3 Migrate shared `Ui*` primitives, shell components, AI chat, and skeleton styles to semantic tokens

## 3. Dashboard Migration

- [x] 3.1 Migrate dashboard pages and domain components to semantic surface, content, border, action, and status tokens
- [x] 3.2 Refactor the dashboard Chart.js palette/options to react to theme changes and add focused tests
- [x] 3.3 Add a source contract test that rejects dark-only utilities in dashboard-bound UI with explicit print/overlay allowlists

## 4. Documentation and Verification

- [x] 4.1 Update current specs and frontend/design-system/UI-polish guidance for the dual-theme semantic contract
- [x] 4.2 Run OpenSpec validation, focused tests, typecheck, production build, full tests, and lint
- [ ] 4.3 Perform desktop/mobile visual and interaction-state polish after approval to start the local runtime
