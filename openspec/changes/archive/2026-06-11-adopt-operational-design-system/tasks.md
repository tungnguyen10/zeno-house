## 1. Primitive Hardening

- [x] 1.1 Decide final searchable select primitive name (`UiCombobox` or `UiSearchSelect`) and document the choice in the component props/types.
- [x] 1.2 Implement the searchable select primitive with label, required, disabled, loading, empty, error, selected value, clear/select behavior, and dark operational styling.
- [x] 1.3 Ensure the searchable select supports option identity and option label rendering without domain-specific assumptions.
- [x] 1.4 Add compact density support to `UiInput` while preserving prefix/suffix slots, error/hint rendering, disabled state, focus styling, and stable ids.
- [x] 1.5 Add compact density support to `UiSelect` while preserving placeholder, disabled state, error/hint rendering, native select arrow styling, and numeric/string value preservation.
- [x] 1.6 Add compact density support to `UiTextarea` while preserving resize behavior, error/hint rendering, disabled state, and stable ids.
- [x] 1.7 Confirm `UiButton iconOnly` covers shell, toolbar, row, and modal-header actions; adjust size/aria handling if needed.
- [x] 1.8 Update `app/pages/ui-showcase.vue` to demonstrate searchable select normal/selected/loading/empty/disabled/error states.
- [x] 1.9 Update `app/pages/ui-showcase.vue` to demonstrate compact `UiInput`, `UiSelect`, and `UiTextarea` in dense/table-like contexts.

## 2. Form Component Adoption

- [x] 2.1 Migrate `app/components/buildings/BuildingForm.vue` raw selects to `UiSelect` and keep current validation behavior.
- [x] 2.2 Migrate `app/components/rooms/RoomForm.vue` raw selects to `UiSelect` and keep current validation behavior.
- [x] 2.3 Migrate `app/components/tenants/TenantForm.vue` raw textarea/select to `UiTextarea`/`UiSelect` and keep current validation behavior.
- [x] 2.4 Migrate `app/components/contracts/ContractForm.vue` room selector to the searchable select primitive.
- [x] 2.5 Migrate `app/components/contracts/ContractForm.vue` tenant selector to the searchable select primitive.
- [x] 2.6 Migrate `app/components/contracts/ContractForm.vue` raw select/textarea/API error to `UiSelect`, `UiTextarea`, and `UiAlert`.
- [x] 2.7 Migrate `app/components/contracts/ContractOccupantForm.vue` tenant selector to the searchable select primitive.
- [x] 2.8 Migrate `app/components/contracts/ContractOccupantForm.vue` raw move-in input, primary checkbox, and API error to `UiInput`, `UiCheckbox`, and `UiAlert`.
- [x] 2.9 Migrate `app/components/contracts/ContractRenewalForm.vue` mode-choice raw buttons to `UiButton` or a primitive-backed segmented choice pattern.
- [x] 2.10 Verify `app/components/contracts/ContractPaymentForm.vue` remains primitive-backed and adjust only if compact density or alert conventions require it.

## 3. Table And Matrix Adoption

- [x] 3.1 Migrate `app/components/buildings/BuildingServiceSettings.vue` amount input to compact `UiInput` inside `UiTable`.
- [x] 3.2 Migrate `app/components/buildings/BuildingServicesMatrix.vue` from raw table/cell controls to `UiTable` plus primitive-backed toggles/buttons/compact inputs where feasible.
- [x] 3.3 Migrate `app/components/buildings/MeterReadingBulkInput.vue` from raw table/cell inputs to `UiTable` plus compact numeric inputs.
- [x] 3.4 Migrate `app/components/contracts/ContractServicesTab.vue` from raw table/cell controls to `UiTable` plus compact inputs and `UiButton`.
- [x] 3.5 Migrate `app/components/contracts/ContractHandoverReadings.vue` from raw table/cell inputs to `UiTable` plus compact numeric/text inputs.
- [x] 3.6 Migrate `app/pages/buildings/create.vue` quick-room raw table and inputs to `UiTable` plus compact primitive controls, or document a temporary exception if the layout cannot be represented cleanly.
- [x] 3.7 Ensure numeric table columns remain right-aligned and use stable width/spacing after migration.
- [x] 3.8 Document any raw table that remains outside `app/components/ui/` with the reason and follow-up requirement.

## 4. Page Layout And Feedback Adoption

