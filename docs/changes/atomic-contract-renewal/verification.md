---
type: Verification Record
title: "ZH-CTR-01 — cleanup verification checkpoint"
status: draft
change_state: verification-pending
tags: [change, contracts, finance, verification]
---

# ZH-CTR-01 — verification checkpoint (2026-11-10)

## Supported by current evidence

- `supabase/migrations/20261105120000_atomic_contract_renewal.sql` and `renew_contract_atomic` server/repository/UI integrations exist in `develop` with targeted tests.
- The archived [production SQL verification](../../history/2026-11-09-harden-tenant-identity-data/verification.md) reports all procedural assertions in `atomic_contract_renewal.sql` passing on 2026-11-09; fixture mutations were rolled back.
- `app/types/database.types.ts` contains `renew_contract_atomic`; `docs/capabilities/contract-renewal.md` describes atomic renewal and successor occupancy transfer.
- GitHub Actions for `develop` `999dc929` passed on 2026-11-10. These checks do not establish authenticated application deployment.

## Still open before archive

- [ ] Verify live app rollout and authenticated renewal → successor flow with 0/1/multiple roommates, carried services and prior/next billing dates.
- [ ] Capture two-session competing-renewal concurrency results, idempotent retry and failed-mid-transaction rollback evidence if not already independently retained.
- [ ] Reconcile the **2026-11-10 deposit/checkout changes** (`20261110090000_contract_deposit_single_source.sql`, `20261110100000_checkout_invoice_sequential_code.sql`) against the original `contract_checkout_sources` transfer assumptions. Explicitly distinguish agreed deposit from actually received/held money before confirming refunds.
- [ ] Check any legacy successor/occupant/source anomalies using the read-only `contract_renewal_integrity.sql`; approve remediation separately if needed.
- [ ] Resolve differences between `docs/development/checkout-sql-verification.md`, current checkout source semantics and the active accepted financial capabilities. Record financial acceptance, then archive.

No new production migration, financial mutation or live concurrency test was run in this documentation cleanup. Historical TDD steps in the implementation plan remain a design/execution record, not a reliable checkbox status for the current checkout schema.
