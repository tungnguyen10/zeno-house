# Active Zeno House Changes

`docs/changes/**` contains open proposals, active implementation and outstanding verification/release gates. A checked historical implementation task is **not** proof of production deployment. Approved behavior lives in `docs/capabilities/**`; completed work is archived under `docs/history/**`. Use a single execution checklist per active change.

## In progress / planned

- [harden-event-audit](./harden-event-audit/verification.md) — 12/16 tasks; failure injection, transactional DB audits, contract correlations and cross-system durable intent remain open.
- [tenant-v2](./tenant-v2/spec-and-implementation-plan.md) — Proposed Quick Create and Claude extraction; completed identity hardening is archived separately.
- [zeno-house-v2-optimization](./zeno-house-v2-optimization/brief.md) — Draft product flow optimization, pending PR task breakdown.
- [atomic-building-room-setup](./atomic-building-room-setup/index.md) — V2 PR0: atomic Building + bulk Room creation; plan ready.
- [building-contract-defaults](./building-contract-defaults/index.md) — V2 PR1: lessor profile, contract policy defaults, readiness; plan ready.
- [room-setup-inventory-lite](./room-setup-inventory-lite/index.md) — V2 PR2: floor-based room generator, room inventory, contract handover snapshot; plan ready.
- [tenant-quick-create](./tenant-quick-create/index.md) — V2 PR3 / Tenant V2 change A: inline tenant picker + quick create; plan ready.

## Implementation present — verification or rollout gates open

- [add-dashboard-light-mode](./add-dashboard-light-mode/verification.md) — 11/12 tasks; automated theme coverage exists, desktop/tablet/mobile visual and interactive QA task 4.3 remains open.
- [tenant-authorization-scope](./tenant-authorization-scope/verification.md) — ZH-SEC-01; source and production SQL verification recorded, responsive/authenticated UI and deployment sign-off pending.
- [atomic-contract-renewal](./atomic-contract-renewal/verification.md) — ZH-CTR-01; production SQL checks passed, new checkout/deposit financial compatibility and release sign-off pending.
- [atomic-billing-close](./atomic-billing-close/verification.md) — ZH-BIL-01; production SQL checks passed, legacy financial reconciliation and concurrency/release sign-off pending.
- [add-contract-amendments](./add-contract-amendments/verification.md) — 12/12 imported tasks checked; production/staging worker, cron, migration evidence and accepted canonical capability pending.

## Completed and archived — not active

- [dashboard-layout-refresh](../history/2026-11-10-dashboard-layout-refresh/index.md) — 8/8 imported implementation tasks checked; accepted dashboard spec reconciled and implementation history archived.
- [harden-tenant-identity-data](../history/2026-11-09-harden-tenant-identity-data/index.md) — Production schema, identity verification and affected-state checks recorded.
- [restrict-tenant-portal-profile-edits](../history/2026-11-10-restrict-tenant-portal-profile-edits/index.md) — Source and production SQL verified; application rollout is separately tracked.

## Lifecycle

1. Verify actual source, tests, grants, cloud rollout and relevant UI/finance gates, not just checked boxes.
2. Reconcile approved behavioral deltas into `docs/capabilities/**` and update engineering guides.
3. Move completed design, execution and evidence into `docs/history/<date>-<slug>/**`, preserving provenance.
4. Remove completed bundles from the active list; retain a redirect `docs/changes/<slug>/index.md` only when useful for old references.
5. Run `npm run knowledge:check`, scoped verification and CI before merging documentation cleanup to `develop`.

See [workflow](../workflow.md).