- [x] 4.1 Migrate `app/pages/buildings/index.vue` to use `UiPageHeader`, `UiAlert`, `UiEmptyState`, `UiSkeleton`, and primitive pagination actions consistently.
- [x] 4.2 Migrate `app/pages/buildings/create.vue` to use `UiPageHeader`, `UiSection`, `UiAlert`, and primitive-backed form actions.
- [x] 4.3 Migrate `app/pages/buildings/[id]/index.vue` to use `UiPageHeader`, `UiSection`, `UiAlert`, and primitive-backed actions without repeated ad-hoc section wrappers.
- [x] 4.4 Migrate `app/pages/buildings/[id]/edit.vue` to use `UiPageHeader`, `UiSection`, and `UiAlert`.
- [x] 4.5 Migrate `app/pages/buildings/[id]/settings.vue` to use `UiPageHeader`, `UiSection`, `UiAlert`, and primitive-backed settings actions.
- [x] 4.6 Migrate `app/pages/buildings/[id]/meter-readings.vue` filters/errors/container to `UiPageHeader`, `UiToolbar` or primitive form controls, `UiAlert`, and `UiSection`.
- [x] 4.7 Confirm `app/pages/rooms/index.vue` remains aligned with the design system after primitive changes.
- [x] 4.8 Migrate `app/pages/rooms/create.vue` and `app/pages/rooms/[id]/edit.vue` to `UiPageHeader`, `UiSection`, and `UiAlert`.
- [x] 4.9 Migrate `app/pages/rooms/[id]/index.vue` to `UiPageHeader`, `UiSection`, and `UiAlert` without repeated ad-hoc section wrappers.
- [x] 4.10 Migrate `app/pages/tenants/index.vue` search/error/list layout to `UiPageHeader`, `UiToolbar`, `UiInput`, `UiAlert`, `UiEmptyState`, and primitive pagination actions.
- [x] 4.11 Migrate `app/pages/tenants/create.vue` and `app/pages/tenants/[id]/edit.vue` to `UiPageHeader`, `UiSection`, and `UiAlert`.
- [x] 4.12 Migrate `app/pages/tenants/[id]/index.vue` to `UiPageHeader`, `UiSection`, and `UiAlert` without repeated ad-hoc section wrappers.
- [x] 4.13 Migrate `app/pages/contracts/index.vue` filter/error/list layout to `UiPageHeader`, `UiToolbar`, `UiSelect`, `UiAlert`, `UiEmptyState`, and primitive pagination actions.
- [x] 4.14 Migrate `app/pages/contracts/create.vue` major sections to `UiPageHeader`, `UiSection`, and primitive-backed occupant/service sections while preserving current multi-section flow.
- [x] 4.15 Migrate `app/pages/contracts/[id]/index.vue` detail sections, occupant actions, payment/renewal/move-out surfaces, and raw error blocks to `UiPageHeader`, `UiSection`, `UiAlert`, and primitive-backed controls.
- [x] 4.16 Migrate `app/pages/contracts/[id]/edit.vue` to `UiPageHeader`, `UiSection`, and primitive-backed contract form rendering.
- [x] 4.17 Review `app/pages/index.vue` and `app/components/app/AppStatCard.vue`; either align dashboard cards with operational metric/section conventions or document why dashboard-specific cards remain.
- [x] 4.18 Review `app/pages/login.vue`; replace raw error text with `UiAlert` if it does not harm the compact login layout.

## 5. Shell And Billing Entry Cleanup

- [x] 5.1 Migrate `app/components/app/AppHeader.vue` raw icon buttons to `UiButton iconOnly` or document a shell-specific exception.
- [x] 5.1 Migrate `app/components/app/AppSidebar.vue` raw collapse/action button to `UiButton iconOnly` or document a shell-specific exception.
- [x] 5.1 Migrate `app/pages/billing/index.vue` placeholder to `UiPageHeader`, primitive building/month/status controls, `UiSection`, and primitive action button if the placeholder remains.
- [x] 5.4 If `app/pages/billing/index.vue` is replaced by `monthly-operations-workspace`, ensure the replacement route does not copy raw placeholder markup and is primitive-backed from the first implementation.
- [x] 5.5 Ensure future billing statuses use `UiStatusBadge` with explicit `context` for period, invoice, and correction statuses.

## 6. Verification

- [x] 6.1 Run OpenSpec validation for `ui-primitives`, `operational-ui-patterns`, and `billing-ui-readiness` deltas under this change.
- [x] 6.2 Run the repository lint/type/test commands available in `package.json`.
- [x] 6.3 Run a raw control scan for `<input`, `<select`, `<textarea`, `<table`, and `<button` outside `app/components/ui/`; resolve or document every remaining match.
- [x] 6.4 Run a raw feedback scan for `apiError`, `errorMessage`, `text-error`, `bg-error/10`, and ad-hoc API/workflow error blocks; resolve or document every remaining non-field-level match.
- [x] 6.5 Run a page primitive adoption scan to confirm migrated pages use the expected `UiPageHeader`, `UiToolbar`, `UiSection`, `UiAlert`, `UiSkeleton`, `UiEmptyState`, or `UiTable` primitives according to screen type.
- [x] 6.6 Manually review `/ui-showcase`, representative list pages, representative detail pages, and `/billing` at desktop and mobile widths for text overflow, overlapping UI, table usability, and focus states.
- [x] 6.7 Confirm no Supabase/database migration files were added for this UI-only change.
