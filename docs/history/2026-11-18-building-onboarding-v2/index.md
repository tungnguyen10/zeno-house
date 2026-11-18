# Building onboarding V2

This is a **completed, archived OKF change**. Accepted requirements live in `docs/capabilities/**`; this bundle records the design, implementation plan and verification evidence. Part of the [ZENO House V2 — Flow Optimization Brief](../../changes/zeno-house-v2-optimization/brief.md).

Create building -> setup mode -> first contract; owner contact folded into the lessor profile; contract profile split into two steps with partial save; detail-page setup strip.

## Change documents

- [Design](./design.md)
- [Implementation plan](./implementation-plan.md)
- [Verification evidence](./verification.md)

## Reconciled capabilities

- [buildings-ui](../../capabilities/buildings-ui.md)
- [buildings-api](../../capabilities/buildings-api.md)
- [building-contract-profile](../../capabilities/building-contract-profile.md)

## Verification boundary

Production migration `20261118090000_building_owner_to_lessor.sql` is applied; the read-only checks and the rolled-back fixture script (`supabase/verification/building_owner_to_lessor.sql`, run 2026-11-18) passed, and database types were regenerated. The change merged to `develop` as PR #29.

Not verified (kept explicit, archiving does not assert them): 768 px layout, keyboard-only walkthrough, reduced motion, a 0-room building end to end in a browser, a user without `building-contract-profile.pii.read` in a browser, and an unsaved-changes guard for the lessor and terms steps (only the Basics step has one).
