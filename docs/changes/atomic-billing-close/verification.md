---
type: Verification Record
title: "ZH-BIL-01 — cleanup verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, billing, finance, verification]
---

# ZH-BIL-01 — verification checkpoint (2026-11-10)

## Supported by current evidence

- `supabase/migrations/20261105140000_atomic_billing_close.sql` provides close/reopen RPCs and closed-period guards; related source/tests and accrual helpers are in `develop`.
- The archived [production SQL verification record](../../history/2026-11-09-harden-tenant-identity-data/verification.md) reports all `atomic_billing_close.sql` procedural assertions passing on the linked production DB on 2026-11-09. The verifier's audit selection was corrected by correlation ID; no billing production function was changed in that fix.
- `app/types/database.types.ts` contains both `close_billing_period_atomic` and `reopen_billing_period_atomic`. Accepted [billing-period-close capability](../../capabilities/billing-period-close.md) covers transactional close/reopen.
- Prior `develop` GitHub Actions `999dc929` passed. This does not confirm current data integrity or live app deployment.

## Still open before archive

- [ ] Run/retain **read-only historical reconciliation** (`supabase/verification/billing_close_integrity.sql`, `scripts/reconcile-reserve-accruals.mjs`) for all relevant buildings/periods and explicitly review outliers before any repair.
- [ ] Document how legacy closed periods without matching audit and reserve-accrual mismatches are handled; do not silently backfill or mutate finance data.
- [ ] Capture two-session close/payment and two-close concurrency checks and authenticated UI test of close/reopen, skipped-accrual warning and forbidden closed-period corrections.
- [ ] Verify target app rollout, relevant grants, month-end worker behavior, and generated types for the deployed migration.
- [ ] Confirm operations report accrual is not overwritten when report is closed; obtain financial/release approval before archive.

The earlier design and implementation checklist are preserved unmodified as historical plans. No production reconciliation or data repair was run during this documentation cleanup.
