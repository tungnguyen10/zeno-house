# Design

## Context

The app already reads as a dark operational tool:

- background: `bg-dark`
- shell/card surface: `bg-dark-card`, `bg-dark-surface`
- borders: `border-dark-border`
- text: `text-white`, `text-muted`
- accent: `cyan`
- semantic colors: success, warning, error
- font: Inter

The missing piece is not a new visual direction. The missing piece is a formal system that turns these conventions into reusable primitives and predictable operational patterns.

Billing raises the bar because it is not a simple CRUD module. It needs:

- work queues
- dense period/invoice/debt tables
- inline form controls
- status-heavy rows
- correction actions
- audit/history views
- clear locked/closed states
- reliable empty/loading/error behavior

## Design Principles

### P1 - Operational, not decorative

Zeno House UI should feel like a quiet, utilitarian work tool. Prioritize scanning, repeated action, comparison, and data confidence.

Avoid:

- marketing-style hero sections
- decorative cards nested inside cards
- oversized headings inside dense panels
- gradient/orb decoration
- visual novelty that reduces scan speed

Prefer:

- structured tables
- compact controls
- stable row heights
- restrained borders
- clear status markers
- predictable action placement

### P2 - Dark theme is the primary theme

The design system should optimize for the existing dark UI. Light mode is not in scope.

Primary surfaces:

- app background: `dark`
- shell/header/sidebar: `dark-card`
- content surface: `dark-surface`
- hover/active row: `dark-hover`
- border/divider: `dark-border`
- primary text: `white`
- secondary text: `muted`
- accent/action: `cyan`

### P3 - Components must support dense data

Billing screens need many rows and numbers. Components should provide dense sizes and predictable dimensions.

Examples:

- table cells with compact padding
- toolbar controls with stable heights
- status badges that do not resize rows
- action buttons that fit in action columns
- metric cards/strips that do not dominate the page

### P4 - Domain status is semantic

Status colors must come from a central mapping. Pages should not invent status colors inline.

Status categories:

- neutral/draft
- in progress
- review/warning
- issued/collecting
- success/paid/closed
- danger/void/error
- blocked/overdue
- correction/adjustment

### P5 - Reuse before abstraction

Only add primitives that remove real duplication or support confirmed billing/workspace needs. Do not create a generic component for a one-off layout.

## Current Gaps

### G1 - Form controls are incomplete

Current forms repeatedly hand-roll:

- `select`
- `textarea`
- search dropdown / combobox-like selectors
- checkbox/toggle
- inline numeric inputs

This causes inconsistent labels, error states, focus rings, disabled states, and spacing.

### G2 - Tables are ad-hoc

Tables exist in service settings, service matrix, and meter readings, but there is no `UiTable` pattern for:

- header style
- dense rows
- alignment
- empty/loading/error states
- sticky columns/header
- action column
- numeric alignment
- horizontal overflow

Billing will heavily depend on this.

### G3 - Page/workspace structure is not formalized

Pages repeat header/action patterns manually. Billing needs a stronger structure:

```text
PageHeader
  title / description / context
  primary and secondary actions

Toolbar
  filters / search / status chips

Metric Strip
  compact operational totals

Workspace
  header + status + tabs + action bar
```

### G4 - Alerts and correction flows are hand-written

Errors currently appear as inline `div` classes. Billing needs consistent alert severity and correction UI for:

- missing readings
- unsupported pricing
- void/reissue confirmation
- paid invoice adjustment
- closed period lock

## Decisions

### D1 - Do not replace Tailwind

Continue using Tailwind utilities and existing token names. The design system should define usage rules and primitives, not introduce a CSS framework.

### D2 - Keep dark tokens as the source of truth

Use the existing token names where possible:

- `dark`
- `dark-card`
- `dark-surface`
- `dark-border`
- `dark-hover`
- `cyan`
- `muted`
- `success-*`
- `warning`
- `error-*`

