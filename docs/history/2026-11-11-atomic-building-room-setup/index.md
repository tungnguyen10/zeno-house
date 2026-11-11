# Atomic Building + Room setup (V2 PR0)

This is a **completed, archived OKF change**. Accepted requirements live in `docs/capabilities/**`; this bundle records the design, implementation plan and verification evidence. It is the first sub-project of the [ZENO House V2 — Flow Optimization Brief](../../changes/zeno-house-v2-optimization/brief.md).

## Change documents

- [Design](./design.md)
- [Implementation plan](./implementation-plan.md)
- [Verification evidence](./verification.md)

## Reconciled capabilities

- [buildings-api](../../capabilities/buildings-api.md)
- [buildings-ui](../../capabilities/buildings-ui.md)
- [rooms-api](../../capabilities/rooms-api.md)
- [rooms-database](../../capabilities/rooms-database.md)

## Verification boundary

Migration `20261111090000_create_building_with_rooms.sql` is applied to production. The rollback-wrapped SQL verification script passed there, grants were checked read-only, and database types were regenerated. The user accepted the change on 2026-11-11.

Still open and not claimed as passed: the CI result for PR #21, desktop 1280px and true 375px inspection, browser loading/duplicate/network-error states, the committed two-session concurrency case, and the retry-after-lost-response smoke (the 30-room create was user-reported OK). See [verification](./verification.md).
