# Shared Expenses

Owners can define a shared expense once and attach it to multiple buildings they control. Allocation is explicit per period and creates normal `building_expenses` rows so each building report includes its share.

Current behavior:

- Admin and owner have `shared-expenses.read`, `shared-expenses.write`, and `shared-expenses.allocate`; managers have none.
- `GET /api/shared-expenses` requires `period_year` and `period_month`. Its response includes the requested period in `meta` and `isAllocatedForPeriod` on every list item.
- Allocation status is loaded in one batch marker lookup for the requested period, not one query per definition. Generated expense notes remain the source of truth for duplicate detection and list status.
- Membership is limited by building scope.
- The shared expense name field uses the design-system `UiCombobox` with suggestions from existing shared expense names and expense category labels, while still allowing free text.
- Allocation splits evenly. The last building absorbs rounding remainder so generated rows sum to the source amount.
- Duplicate allocation for the same shared expense and period is rejected by checking the shared-origin marker in generated expense notes.
- The dashboard is list-first: the period picker refreshes the list reactively, desktop uses a table, and mobile uses stacked two-line rows without horizontal table scrolling.
- Create and edit share a modal form with inline validation. Allocation first previews each building share, then shows the generated expenses returned by the API.
- Deactivation uses a confirmation modal. Inactive definitions stay visible and can be restored with the existing `PATCH { is_active: true }` flow.
- Allocation conflicts and closed-period errors stay inside the allocation modal while the list refreshes to reflect current server state.
- This behavior does not require a database migration.

The feature intentionally does not support custom percentages, automatic recurring allocation, or cross-owner shared costs.
