---
type: Change Verification
title: "building-contract-defaults-verification"
status: draft
change_state: implementation-review
tags: [change, verification, buildings, pii, v2]
---

# Building contract defaults — verification

## Source checks

- Baseline (2026-11-12): `npm test` passed, 393 files and 2,496 tests.
- Task 1: migration tests failed before implementation and passed afterward (5 tests); task review passed for specification and code quality.
- Task 2: 39 validator/mapper tests and 84 tests including tenant identity regressions passed; typecheck and scoped lint passed. Specification and code quality review passed.
- Final source checks (2026-11-12): `npm run typecheck` exited 0; `npm test` passed 408 files / 2,664 tests; `npm run lint` exited 0 with the existing `AppAiDevChat.vue` `vue/no-v-html` warning (0 errors); `npm run knowledge:check` passed 330 concepts / 26 index files; `git diff --check` passed.
- The first full suite, running concurrently with typecheck/lint and dev, timed out once in the unchanged tenant identity-image handler import (5 seconds). Its isolated rerun passed 3/3 tests in 1.13 seconds, and the full suite passed in 40.44 seconds after stopping dev and other checks. No test timeout or source adjustment was made; the transient failure remains recorded rather than hidden.

## PII checks

- Service, API and real-service bootstrap integration tests passed: manager JSON excludes raw ID, DOB and permanent address while readiness uses the unmasked source.
- Service tests passed: audit contains only `changed_fields` and no raw identity values.
- Validator and repository tests passed: returned/thrown database errors and logs contain no raw identity values; API validation tests also passed for static, non-echoing 422 responses.

## UI decisions

Use the existing operational dashboard design system, Inter typography, semantic light/dark tokens and compact form primitives. Add the contract section after invoice settings, with five groups separated by headings and dividers. Use two columns where space allows and one column on mobile. Manager identity fields render as read-only definitions with explicit masking labels. The payment preview explains the existing operational schedule. The detail page uses two compact readiness rows with expandable missing-field links. No new tokens, fonts or reusable primitives are required.

Task 8 uses existing `UiInput` numeric intent, `UiDatePicker` past-date entry, and read-only `UiDefinitionList` rows. All editable controls disable during save; errors stay next to the form and successful saves refresh readiness. Unknown readiness reads “Đang kiểm tra” instead of a zero-missing claim. Unsaved contract edits warn on route leave and browser close using the existing in-memory portal guard; equivalent bootstrap refreshes preserve the draft. No PII is persisted in browser storage. The save footer spans mobile width and aligns right on wider screens. Hallmark source critique: hierarchy, specificity and restraint meet the existing operational direction; rendered light/dark and responsive inspection remains in the controller visual QA gate.

## Visual QA

Native Chrome inspection on the approved local Nuxt dev runtime (2026-11-12) used a temporary synthetic component fixture with no profile API reads or writes. The original landing page was restored byte-for-byte before full source checks; no fixture route is included in the change.

- 375px dark: empty form, missing readiness counts, expanded repair links and correct contract/invoice anchors.
- 320px dark: complete manager read-only definitions, masked ID and explicit hidden DOB/address; no save controls or material horizontal overflow.
- 414px light: partial owner form retains its entered name and empty fields, readable long repair labels.
- 768px light: two-column full form, explicit zero fees/renewal, copies, save action and the “quá 5 ngày sau hạn thanh toán” overflow sentence.
- 1280px light: complete form, compact ready state, visible static save-error feedback; missing-schedule warning also observed.
- Native keyboard activation/focus was not conclusively exercised through accessibility automation. Component tests verify native button semantics and ARIA list control; authenticated keyboard/route smoke remains a rollout check.
- Final polish retained the existing semantic palette, hierarchy, compact dividers and primitives. No theme or token artifacts were added.

## Review evidence

Tasks 1–8 received independent specification and code-quality review. Task 8's same-record route-parameter draft-loss issue was fixed and independently re-reviewed; its router regression proves cancel/discard and same-building hash behavior (16 focused tests). Task 9 passed six focused tests and controller source review, including authorization arriving after mount, revocation, nonblocking loading/error/retry, repair paths and native button semantics. Its independent review could not run because the subagent service reported workspace credits exhausted. A whole-branch independent review remains outstanding for the same reason; controller self-review does not replace that gate.

## Cloud gates (human-run)

- Migration `20261111172755_building_contract_profiles.sql`: not applied by this change session.
- Run `supabase/verification/building_contract_profiles.sql` and inspect privilege results.
- Verify cascade deletion with a throwaway building in a rolled-back transaction.
- Regenerate database types after migration and remove temporary repository casts.
- Deploy and run scoped owner/manager smoke checks.

Acceptance and archival remain pending these gates; no deployed behavior is claimed.

## Reconciliations

The PR1 draft expected 403 for every out-of-scope request. Accepted building-scope requirements take precedence: detail/readiness reads return 404, writes return 403. The implementation preserves that contract; the draft and tests were corrected. The audit action uses the existing dot-separated naming convention (`building.contract_profile.updated`), with only `changed_fields` metadata.
