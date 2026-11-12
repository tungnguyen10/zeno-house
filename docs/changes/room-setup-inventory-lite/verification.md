---
type: Change Verification
title: "room-setup-inventory-lite-verification"
status: draft
change_state: implementing
tags: [change, verification, rooms, inventory, v2]
---

# Room setup & inventory lite — verification

## Source checks

Implementation starts from `origin/develop` commit `30225644`, independently of PR1. The unchanged baseline source passed 393 files / 2,496 tests earlier in this work session. Scoped checks, reviews and final typecheck/test/lint/OKF evidence will be recorded as tasks complete.

Task 1: `20261112005547_inventory_lite.sql` plus rollback verification script added. TDD observed 9 failed/1 passed against the empty migration; final static/PR0 regression run passed 16 tests (11 new + 5 PR0), scoped ESLint and diff checks passed. Independent static/spec review approved with no findings. SQL compilation, runtime and concurrency are not claimed.

Task 2: inventory DTOs, mapper, shared item/list/apply/batch validators added; observed missing-module RED then 18 tests passed, scoped lint passed. Independent specification/code review passed with no findings.

Tasks 4-10 (2026-11-12): inventory repository/service/audit, inventory and batch-room API routes, contract handover capture and read (ancestry restricted to the authorized building, cycle-safe), shared UI components, building pages (create generator, batch page, settings template with apply modal), room inventory section, contract form handover section, contract detail and checkout reference panel were implemented with tests first. The PR0 create-page test that asserted the replaced count/prefix inputs was superseded by `tests/pages/buildings-create-room-generator.spec.ts`. Audit display labels were added for the three inventory actions.

Task 11 source gates (2026-11-12): `npm run typecheck` exit 0; `npm test` 410 files / 2,624 tests passed; `npm run lint` exit 0 (one pre-existing `vue/no-v-html` warning in AppAiDevChat.vue); `npm run knowledge:check` passed. These are static/mocked checks; SQL compilation, runtime and concurrency are not claimed.

## Preflight decisions

Use the atomic replacement RPC option already offered by Task 4, so an insert failure cannot erase an existing template or room list. Replacement and template application share a per-building transaction lock; merged room lists also respect the 50-item limit. Validate wrapper JSON and numeric bounds rather than relying on implicit casts/rounding. Read handover ancestry only inside the already-authorized building. Existing production RPCs and financial calculations remain unchanged.

## UI decisions

The user explicitly approved the design direction on 2026-11-12: floor-group room preview with direct editing, inventory tables on desktop and cards on mobile, copied building templates, collapsible handover references, and the existing dashboard theme, typography and primitives. No design-system changes are authorized. Component/page polish and rendered verification remain pending.

## Visual QA

- Create-building multi-floor generator: pending.
- Existing-building batch with existing room numbers and template: pending.
- Template edit and merge/replace confirmation: pending.
- Room inventory edit/apply: pending.
- Contract create with/without inventory, renewal handover and checkout reference: pending.

## Cloud gates (human-run)

- Confirm PR0 migration on target environment.
- Apply the CLI-generated inventory migration after backup/dry-run.
- Execute rolled-back inventory SQL verification, including grants, scope, atomic rollback and idempotency.
- Regenerate database types and remove temporary repository casts.
- Deploy after migration; verify contract snapshots and authenticated owner/manager behavior.

No cloud rollout, SQL execution or accepted capability promotion is claimed.
