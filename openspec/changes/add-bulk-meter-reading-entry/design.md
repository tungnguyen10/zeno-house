## Context

The billing draft grid already combines monthly reading entry and draft invoice review. Manual edits currently write into `localReadings`, debounce for about 800ms, call `POST /api/meter-readings/bulk`, and then refresh the grid through `loadGrid()`. That keeps server-computed values authoritative, but it also reloads the whole table after each edited reading, which interrupts fast operators by shifting focus and rebuilding row state.

The grid also has single-column paste support. It is useful for pasting one meter type down the currently focused column, but operators need a higher-level entry surface that accepts the way they collect readings: one room per line, sometimes by visible room order, sometimes by room number, and sometimes with water omitted because the building bills water by occupant count or a fixed room charge.

## Goals / Non-Goals

**Goals:**

- Provide a bulk reading entry workflow in the billing draft grid with paste/type input, preview, validation, and explicit apply.
- Support ordered input and room-number input without requiring operators to fill rooms that are missing or skipped.
- Respect each row's service configuration so non-meter water billing is not treated as missing input.
- Make manual input, existing column paste, and new bulk entry share the same local state, validation concepts, auto-save behavior, and visual save states.
- Save readings in the background without a full draft-grid reload after each successful save.
- Show immediate optimistic usage, utility amount, and row total feedback for edited cells while preserving server recomputation as the final source of truth.
- Keep code clean by isolating parsing, preview derivation, optimistic calculations, and persistence orchestration into focused helpers/components instead of growing one monolithic component.

**Non-Goals:**

- Add a new meter-reading persistence endpoint.
- Change the database schema or meter-reading read model.
- Replace the existing server-side billing draft calculation.
- Support OCR/photo import or file upload.
- Change invoice issue, override, void/reissue, or adjustment domain rules.
- Support tiered electricity client-side estimation beyond the existing server-supported behavior; if tiered electricity remains blocked server-side, optimistic calculation must show an unsupported state rather than invent billing math.

## Decisions

### Dedicated Bulk Entry Modal

Add an `Nhập nhanh` action to the draft grid toolbar that opens a modal with a textarea, dynamic guidance, parser mode detection, preview table, and apply/cancel actions.

Rationale: a modal gives enough space for examples, parse errors, and a preview without making the dense grid harder to scan. Inline bulk input in the toolbar would be too constrained for validation feedback.

Alternative considered: paste directly into the grid only. This keeps UI smaller, but it cannot safely explain room-name matching, skipped rooms, service-aware water omission, and line-level errors before data mutates.

### Parser Is Pure and Testable

Implement parser/preview helpers under `app/utils/billing/` with no Vue dependency. The parser should return structured line tokens and diagnostics; a separate preview builder should match tokens to current grid rows and service editability.

Rationale: the risky part is not rendering the modal; it is interpreting operator input correctly. Pure helpers make edge cases cheap to unit test and keep `BillingDraftGridStep.vue` from becoming a parsing module.

Alternative considered: parse inside the Vue component. That would be faster to write initially but harder to test and maintain as cases grow.

### Auto-Detect With Clear Fallbacks

Detect room-number mode when the first non-empty token of any meaningful line matches a visible row's `roomNumber`. Otherwise treat the input as ordered mode. The preview must label the detected mode and show each source line's target room. If detection is ambiguous, the modal should allow the user to switch mode explicitly before apply.

Rationale: operators should not have to choose a mode for common input, but the system must not silently map uncertain data.

Alternative considered: require a mode selector before parsing. That is safer but slower for the common path. Auto-detect plus visible preview provides a better operational balance.

### Service-Aware Application

Apply values only to cells that are editable for the row and meter type. A water value for `per_person` or `fixed_per_room` water billing must be marked non-applicable and ignored. The guidance text should adapt to the rows currently in scope, for example: "Tòa này chỉ cần nhập số điện. Nước đang tính theo đầu người/cố định nên không cần nhập."

Rationale: the grid already exposes `required`, `editable`, `pricingType`, and `source`. Bulk entry should reuse those row facts instead of duplicating service rules.

Alternative considered: parse water whenever a third column exists. That creates false errors for buildings where water is not meter-billed and encourages operators to enter meaningless values.

### Optimistic Overlay Instead of Grid Reload

Keep server response rows as the base read model and layer local reading edits over them for display. A display helper should derive the effective current value, usage, utility amount, row total, and relevant warnings from base row data plus `localReadings`.

Rationale: avoiding reload requires the UI to show useful feedback while saves are pending. An overlay keeps the implementation localized and makes it easy to clear local state after save without mutating server objects.

Alternative considered: update the server response object in place after every edit. That risks mixing persisted and unpersisted state and makes rollback/error handling harder.

### Save Without Default Refresh

Change the workspace save path to support saving readings without immediately calling `loadGrid()`. Auto-save, existing column paste, `Lưu ngay`, and bulk-entry apply should use the no-refresh path by default. Explicit refresh, override save, issue flow, route/period changes, and other workflow transitions may still call `loadGrid()`.

Rationale: the user pain is caused by reload after each save, not by the save itself. The server remains authoritative when the operator asks for a refresh or moves into workflows that require final recomputation.

Alternative considered: batch saves and reload once after the batch. That reduces reload frequency but still interrupts data entry and does not fix manual one-cell edits.

### Batch Apply Uses Existing Auto-Save Path

When the user applies previewed bulk values, update the same local reading state used by manual input, mark affected cells for highlight, and schedule row saves through the same row-save orchestration. Do not create a second persistence path that bypasses dirty-state and row status handling.

Rationale: one path avoids inconsistent save indicators, different validation rules, and future regressions between manual and bulk entry.

Alternative considered: immediately POST the entire bulk preview payload. That would be efficient but would duplicate save behavior and make row-level error display less consistent.

## Risks / Trade-offs

- Optimistic totals can differ from server totals for unsupported or complex rules -> Mitigation: only calculate optimistic amounts for supported linear rates (`per_kwh`, `per_m3`) and show warning/unchanged values when a rule cannot be estimated safely.
- Not refreshing after save can leave KPI strip and blocker counts stale -> Mitigation: update visible row-level optimistic state immediately, add a subtle "Đã lưu, chưa đồng bộ tổng server" style if needed, and refresh before issue or on explicit `Tải lại`.
- Auto-detection may choose the wrong mode when room numbers are numeric and readings are also numeric -> Mitigation: preview must label mode, allow manual mode switch, and never apply without explicit user confirmation.
- Duplicate room names in input can cause accidental overwrite -> Mitigation: duplicate room lines are blocking preview errors and are not applied automatically.
- Large pasted input may make the modal sluggish -> Mitigation: parser is linear, preview rows are simple, and apply only schedules rows that have accepted changes.
- Clearing dirty state without reload can hide server normalization differences -> Mitigation: clear dirty only after successful POST for that exact row/meter value; keep error state and local value when save fails.
- Existing component is already large -> Mitigation: extract modal, parser, preview builder, and optimistic display helpers instead of adding all logic inline.

## Migration Plan

1. Add pure parser and preview helpers with unit tests before touching the grid UI.
2. Add no-refresh save support to the billing workspace composable while preserving explicit refresh callers.
3. Add optimistic display helpers and route manual input/existing paste through them.
4. Add the bulk-entry modal and apply behavior on top of the shared local state/save path.
5. Add component/regression tests for manual autosave without reload and bulk-entry cases.
6. Manually verify the draft grid for desktop and mobile with electric-only, electric+meter-water, and non-editable/issued rows.

Rollback is straightforward: hide the `Nhập nhanh` action and restore reading save calls to refresh after success. No data migration is required.