If new semantic statuses are required, map them to existing colors first. Extend Tailwind only if reuse cannot be represented cleanly.

### D3 - Standardize radius by role

Recommended defaults:

- controls: `rounded-md`
- small inline elements/badges: `rounded-full` or `rounded-md`
- repeated cards/panels: `rounded-xl` maximum
- modals: `rounded-xl` or `rounded-2xl` only if already consistent

Billing workspace should avoid visually heavy nested cards. Use full-width sections, tables, dividers, and panels.

### D4 - Standardize text scale

Recommended defaults:

- page title: `text-xl font-semibold`
- section title: `text-sm font-semibold`
- table/body text: `text-sm`
- metadata/help text: `text-xs text-muted`
- metric value: compact `text-xl` or `text-2xl`, not dashboard hero scale unless on dashboard

No viewport-based font scaling.

### D5 - Add missing primitives before billing UI

Required primitives:

- `UiSelect`
- `UiTextarea`
- `UiCheckbox`
- `UiToggle`
- `UiBadge`
- `UiAlert`
- `UiTable`
- `UiTabs`
- `UiToolbar`
- `UiMetric`
- `UiPageHeader`
- `UiSection`

Optional if billing correction UI needs it:

- `UiDrawer` / `UiSidePanel`

### D6 - Upgrade existing primitives conservatively

Existing primitives should remain API-compatible where practical.

`UiButton`:

- keep `primary`, `secondary`, `danger`
- add `ghost` for low-emphasis actions
- support icon slots or icon-only usage with accessible labels

`UiInput`:

- keep label/error/hint
- add stable id handling
- support prefix/suffix slots for currency/unit when needed

`UiModal`:

- support size variants
- support footer/action slots consistently
- keep close behavior accessible

`UiStatusBadge`:

- become domain-aware or build on `UiBadge`
- cover billing period/invoice/correction statuses

### D7 - Use icons through existing SVG icon system

The app uses local SVG icons via `nuxt-svgo` with the `Icon` prefix. Continue this pattern. Do not add a new icon package unless there is a clear reason.

Buttons that perform common actions should use icons when available, especially:

- add
- edit
- delete
- close
- search
- filter
- refresh
- back
- settings

### D8 - Billing UI depends on this system

The billing workspace should not implement its own table, toolbar, status badge, alert, tabs, metric, or modal patterns. It should consume the standardized primitives.

## Target Patterns

### Page Header

```text
UiPageHeader
  title
  description/context
  optional breadcrumbs/back link
  actions slot
```

### Toolbar

```text
UiToolbar
  left: search/select/status filters
  right: refresh/export/create/open actions
```

Controls in a toolbar should share a stable height and not wrap awkwardly on common desktop widths. On mobile, wrap into vertical groups.

### Metric Strip

Compact operational totals:

```text
[Kỳ đang xử lý] [Tổng phải thu] [Đã thu] [Còn nợ] [Thiếu chỉ số]
```

Use `UiMetric`; avoid dashboard-scale typography in dense workspaces.

### Data Table

`UiTable` should support:

- dense mode
- loading rows
- empty state
- error state through `UiAlert`
- numeric alignment
- action column
- optional sticky header/column
- row click
- status badges

### Workspace Tabs

`UiTabs` should support:

- controlled active tab
- count/status markers
- disabled tabs with reason
- keyboard-friendly tablist semantics when feasible

Billing tabs:

```text
Overview | Readings | Review | Invoices | Payments | Audit
```

### Correction Surface

Correction/override flows should prefer a modal for short confirmations and a drawer/side panel for dense forms:

- void invoice: modal
- reissue confirmation: modal
- utility usage override: drawer or modal with structured form
- adjustment line: drawer or modal with form and context

## Implementation Boundaries

This change may add/adjust UI primitives and migrate a small number of examples to prove usage. It should not rewrite all pages.

Billing implementation should depend on the new primitives, but billing screens are implemented in `monthly-operations-workspace`, not here.

## Database

No database schema changes are required.

