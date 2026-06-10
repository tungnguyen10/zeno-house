# operational-design-system

## Why

Zeno House has a consistent dark visual language in code, but it does not yet have a complete design system instruction set. The current UI foundation is enough for CRUD pages, but not enough for the upcoming Monthly Operations / Billing Workspace, which needs dense tables, filters, status queues, review workflows, corrections, audit history, and repeated monthly actions.

Current state:

- Tailwind tokens exist in `tailwind.config.ts` for dark surfaces, cyan accent, muted text, and semantic colors.
- Base font and dark background exist in `app/assets/scss/main.scss`.
- UI primitives exist: `UiButton`, `UiInput`, `UiModal`, `UiConfirmModal`, `UiSkeleton`, `UiStatusBadge`, `UiEmptyState`.
- Domain pages still hand-roll common controls such as select, textarea, toggles, table markup, alerts, filters, and action bars.
- Existing specs define primitive components lightly, but not operational layout patterns or billing-ready status semantics.

Without a design system foundation, the billing workspace will likely become a mix of one-off cards, hand-written tables, inconsistent filters, and duplicated correction/payment UI.

## What Changes

- Establish Zeno House as an operational dark UI system, not a marketing-style interface.
- Document design tokens and usage rules for color, typography, radius, spacing, focus, surfaces, and status semantics.
- Standardize existing UI primitives and add missing primitives required for billing and future operational workflows:
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
  - optional `UiDrawer` / side panel for dense correction workflows
- Define operational UI patterns:
  - page header
  - filter toolbar
  - metric strip
  - data table
  - workspace tabs
  - form section
  - modal/drawer correction flow
  - empty/loading/error states
- Define billing UI readiness requirements so `monthly-operations-workspace` has a stable UI foundation.
- Update design/system specs so future implementation can check UI decisions against OpenSpec instead of copying ad-hoc classes.

## Impact

- Client:
  - `app/components/ui/*`
  - selected app shell/domain components only when needed to validate primitives
  - future billing UI must use these primitives
- Specs:
  - design system tokens
  - UI primitives
  - operational UI patterns
  - billing UI readiness
- Tailwind:
  - may extend tokens if needed for status semantics, but should reuse existing tokens first
- Database:
  - no schema changes

## Non-Goals

- Full visual redesign of the application
- Migrating every legacy page in this change
- Adding a third-party component library
- Replacing Tailwind
- Adding light mode
- Building the billing workspace itself
- Changing billing domain schema or API behavior

## Migration Strategy

- New operational surfaces, especially billing, SHALL use the standardized primitives.
- Existing pages may keep current markup unless touched by this change or needed to prove a primitive.
- When an existing page is touched later, ad-hoc select/textarea/table/alert/status code should be migrated to primitives in the same area.
- The design system must stay compact and pragmatic; avoid abstractions that are not backed by actual current or near-term UI needs.

