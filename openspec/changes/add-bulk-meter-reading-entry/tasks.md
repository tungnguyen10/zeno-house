## 1. Parser And Preview Utilities

- [x] 1.1 Add pure bulk meter-reading parser helpers under `app/utils/billing/` for ordered rows, room-number rows, blank lines, skip marker `-`, whitespace, and tab-separated spreadsheet input.
- [x] 1.2 Add preview builder helpers that match parsed lines to draft-grid rows, detect mode, detect ambiguous mode, and expose per-line/per-cell statuses.
- [x] 1.3 Add service-aware validation for editable cells, read-only rows, non-applicable water, invalid numbers, negative readings, duplicate room lines, room-not-found lines, empty input, and lower-than-previous warnings.
- [x] 1.4 Add unit tests for parser and preview helpers covering ordered input, room-number input, blank/skipped rows, electricity-only water-per-person cases, fixed-water cases, duplicate rooms, unknown rooms, invalid values, negative values, and tab-separated input.

## 2. Save Flow Without Full Reload

- [x] 2.1 Update the billing workspace reading-save composable so `saveReadings` supports no-refresh saves while preserving explicit refresh behavior for callers that need authoritative server recomputation.
- [x] 2.2 Route draft-grid row auto-save through the no-refresh save path and keep row save indicators accurate for saving, saved, and error states.
- [x] 2.3 Route `Lưu ngay` through the no-refresh save path and clear only successfully persisted local cells.
- [x] 2.4 Ensure explicit `Tải lại`, period changes, utility override saves, invoice issue/reissue flows, and other authoritative transitions still call the grid refresh path.

## 3. Optimistic Draft Grid Display

- [x] 3.1 Add focused display helpers that derive effective reading value, usage, amount, warning state, and row total from server row data plus `localReadings`.
- [x] 3.2 Update desktop electricity/water cells to use optimistic display values without mutating the server response objects.
- [x] 3.3 Update mobile draft rows to use the same optimistic display values and warning states as desktop.
- [x] 3.4 Handle empty, invalid, lower-than-previous, missing previous reading, non-meter water, override, and unsupported pricing cases without showing misleading totals.

## 4. Bulk Entry UI

- [x] 4.1 Add a focused bulk-entry modal component using existing design-system primitives for textarea, guidance, mode display/switching, preview table/list, apply, and cancel.
- [x] 4.2 Add the `Nhập nhanh` action to the editable billing draft-grid toolbar and hide or disable it for locked periods.
- [x] 4.3 Generate dynamic guidance based on visible rows: electricity+metered-water, electricity-only with water per person/fixed, and mixed row requirements.
- [x] 4.4 Render preview statuses for skipped rows, accepted values, non-applicable values, warnings, room-not-found errors, duplicate-room errors, invalid values, read-only targets, and empty input.
- [x] 4.5 Apply accepted preview values through the existing `localReadings` and row auto-save scheduling path, highlight affected cells, and preserve skipped or non-applicable values unchanged.

## 5. Regression Tests

- [x] 5.1 Add component tests proving manual single-cell auto-save does not call the full grid reload path and does not disrupt local row state.
- [x] 5.2 Add component tests proving existing focused-cell paste still fills one column, highlights affected cells, and uses the no-refresh save path.
- [x] 5.3 Add component tests proving bulk entry applies valid rows, skips blank/missing rows, ignores non-applicable water, and reports blocking errors before apply.
- [x] 5.4 Add tests proving optimistic electricity and metered-water edits update usage, utility amount, and row total while invalid or lower-than-previous values do not show normal calculated totals.
- [x] 5.5 Add tests proving save failures preserve local values and show row error state without a full-grid reload.

## 6. Manual Verification And Cleanup

- [x] 6.1 Verify desktop draft grid entry for electricity-only buildings, electricity+metered-water buildings, mixed row requirements, issued/read-only rows, and filtered row order.
- [x] 6.2 Verify mobile draft rows still expose reading input, save state, warnings, and optimistic amounts without horizontal scrolling.
- [x] 6.3 Verify explicit refresh and invoice issue still reconcile from server-computed draft data.
- [x] 6.4 Review changed components for senior-level maintainability: small helpers, no duplicated parsing logic, no direct server-row mutation, clear names, and no unrelated refactors.
- [x] 6.5 Run the relevant test suite and lint/typecheck commands documented for the project before marking the change complete.
