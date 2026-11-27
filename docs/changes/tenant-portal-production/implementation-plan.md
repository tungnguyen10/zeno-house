---
type: Implementation Plan
title: "Tenant portal production implementation plan"
status: draft
tags: [tenant, portal, implementation]
---

# Implementation plan

Source implementation and local visual review are complete. Combined verification and cloud release
evidence are tracked in [Verification and release](./verification.md). The cloud gate remains open.

- [x] Correct invoice pagination and add complete-scope financial summary with integration regression coverage.
- [x] Add safe recorded payment history and persisted meter calculation evidence.
- [x] Correct monthly totals, cancelled invoices, debt priority and grace/no-due-date states.
- [x] Deliver mobile-first invoice/home/profile loading, errors, recovery and refresh behavior.
- [x] Add support full detail, robust attachments, guarded drafts and atomic public staff response.
- [x] Add current-primary official contract document reads with scope-denial tests.
- [x] Isolate async-data by account and clear private cache when identity changes.
- [x] Prepare direct-table privacy migration and read-only catalog verification.
- [x] Add safe PWA install/update/offline/reconnect behavior.
- [x] Run focused tests, full suite, typecheck, lint, knowledge validation and production build.
- [x] Inspect representative mobile/desktop UI and affected states.
- [x] Reconcile accepted capability/engineering documentation and retain explicit rollout evidence.
- [ ] Apply database migrations and verify authenticated production journeys before release approval.
