---
type: Change Implementation Plan
title: "building-settings-setup-flow-implementation-plan"
status: deprecated
change_state: completed
tags: [superpowers, change, buildings, settings, ui, v2]
---

# Building settings — setup flow Implementation Plan

> **For agentic workers:** execute task by task; each step uses checkbox syntax. Execution method: native (single session) with a whole-branch review at the end.

**Goal:** Reorganize `/dashboard/buildings/[slug]/settings` into a setup-flow step list with a readiness card and fold `edit.vue` into step 1.

**Architecture:** A pure `deriveSetupSteps()` turns the existing settings bootstrap (readiness, building, profiles, services, inventory) into an ordered list of steps with status and summary. `SettingsStepList` renders one collapsible row per step (only one open at a time, synced with `route.hash`); `SettingsReadinessCard` shows overall progress. Step bodies are extracted into components one at a time; the finance rules block is wrapped, not split.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, Tailwind with existing `Ui*` primitives, Vitest + Vue Test Utils.

**Spec:** [design.md](./design.md)

## Progress (2026-11-15)

- Task 1 done: `app/utils/building-setup-steps.ts` with 10 tests.
- Task 2 done: `SettingsReadinessCard`, `SettingsStepList` (adds `numbered` and `statusLabel` for the Advanced group) with tests. Components were written before their tests, so those two tests were never seen failing.
- Task 3 done: page rewired to the card and step list; step bodies are still slots inside `settings.vue`. Existing source-text page specs updated; `building-settings-setup-flow.spec.ts` added.
- Task 4 done: `BasicsStep` embeds `BuildingForm`; `useBuildingForm` gained `onUpdated` (no redirect when embedded); `buildingToFormData` and `emptyBuildingFormData` moved to `app/utils/mappers/building-form.ts`; `/edit` redirects to `settings#basics`; readiness anchors and `buildingEditPath` point at `basics`; the unused `editPath` prop was removed from `BuildingReadinessCard`.
- Task 5 done: `InvoiceProfileStep`, `ContractStep`, `ServicesStep`, `InventoryStep`, `AdvancedSection` with `IdentityAccessSection`, `FinanceRulesSection`, `ServiceOverridesSection`; bootstrap data shared via `useBuildingSettingsSource`. `settings.vue` is about 200 lines.
- Task 6 done except accepting the capability: see [verification](./verification.md). `docs/capabilities/buildings-ui.md` is updated only after the design is accepted.
- Verified: typecheck 0 errors, 2797 tests pass, lint 0 errors; browser checks on `qa-v2-flow` (desktop, mobile, ready state, redirect, unsaved-changes modal).

## Global Constraints

- No API, permission, validator, migration or data changes.
- Reuse existing `Ui*` primitives and icons from `app/assets/icons/`; no new primitive, token or theme.
- Vietnamese copy with full diacritics only.
- Bootstrap data comes from `useBuildingSettingsBootstrap`; composables in `app/composables/buildings/*` keep their public API.
- Required steps (counted in progress): basics, invoice-profile, contract-profile. Services is a warning, inventory is optional; neither blocks.
- Old anchors keep working: `#invoice-profile`, `#contract-profile`; `/edit` redirects to `settings#basics`.

## Review Focus

- Tòa nhà mới chưa có hồ sơ nào: mọi bước bắt buộc báo thiếu, không lỗi khi `contractProfile`, `invoiceProfile` là `null`.
- Manager (không có `building-contract-profile.read` hoặc `rooms.read`): bước đó không xuất hiện và không tính vào tiến độ.
- URL có hash không tồn tại: rơi về bước thiếu đầu tiên, không lỗi.
- Đang có thay đổi chưa lưu mà mở bước khác: không mất dữ liệu âm thầm.
- Dịch vụ bật nhưng giá 0: cảnh báo, không chặn "sẵn sàng".

---

### Task 1: `deriveSetupSteps` (pure logic)

**Files:**
- Create: `app/utils/building-setup-steps.ts`
- Test: `tests/utils/building-setup-steps.test.ts`

**Interfaces:**
- Produces: `SetupStepId`, `SetupStepStatus`, `SetupStep`, `SetupStepsInput`, `SetupFlow`, `deriveSetupSteps(input: SetupStepsInput): SetupFlow`

