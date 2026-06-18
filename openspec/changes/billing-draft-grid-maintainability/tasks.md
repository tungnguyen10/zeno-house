## 1. Regression Baseline

- [ ] 1.1 Review current draft-grid component tests and identify behavior that lacks coverage before extraction
- [ ] 1.2 Add missing tests for autosave dirty detection and save failure preservation
- [ ] 1.3 Add missing tests for discrepancy intent emission from expanded rows
- [ ] 1.4 Add missing tests for override payload construction if not already covered

## 2. Autosave Extraction

- [ ] 2.1 Create a draft-grid autosave composable for local/saved readings, dirty state, save timers, row save state, and row save errors
- [ ] 2.2 Move `saveRow`, `saveAll`, `scheduleRowSave`, and related timer cleanup into the composable
- [ ] 2.3 Wire `BillingDraftGridStep.vue` to the composable without changing props/events
- [ ] 2.4 Run autosave and optimistic display tests

## 3. Navigation, Paste, And Filters

- [ ] 3.1 Extract editable cell ordering, keyboard navigation, and focused-cell paste behavior into a focused composable
- [ ] 3.2 Extract filter and expanded-row set state into a focused composable or small helper
- [ ] 3.3 Verify focused-cell paste and keyboard navigation tests still pass
- [ ] 3.4 Verify filter state and expanded row preservation still behave as before

## 4. Component Extraction

- [ ] 4.1 Create `BillingDraftGridOverrideModal` for override form rendering, validation, and payload emission
- [ ] 4.2 Create `BillingDraftGridExpandedRow` for line items, blockers, warnings, and discrepancy callout hosting
- [ ] 4.3 Keep `BillingMobileDraftRow` behavior compatible with the extracted state APIs
- [ ] 4.4 Reduce `BillingDraftGridStep.vue` to coordination, table columns, and layout composition

## 5. Verification

- [ ] 5.1 Run draft-grid component tests
- [ ] 5.2 Run billing utility tests for bulk readings and optimistic display
- [ ] 5.3 Run `npm run lint`
- [ ] 5.4 Run `npm run typecheck`
- [ ] 5.5 Manually smoke desktop and mobile draft-grid workflows
