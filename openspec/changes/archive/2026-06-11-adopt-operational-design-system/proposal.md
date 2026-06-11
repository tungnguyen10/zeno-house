## Why

`operational-design-system` has established the tokens, primitive vocabulary, and operational UI patterns, but the current application has not fully adopted them. Several production pages still hand-roll controls, tables, sections, search selectors, and error states; if billing is implemented on top of this mixed UI, `/billing` will inherit inconsistent workflows and duplicated styling.

This change closes that gap before the monthly billing workspace implementation by hardening the missing primitives and migrating the existing app surfaces that were found during source scan.

## What Changes

- Add the missing searchable selection primitive needed by contract and occupant flows:
  - `UiCombobox` or `UiSearchSelect` for searching and selecting rooms, tenants, and future billing subjects.
  - Support label, required, disabled, loading, empty, error, clear/select behavior, keyboard-friendly option navigation where feasible, and dark operational styling.
- Add compact density support to form controls:
  - `UiInput`, `UiSelect`, and `UiTextarea` SHALL support at least normal and compact/dense sizing.
  - Compact sizing is required for editable table cells, meter readings, building service settings, and billing review rows.
- Standardize icon-only and low-emphasis actions:
  - Existing shell and row action buttons SHOULD use `UiButton iconOnly` or an equivalent primitive-backed pattern instead of raw `<button>` styling.
- Replace raw form controls in current domain components with primitives:
  - Building, room, tenant, contract, contract occupant, contract renewal/payment, building service settings, service matrix, meter reading, handover reading, and contract service forms.
- Replace raw tables and editable matrix markup with `UiTable` plus primitive cell controls where the data is tabular:
  - Building service matrix.
  - Building service settings.
  - Meter reading bulk input.
  - Contract services tab.
  - Contract handover readings.
  - Building create quick-room table.
- Replace ad-hoc page structure with operational layout primitives:
  - List pages use `UiPageHeader`, `UiToolbar` where filters/search exist, `UiEmptyState`, `UiSkeleton`, and `UiAlert`.
  - Detail/create/edit/settings pages use `UiPageHeader`, `UiSection`, `UiAlert`, and primitive-backed form actions.
- Replace raw API and workflow error blocks with `UiAlert`.
- Normalize status usage through `UiStatusBadge`, including explicit `context` when billing period/invoice/correction statuses are introduced.
- Align `/billing` placeholder with the design system or explicitly replace it as part of the monthly operations workspace entry route.
- Keep this change UI-only:
  - No database schema changes.
  - No billing domain behavior changes.
  - No Supabase manual migration.
  - No third-party component library.
  - No full visual redesign beyond adopting the established operational design system.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `ui-primitives`: Add searchable select/combobox capability, compact density for input/select/textarea, and stricter adoption requirements for primitive-backed controls.
- `operational-ui-patterns`: Require existing operational pages and components touched by this cleanup to use standardized page, toolbar, section, table, form, feedback, and action patterns.
- `billing-ui-readiness`: Clarify that `/billing` must not proceed with raw placeholder UI and that billing-ready primitives must cover compact table editing, searchable subject selection, correction surfaces, and contextual status badges.

## Impact

- Affected UI primitives:
  - `app/components/ui/UiInput.vue`
  - `app/components/ui/UiSelect.vue`
  - `app/components/ui/UiTextarea.vue`
  - `app/components/ui/UiButton.vue`
  - `app/components/ui/UiTable.vue`
  - new `app/components/ui/UiCombobox.vue` or `app/components/ui/UiSearchSelect.vue`
  - optional `app/components/ui/UiDrawer.vue` if billing correction surfaces need side-panel behavior before monthly billing implementation
- Affected domain components found by source scan:
  - `app/components/contracts/ContractForm.vue`
  - `app/components/contracts/ContractOccupantForm.vue`
  - `app/components/contracts/ContractRenewalForm.vue`
  - `app/components/contracts/ContractHandoverReadings.vue`
  - `app/components/contracts/ContractServicesTab.vue`
  - `app/components/tenants/TenantForm.vue`
  - `app/components/rooms/RoomForm.vue`
  - `app/components/buildings/BuildingForm.vue`
  - `app/components/buildings/BuildingServiceSettings.vue`
  - `app/components/buildings/BuildingServicesMatrix.vue`
  - `app/components/buildings/MeterReadingBulkInput.vue`
  - `app/components/app/AppHeader.vue`
  - `app/components/app/AppSidebar.vue`
- Affected pages found by source scan:
  - `app/pages/index.vue`
  - `app/pages/login.vue`
  - `app/pages/billing/index.vue`
  - `app/pages/buildings/index.vue`
  - `app/pages/buildings/create.vue`
  - `app/pages/buildings/[id]/index.vue`
  - `app/pages/buildings/[id]/edit.vue`
  - `app/pages/buildings/[id]/settings.vue`
  - `app/pages/buildings/[id]/meter-readings.vue`
  - `app/pages/rooms/index.vue`
  - `app/pages/rooms/create.vue`
  - `app/pages/rooms/[id]/index.vue`
  - `app/pages/rooms/[id]/edit.vue`
  - `app/pages/tenants/index.vue`
  - `app/pages/tenants/create.vue`
  - `app/pages/tenants/[id]/index.vue`
  - `app/pages/tenants/[id]/edit.vue`
  - `app/pages/contracts/index.vue`
  - `app/pages/contracts/create.vue`
  - `app/pages/contracts/[id]/index.vue`
  - `app/pages/contracts/[id]/edit.vue`
  - `app/pages/ui-showcase.vue`
- Specs:
  - Delta specs for `ui-primitives`, `operational-ui-patterns`, and `billing-ui-readiness`.
- Tests/validation:
  - Existing unit/integration checks should continue to pass.
  - UI showcase must be updated to demonstrate new primitive states.
  - Source scan for raw controls/errors/tables must be used as a verification gate.