- [ ] Write failing tests: all ready; new building with nothing; manager hiding contract and inventory; unpriced active service; optional empty states; next step picks first required missing.
- [ ] Run `npx vitest run tests/utils/building-setup-steps.test.ts` and confirm failure.
- [ ] Implement `deriveSetupSteps` (code-prefix mapping of `readiness.contract.missing ∪ readiness.billing.missing`: `billing.` → basics, `invoice_profile` → invoice-profile, `lessor.`/`contract.`/`terms.` → contract-profile).
- [ ] Run the tests until they pass.

### Task 2: `SettingsReadinessCard` and `SettingsStepList`

**Files:**
- Create: `app/components/buildings/settings/SettingsReadinessCard.vue`, `app/components/buildings/settings/SettingsStepList.vue`
- Test: `tests/components/buildings/settings/SettingsReadinessCard.test.ts`, `tests/components/buildings/settings/SettingsStepList.test.ts`

**Interfaces:**
- Consumes: `SetupFlow`, `SetupStep` from Task 1.
- Produces: `SettingsReadinessCard` props `{ flow: SetupFlow, createContractPath: string }`, emits `open-step(id)`. `SettingsStepList` props `{ steps: SetupStep[], openId: string | null }`, emits `update:openId`, named slots `step-<id>` and `step-<id>-actions`.

- [ ] Write failing tests (card: progress text, next-step button, ready state with contract link; list: renders summary/status, click toggles, only one open, slot content visible only for the open step).
- [ ] Implement the components; re-run tests.

### Task 3: Wire the page to the step list (slots, no extraction yet)

**Files:**
- Modify: `app/pages/dashboard/buildings/[id]/settings.vue`
- Test: `tests/pages/building-settings-setup-flow.spec.ts`, keep existing settings page specs green

**Interfaces:**
- Consumes: Tasks 1 and 2. Page keeps its current composables and handlers; existing section markup moves into the step slots; finance rules and managers go under Advanced.

- [ ] Write failing page test: renders the readiness card and the five steps, opens the first missing step, honors `route.hash`, hides steps by permission.
- [ ] Replace the 4 metric tiles, side nav and mobile tab bar with the card and step list; reorder sections; keep every handler and modal.
- [ ] Run page specs and `npm run typecheck`.

### Task 4: Fold `edit.vue` into step 1 and add redirect

**Files:**
- Create: `app/components/buildings/settings/steps/BasicsStep.vue`
- Modify: `app/pages/dashboard/buildings/[id]/settings.vue`, `app/pages/dashboard/buildings/[id]/edit.vue` (redirect to `settings#basics`), `app/utils/constants/readiness.ts` (`anchor: 'edit'` → `'basics'`), `app/utils/routes/operational.ts` if `buildingEditPath` is used by links
- Test: `tests/pages/building-edit-redirect.spec.ts`, `tests/components/buildings/settings/steps/BasicsStep.test.ts`

- [ ] Write failing tests (redirect target; BasicsStep saves through the same `useBuildingForm` path and emits saved).
- [ ] Implement, reuse `BuildingForm`; update readiness anchors and any link to `buildingEditPath`.
- [ ] Run related specs.

### Task 5: Extract remaining step bodies

**Files:**
- Create: `steps/ContractStep.vue`, `steps/InventoryStep.vue`, `steps/ServicesStep.vue`, `steps/InvoiceProfileStep.vue`, `AdvancedSection.vue` under `app/components/buildings/settings/`
- Modify: `settings.vue`
- Test: move existing `building-settings-contract-profile.spec.ts`, `building-settings-prepaid-delete.spec.ts`, `building-inventory-pages.spec.ts` to the new components without lowering coverage

- [ ] One step at a time: move markup and its state into the component, keep the page spec green, commit.
- [ ] Wrap the finance rules block in `AdvancedSection` unchanged.

### Task 6: Verification and docs

- [ ] `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`.
- [ ] Browser check on `qa-v2-flow` at desktop and 390px (missing and ready card states).
- [ ] Update `docs/capabilities/buildings-ui.md`, mark the change verified, write `verification.md`.
