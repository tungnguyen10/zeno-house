## Why

Monthly meter entry is still too disruptive for operators: editing one reading currently triggers auto-save and then reloads the whole draft grid, which can move focus and interrupt the next entry. Operators also need to paste or type readings for many rooms at once, including buildings where water is billed by occupant count or fixed room charge and therefore should not require water meter input.

## What Changes

- Add a bulk meter-reading entry surface to the billing draft grid for fast room-by-room electricity and water input.
- Support both room-ordered input and room-number input, including blank lines and explicit skip markers so missing rooms can be left untouched.
- Make bulk entry service-aware: only parse and apply water readings when a row requires water meter input; explain and ignore water values for per-person or fixed water billing.
- Preview parsed rows before applying, with per-line statuses for skipped, invalid, unmatched, duplicate, read-only, non-applicable, and warning cases.
- Apply accepted bulk values through the same local draft state as manual input and existing paste behavior.
- Change draft-grid auto-save behavior so successful reading saves do not reload the entire grid by default.
- Add optimistic client-side draft recalculation for edited electricity/water cells and row totals so operators see usage, amount, and total feedback without waiting for a full grid reload.
- Keep server-computed draft data as the final source of truth for explicit refresh, invoice issuing, override saves, and other workflow transitions.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `billing-bulk-operations`: Extend meter-reading bulk behavior from single-column paste to a dedicated bulk entry workflow, including room-name parsing, ordered parsing, preview, validation, and service-aware water handling.
- `billing-client`: Update billing draft grid requirements so manual entry, existing paste, and new bulk entry auto-save without full-grid reload and provide immediate optimistic calculation feedback.

## Impact

- Affected UI: `app/components/billing/BillingDraftGridStep.vue`, `app/components/billing/BillingMobileDraftRow.vue`, and likely a new focused bulk-entry modal/component.
- Affected state/composables: `app/composables/billing/useBillingPeriodWorkspace.ts` reading-save refresh behavior and any helper used by draft grid mutations.
- Affected utilities: clipboard/bulk parser helpers under `app/utils/billing/` and related unit tests.
- Affected API behavior: no new endpoint is required; existing `POST /api/meter-readings/bulk` remains the persistence path.
- Affected server read model: no database schema change is expected; server draft-grid calculation remains authoritative on explicit refresh and invoice issue.
- Testing impact: add parser/unit coverage, component behavior coverage for preview/apply/autosave, and regression coverage that auto-save no longer reloads the grid after each manual reading save.
