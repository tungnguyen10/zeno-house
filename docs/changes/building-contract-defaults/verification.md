---
type: Change Verification
title: "building-contract-defaults-verification"
status: draft
change_state: implementing
tags: [change, verification, buildings, pii, v2]
---

# Building contract defaults — verification

## Source checks

- Baseline (2026-11-12): `npm test` passed, 393 files and 2,496 tests.
- Task 1: migration tests failed before implementation and passed afterward (5 tests); task review passed for specification and code quality.
- Task 2: 39 validator/mapper tests and 84 tests including tenant identity regressions passed; typecheck and scoped lint passed. Specification and code quality review passed.
- Final typecheck, test, lint and knowledge checks: pending.

## PII checks

- Service masking passed for manager; settings bootstrap coverage pending.
- Service tests passed: audit contains only `changed_fields` and no raw identity values.
- Validator and repository tests passed: returned/thrown database errors and logs contain no raw identity values; API validation coverage pending.

## UI decisions

Use the existing operational dashboard design system, Inter typography, semantic light/dark tokens and compact form primitives. Add the contract section after invoice settings, with five groups separated by headings and dividers. Use two columns where space allows and one column on mobile. Manager identity fields render as read-only definitions with explicit masking labels. The payment preview explains the existing operational schedule. The detail page uses two compact readiness rows with expandable missing-field links. No new tokens, fonts or reusable primitives are required.

Task 8 uses existing `UiInput` numeric intent, `UiDatePicker` past-date entry, and read-only `UiDefinitionList` rows. All editable controls disable during save; errors stay next to the form and successful saves refresh readiness. Unknown readiness reads “Đang kiểm tra” instead of a zero-missing claim. Unsaved contract edits warn on route leave and browser close using the existing in-memory portal guard; equivalent bootstrap refreshes preserve the draft. No PII is persisted in browser storage. The save footer spans mobile width and aligns right on wider screens. Hallmark source critique: hierarchy, specificity and restraint meet the existing operational direction; rendered light/dark and responsive inspection remains in the controller visual QA gate.

## Visual QA

- Owner empty, partial, complete and save-error states: pending.
- Manager masked read-only state: pending.
- Missing schedule and overdue-day overflow: pending.
- Detail readiness missing and ready states: pending.
- Desktop and mobile rendered inspection: pending (local runtime approved).

## Cloud gates (human-run)

- Migration `20261111172755_building_contract_profiles.sql`: not applied by this change session.
- Run `supabase/verification/building_contract_profiles.sql` and inspect privilege results.
- Verify cascade deletion with a throwaway building in a rolled-back transaction.
- Regenerate database types after migration and remove temporary repository casts.
- Deploy and run scoped owner/manager smoke checks.

Acceptance and archival remain pending these gates; no deployed behavior is claimed.

## Reconciliations

The PR1 draft expected 403 for every out-of-scope request. Accepted building-scope requirements take precedence: detail/readiness reads return 404, writes return 403. The implementation preserves that contract; the draft and tests were corrected. The audit action uses the existing dot-separated naming convention (`building.contract_profile.updated`), with only `changed_fields` metadata.
