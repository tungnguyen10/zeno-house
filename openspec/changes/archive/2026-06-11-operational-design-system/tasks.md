# Tasks

## 1. Tokens and Specs

- [x] 1.1 Document dark operational token usage from `tailwind.config.ts`
- [x] 1.2 Define typography, radius, spacing, focus, and surface rules
- [x] 1.3 Define semantic status categories and billing status mappings
- [x] 1.4 Confirm no database schema changes are required

## 2. Primitive Updates

- [x] 2.1 Update `UiButton` with `ghost` variant and icon/icon-only accessibility guidance
- [x] 2.2 Update `UiInput` with stable id behavior and optional prefix/suffix slots
- [x] 2.3 Update `UiModal` with size variants and consistent footer/action layout
- [x] 2.4 Update `UiStatusBadge` or build it on top of a generic `UiBadge`

## 3. New Primitives

- [x] 3.1 Add `UiSelect` with label, error, hint, disabled, placeholder, and option support
- [x] 3.2 Add `UiTextarea` with label, error, hint, disabled, and resize behavior
- [x] 3.3 Add `UiCheckbox`
- [x] 3.4 Add `UiToggle`
- [x] 3.5 Add `UiBadge`
- [x] 3.6 Add `UiAlert`
- [x] 3.7 Add `UiTable` with dense/loading/empty/error/action-column support
- [x] 3.8 Add `UiTabs`
- [x] 3.9 Add `UiToolbar`
- [x] 3.10 Add `UiMetric`
- [x] 3.11 Add `UiPageHeader`
- [x] 3.12 Add `UiSection`
- [x] 3.13 Add `UiDrawer` / `UiSidePanel` only if correction/override forms need more space than modal comfortably supports

## 4. Pattern Proofs

- [x] 4.1 Migrate one simple list page header/actions to `UiPageHeader`
- [x] 4.2 Migrate one filter row to `UiToolbar`
- [x] 4.3 Migrate one table-like operational component to `UiTable`
- [x] 4.4 Migrate one hand-written select/textarea to `UiSelect` / `UiTextarea`
- [x] 4.5 Keep migration scope minimal and avoid whole-app redesign

## 5. Billing Readiness

- [x] 5.1 Add billing period status mappings: draft, readings, review, issued, collecting, closed
- [x] 5.2 Add invoice status mappings: draft, issued, partial, paid, overdue, void
- [x] 5.3 Add correction/blocker mappings: blocked, warning, adjustment, replacement, corrected
- [x] 5.4 Verify billing workspace can be composed from PageHeader, Toolbar, Metric, Tabs, Table, Alert, Badge, Modal/Drawer primitives

## 6. Verification

- [x] 6.1 Run OpenSpec validation: `openspec validate operational-design-system --strict`
- [x] 6.2 Run project typecheck/lint/test commands available in `package.json`
- [x] 6.3 Check representative desktop and mobile layouts for no text overlap
- [x] 6.4 Verify no new ad-hoc form/table/status patterns are introduced in touched areas

## 7. Polish from Verification

- [x] 7.1 Add `UiStatusBadge` `context` prop so `draft`/`issued` disambiguate between period and invoice maps
- [x] 7.2 Add primitive showcase page (`/ui-showcase`) covering every component in `app/components/ui/`
- [x] 7.3 Migrate residual `<select>` / `<textarea>` in `ContractPaymentForm.vue` and `ContractRenewalForm.vue` to `UiSelect` / `UiTextarea`

