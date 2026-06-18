## Why

`BillingDraftGridStep.vue` has accumulated reading entry, paste handling, auto-save orchestration, optimistic calculation, override modal state, bulk entry integration, filtering, expanded-row rendering, and discrepancy intents in one large component. The behavior is valuable, but the current shape makes future billing changes risky and slow to review.

## What Changes

- Refactor the draft grid into smaller focused composables/components while preserving the current user-facing behavior.
- Extract row auto-save and dirty-state orchestration into a composable with explicit tests.
- Extract filter/expanded-row state, keyboard navigation/paste handling, and optimistic display wiring out of the main component where practical.
- Move override modal state/rendering into a focused child component that receives row context and emits saved override payloads.
- Move expanded row details/discrepancy rendering into focused child components so the main grid mostly coordinates data flow.
- Keep the existing API contract, routes, persistence behavior, and visual workflow unchanged.
- Add regression tests around the extracted boundaries so refactor work does not weaken bulk entry, auto-save, optimistic display, read-only rows, or discrepancy intents.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `billing-client`: The draft grid SHALL preserve existing reading entry, auto-save, bulk entry, optimistic display, override, read-only, and discrepancy workflows while being composed from maintainable focused units.
- `billing-bulk-operations`: Bulk reading and focused-cell paste behavior SHALL remain unchanged after draft-grid extraction.
- `billing-test-coverage`: Component and utility regression coverage SHALL protect the extracted draft-grid behavior.

## Impact

- Client:
  - `app/components/billing/BillingDraftGridStep.vue`
  - new focused components/composables under `app/components/billing/` and `app/composables/billing/` or `app/utils/billing/`
  - existing `BillingMobileDraftRow.vue`, `BillingBulkReadingEntryModal.vue`, and `BillingDraftDiscrepancyCallout.vue` may receive small prop/event adjustments
- Tests:
  - `tests/components/billing/BillingDraftGridStep.spec.ts`
  - `tests/components/billing/BillingBulkReadingEntryModal.spec.ts`
  - utility tests under `tests/utils/`
- No server API or database changes are expected.
- No intended product behavior change; this is a maintainability and regression-safety change.
