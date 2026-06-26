## Why

Billing is now usable end to end, but several trust-critical details still use different definitions across services and UI surfaces. Period queue metrics, draft eligibility, actor display, and modal mutation state should agree before more billing features are added on top.

## What Changes

- Add one shared definition for billable contracts in a building/month and use it across draft calculation, draft-grid read models, period list summaries, and workspace overview.
- Add one shared definition for required monthly readings based on active billing contracts and building pricing rules, replacing occupied-room based progress where it is still used.
- Fix billing display enrichment so audit actors and payment recorders resolve to real user-facing names/emails instead of always falling back to null/system labels.
- Make issue and close confirmation flows await their parent mutation before closing the modal, clearing selection, or reporting success.
- Add focused regression tests proving billing queue metrics, draft eligibility, audit actor display, and modal action state stay consistent.
- No database schema change is expected unless implementation discovers there is no user/profile source that can safely resolve actor display names.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `billing-api`: Period summaries, workspace overview, draft calculation, and draft-grid APIs SHALL share the same billable-contract and required-reading definitions.
- `billing-readability`: Billing audit and payment DTO enrichment SHALL resolve actor/recorder display names and emails when available.
- `billing-client`: Billing destructive/confirm actions SHALL keep modal and selection state accurate until server mutations complete.
- `billing-test-coverage`: Regression tests SHALL cover the shared eligibility/progress helpers and async action-state behavior.

## Impact

- Server:
  - `server/services/billing/drafts.ts`
  - `server/services/billing/grid.ts`
  - `server/services/billing/periods.ts`
  - `server/services/billing/display.ts`
  - likely a new shared helper module under `server/services/billing/`
- Client:
  - `app/components/billing/BillingIssueStep.vue`
  - `app/components/billing/BillingCloseStep.vue`
  - `app/pages/billing/[building]/[period].vue`
- Tests:
  - billing service tests for eligibility and progress
  - component tests for issue/close modal mutation state
- Documentation:
  - billing feature guide or architecture rules may need a short note describing the single source of truth for billable contracts and required readings.
