## 1. Regression Baseline

- [x] 1.1 Review current draft-grid component tests and identify behavior that lacks coverage before extraction
- [x] 1.2 Add missing tests for autosave dirty detection and save failure preservation
- [x] 1.3 Add missing tests for discrepancy intent emission from expanded rows
- [x] 1.4 Add missing tests for override payload construction if not already covered

## 2. Autosave Extraction

- [x] 2.1 Create a draft-grid autosave composable for local/saved readings, dirty state, save timers, row save state, and row save errors
- [x] 2.2 Move `saveRow`, `saveAll`, `scheduleRowSave`, and related timer cleanup into the composable
- [x] 2.3 Wire `BillingDraftGridStep.vue` to the composable without changing props/events
- [x] 2.4 Run autosave and optimistic display tests

## 3. Navigation, Paste, And Filters

- [x] 3.1 Extract editable cell ordering, keyboard navigation, and focused-cell paste behavior into a focused composable
- [x] 3.2 Extract filter and expanded-row set state into a focused composable or small helper
- [x] 3.3 Verify focused-cell paste and keyboard navigation tests still pass
- [x] 3.4 Verify filter state and expanded row preservation still behave as before

## 4. Component Extraction

- [x] 4.1 Create `BillingDraftGridOverrideModal` for override form rendering, validation, and payload emission
- [x] 4.2 Create `BillingDraftGridExpandedRow` for line items, blockers, warnings, and discrepancy callout hosting
- [x] 4.3 Keep `BillingMobileDraftRow` behavior compatible with the extracted state APIs
- [x] 4.4 Reduce `BillingDraftGridStep.vue` to coordination, table columns, and layout composition

## 5. Verification

- [x] 5.1 Run draft-grid component tests
- [x] 5.2 Run billing utility tests for bulk readings and optimistic display
- [x] 5.3 Run `npm run lint`
- [x] 5.4 Run `npm run typecheck`
- [x] 5.5 Manually smoke desktop and mobile draft-grid workflows
