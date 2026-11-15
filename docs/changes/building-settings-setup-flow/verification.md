---
type: Verification Record
title: "building-settings-setup-flow — verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, verification, buildings, settings, ui, v2]
---

# Building settings — setup flow verification

> Tasks 1–5 implemented. No API, permission, validator, migration or data change. Capability `buildings-ui` is intentionally not updated until the design is accepted.

## Local (source), 2026-11-15

- [x] `npm run typecheck`: pass.
- [x] `npm test`: 462 files, 2797 tests pass.
- [x] `npm run lint`: 0 errors (1 pre-existing `vue/no-v-html` warning in `AppAiDevChat.vue`).
- [x] `npm run knowledge:check`: OK.
- [x] Mutation spot checks: breaking the step toggle, the card title and the zero-total guard each fails its test.

## What shipped

- `app/utils/building-setup-steps.ts`: `deriveSetupSteps`, `deriveAdvancedSteps`, `countActiveFinanceRules`, `StepListItem`.
- `app/components/buildings/settings/`: `SettingsReadinessCard`, `SettingsStepList`, `AdvancedSection`, `steps/{BasicsStep,InvoiceProfileStep,ServicesStep,InventoryStep,ContractStep}`, `advanced/{IdentityAccessSection,FinanceRulesSection,ServiceOverridesSection}`.
- `app/composables/buildings/useBuildingSettingsSource.ts`: bootstrap data shared with the steps through provide/inject.
- `settings.vue` shrank from 1722 to about 200 lines; `edit.vue` redirects to `settings#basics`; `useBuildingForm` gained `onUpdated`; building form mapping moved to `app/utils/mappers/building-form.ts`.

## Deviations from the plan

- Finance rules (`FinanceRulesSection`) was extracted whole, not split further, as agreed (option b).
- Steps that own their state read bootstrap data through the injected source; inventory items stay in the page so the closed step can still show its summary.
- Components for the card and the list were written before their tests; mutation checks stand in for a red step.
- Spec progress text changed from "n/5" to "n/3" (only required steps count).

## Browser checks on `qa-v2-flow` (production data, fake QA records)

- [x] Desktop: card 2/3 then 3/3 after adding an invoice profile; first missing step opens; all eight panels open with content.
- [x] `/edit` redirects to `settings#basics`; unsaved edit in step 1 then switching step shows the discard modal.
- [x] Mobile 390px: no horizontal overflow, titles wrap, ready state shows the "Lập hợp đồng" link.
- [ ] Manager account: steps hidden and forms read-only by permission (covered by unit tests only).
- [ ] Light theme and keyboard-only pass.
