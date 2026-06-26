## Context

The billing draft grid is the busiest UI surface in the app. It supports inline reading entry, keyboard navigation, focused-cell paste, bulk-entry modal, debounced row auto-save, optimistic utility totals, override modal, row expansion, discrepancy correction intents, filters, and mobile row rendering. Most behavior is already covered by tests, but too much orchestration lives in `BillingDraftGridStep.vue`.

This change is a behavior-preserving refactor. The goal is to reduce future risk, not to change the billing workflow.

## Goals / Non-Goals

**Goals:**
- Split draft-grid behavior into focused units with stable props/events.
- Preserve all existing draft-grid user behavior.
- Keep server API and DTO shapes unchanged.
- Increase regression coverage around the extracted seams.

**Non-Goals:**
- No billing math changes.
- No new persistence endpoint.
- No UI redesign.
- No transaction hardening.

## Decisions

### D1 - Extract Behavior By Responsibility

Prefer composables for stateful orchestration and components for rendering:
- `useBillingDraftGridAutosave` for local/saved readings, dirty state, row timers, save state, and no-refresh persistence calls.
- `useBillingDraftGridNavigation` for editable cell ordering, keyboard navigation, and focused-cell paste application.
- `useBillingDraftGridFilters` for filter and expanded row state.
- `BillingDraftGridOverrideModal` for override form state and payload building.
- `BillingDraftGridExpandedRow` for line items, warnings, blockers, and discrepancy callout hosting.

Alternative considered: split only the template. Rejected because the main risk is state orchestration, not only render size.

### D2 - Keep Existing Utility Helpers

Keep pure helpers such as bulk reading parsing and optimistic display under `app/utils/billing/`. Extracted composables should consume these helpers rather than duplicate parsing/calculation logic.

### D3 - Preserve Compatibility First

The first refactor should keep existing public props/events of `BillingDraftGridStep.vue` stable for the workspace page. Internal props/events between new child components can evolve during implementation as long as tests cover the same behavior.

## Risks / Trade-offs

- [Refactor can break subtle keyboard/autosave behavior] -> Mitigation: add tests before or alongside extraction for each moved behavior.
- [Too many small abstractions can become harder to follow] -> Mitigation: extract only responsibilities that already have clear boundaries.
- [Behavior-preserving work can hide accidental UI changes] -> Mitigation: compare desktop/mobile screenshots manually after implementation.

## Migration Plan

1. Add or tighten regression tests around current behavior.
2. Extract autosave state first because it has the highest risk and clearest boundary.
3. Extract navigation/paste and filter/expanded state.
4. Extract override modal and expanded row rendering.
5. Keep the parent workspace route unchanged.
6. Run tests, lint, typecheck, and manual desktop/mobile smoke.
