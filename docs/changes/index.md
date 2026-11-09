# Active Zeno House Changes

Current change bundles are OKF draft concepts, not deployed or automatically accepted behavior. A Superpowers execution checklist is in each change's `tasks.md` **or** `implementation-plan.md`, never both as independent sources.

- [add-contract-amendments](./add-contract-amendments/proposal.md) — Structured contract amendment lifecycle
- [add-dashboard-light-mode](./add-dashboard-light-mode/proposal.md) — Dual-theme dashboard presentation
- [dashboard-layout-refresh](./dashboard-layout-refresh/proposal.md) — Dashboard information hierarchy and charts
- [harden-event-audit](./harden-event-audit/proposal.md) — Durable audit and outbox guarantees
- [tenant-authorization-scope](./tenant-authorization-scope/design.md) — P0 authorization and scoped tenant access; cloud rollout checks pending
- [atomic-contract-renewal](./atomic-contract-renewal/design.md) — P0 atomic successor renewal, occupants and money transfer
- [atomic-billing-close](./atomic-billing-close/design.md) — P0 atomic billing close/reopen and reconciliation
- [restrict-tenant-portal-profile-edits](./restrict-tenant-portal-profile-edits/index.md) — Four-field contact edits, operator-managed identity, private notes and scoped correction/evidence intake; plan review
- [tenant-v2](./tenant-v2/spec-and-implementation-plan.md) — Umbrella draft, split into B (identity hardening completed; see history) → A (Quick Create) → C (Claude identity autofill)

## Checklist status imported from the previous workflow

- add-contract-amendments: 12 checked, 0 unchecked; verify actual rollout and release before archiving.
- add-dashboard-light-mode: 11 checked, 1 unchecked (manual visual/interaction QA).
- dashboard-layout-refresh: 8 checked, 0 unchecked; verify actual release before archiving.
- harden-event-audit: 12 checked, 4 unchecked.
- tenant-authorization-scope: source and tests recorded as complete, but live SQL verification, type regeneration and responsive QA still require explicit sign-off.
- atomic-contract-renewal: review executable plan and source, then verify cloud migration and results.
- atomic-billing-close: reconcile stored accrual before deployment/verification; do not assume a checked task implies runtime deployment.

Completed: [tenant identity hardening](../history/2026-11-09-harden-tenant-identity-data/index.md) — source, production database rollout, generated types, SQL regressions and affected-state UI QA verified on 2026-11-09.
