## 1. Shared Billing Core

- [x] 1.1 Create a focused billable-contract-in-period helper for building/month eligibility
- [x] 1.2 Add unit tests for included and excluded contract statuses and date overlap cases
- [x] 1.3 Create a pricing-aware required-reading progress helper that can account for utility overrides
- [x] 1.4 Add unit tests for electricity `per_kwh`, water `per_m3`, water `per_person`, water `fixed_per_room`, and override completion

## 2. Server Wiring

- [x] 2.1 Update `BillingDraftService.calculateDraft()` to use the shared billable-contract helper
- [x] 2.2 Update `BillingDraftGridService.getGrid()` to use shared eligibility/progress behavior where applicable
- [x] 2.3 Update `BillingPeriodService.list()` to use pricing-aware required-reading progress
- [x] 2.4 Update `BillingPeriodService.getOverview()` to use pricing-aware required-reading progress
- [x] 2.5 Add regression tests proving period list, overview, drafts, and draft grid agree for the same fixture

## 3. Display Enrichment

- [x] 3.1 Identify the authoritative user display source for actor ids
- [x] 3.2 Update `BillingDisplayResolver.loadActors()` to batch load actor display names/emails when available
- [x] 3.3 Add tests for resolved and unresolved audit actor/payment recorder display values
- [x] 3.4 Verify audit drawer and payment history render user-facing values without raw UUIDs in primary columns

## 4. Client Action Safety

- [x] 4.1 Refactor issue confirmation so the async mutation is awaited before modal close and selection clear
- [x] 4.2 Refactor close confirmation so the async mutation is awaited before modal close
- [x] 4.3 Add component tests for successful and failed issue confirmation
- [x] 4.4 Add component tests for failed close confirmation

## 5. Verification

- [x] 5.1 Run `npm test -- tests/server/billing`
- [x] 5.2 Run affected billing component tests
- [x] 5.3 Run `npm run lint`
- [x] 5.4 Run `npm run typecheck`
- [x] 5.5 Update billing documentation if the reading progress definition changes user-visible queue metrics
