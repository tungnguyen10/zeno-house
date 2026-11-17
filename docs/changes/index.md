# Active Zeno House Changes

`docs/changes/**` contains open proposals, active implementation and outstanding verification/release gates. A checked historical implementation task is **not** proof of production deployment. Approved behavior lives in `docs/capabilities/**`; completed work is archived under `docs/history/**`. Use a single execution checklist per active change.

## In progress / planned

- [harden-event-audit](./harden-event-audit/verification.md) — 12/16 tasks; atomic DB audit/contract correlation and durable cross-system intent remain incomplete.
- [zeno-house-v2-optimization](./zeno-house-v2-optimization/baseline-2026-11-16.md) — V2 PR0–PR5 source baseline review, integrity fixes and release gate matrix.
- [building-onboarding-v2](./building-onboarding-v2/index.md) — implemented on a feature branch, migration applied; browser verification pending (create building → setup mode → first contract; owner folded into lessor).
- [tenant-v2](./tenant-v2/spec-and-implementation-plan.md) — Original umbrella specification; Quick Create is now merged, Claude autofill merged behind flag. Review individual change verification records instead of treating the entire design as unimplemented.

## V2 implementation merged — verification/release gates open

- [building-contract-defaults](./building-contract-defaults/verification.md) — PR1: source merged; 2026-11-15 migration, SQL and selected visual QA recorded; deployment sign-off and capability promotion pending.
- [room-setup-inventory-lite](./room-setup-inventory-lite/verification.md) — PR2: source merged; earlier production SQL passed, 2026-11-16 function-hardening cloud status unverified; Inventory atomic replacements addressed in stabilization branch.
- [tenant-quick-create](./tenant-quick-create/verification.md) — PR3: source merged; busy-tenant duplicate and generic conflict browser states remain.
- [contract-quick-create](./contract-quick-create/verification.md) — PR4a: source merged; create/restore QA performed, retry and 409 end-to-end verification remain.
- [contract-documents](./contract-documents/verification.md) — PR4b: source merged, contract DOCX verified locally; deployed smoke and failed regeneration pending; **appendix issuance not supported yet**.
- [tenant-identity-autofill](./tenant-identity-autofill/verification.md) — PR5: source merged behind flags; OCR privacy/security/benchmark/cloud type-generation gates remain.
- [building-settings-setup-flow](./building-settings-setup-flow/verification.md) — implementation accepted into buildings-ui; keyboard QA pending, archive decision still open.

## Other implementation present — verification or rollout gates open

- [add-dashboard-light-mode](./add-dashboard-light-mode/verification.md) — 11/12 tasks; responsive interactive visual QA 4.3 remains.
- [tenant-authorization-scope](./tenant-authorization-scope/verification.md) — ZH-SEC-01; scoped SQL verified, application/visual acceptance pending.
- [atomic-contract-renewal](./atomic-contract-renewal/verification.md) — ZH-CTR-01; financial/deposit compatibility sign-off pending.
- [atomic-billing-close](./atomic-billing-close/verification.md) — ZH-BIL-01; historical accrual reconciliation and concurrency gate pending.
- [add-contract-amendments](./add-contract-amendments/verification.md) — application implemented; worker/cron rollout and new canonical capability approval pending.

## Completed and archived — not active

- [atomic-building-room-setup](../history/2026-11-11-atomic-building-room-setup/index.md) — PR0 accepted and archived; retry/concurrency deployment gates are retained explicitly in its history verification record.
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
