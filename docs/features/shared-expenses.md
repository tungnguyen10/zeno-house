# Shared Expenses

Owners can define a shared expense once and attach it to multiple buildings they control. Allocation is explicit per period and creates normal `building_expenses` rows so each building report includes its share.

Current behavior:

- Admin and owner have `shared-expenses.read`, `shared-expenses.write`, and `shared-expenses.allocate`; managers have none.
- Membership is limited by building scope.
- The shared expense name field uses the design-system `UiCombobox` with suggestions from existing shared expense names and expense category labels, while still allowing free text.
- Allocation splits evenly. The last building absorbs rounding remainder so generated rows sum to the source amount.
- Duplicate allocation for the same shared expense and period is rejected by checking the shared-origin marker in generated expense notes.
- This UI behavior does not require a database migration because `shared_expenses.name` already stores the chosen or typed name.

The feature intentionally does not support custom percentages, automatic recurring allocation, or cross-owner shared costs.
