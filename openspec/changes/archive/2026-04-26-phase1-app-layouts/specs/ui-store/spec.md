## ADDED Requirements

### Requirement: useUiStore manages sidebar open state
The system SHALL have a `useUiStore` Pinia store in `app/stores/ui.ts` that exposes `sidebarOpen` (boolean, default `false`) and `toggleSidebar()` / `closeSidebar()` actions.

#### Scenario: toggleSidebar flips state
- **WHEN** `toggleSidebar()` is called
- **THEN** `sidebarOpen` changes from `false` to `true` or vice versa

#### Scenario: closeSidebar always sets to false
- **WHEN** `closeSidebar()` is called
- **THEN** `sidebarOpen` is `false` regardless of previous state

#### Scenario: Sidebar closes on route change
- **WHEN** the user navigates to a new page (route changes)
- **THEN** `closeSidebar()` is called automatically (watcher in layout)
