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

Rendered in the browser on 2026-11-12 against the dev server (Supabase production data, read-only: no save or create was pressed).

- Create-building multi-floor generator: checked at 1280px and 390px; three floors, nine rooms, rent/area editing, no horizontal overflow. A mobile caption row for floor/rent/area was added after this pass.
- Batch page (`/rooms/batch`): renders; template count loads from the migrated schema (0 items), checkbox disabled with a settings link.
- Settings "Nội thất mẫu": section and nav item render, add-row works, empty state and total are correct. Template save and apply modal not exercised (would write production data).
- Room page inventory section: renders with the empty state; edit/apply not exercised.
- Contract detail "Nội thất bàn giao": renders the empty state ("Không có dữ liệu bàn giao"). Contract create form shows the handover inventory section with the empty-room hint.
- Not verified: contract create with seeded inventory, renewed-contract source note, checkout reference panel, apply modal merge/replace.

## Cloud gates (human-run)

- Confirm PR0 migration on target environment.
- Apply the CLI-generated inventory migration after backup/dry-run.
- Execute rolled-back inventory SQL verification, including grants, scope, atomic rollback and idempotency.
- Regenerate database types and remove temporary repository casts.
- Deploy after migration; verify contract snapshots and authenticated owner/manager behavior.

## Cloud rollout log (2026-11-12)

- PR0 migrations were already present on the remote (`supabase migration list --remote`).
- `supabase db push --remote --dry-run` listed only `20261112005547_inventory_lite.sql`; applied to production (zeno-house) after explicit user confirmation. No backup was taken by the agent.
- `app/types/database.types.ts` regenerated from the cloud schema (additive: +252 lines); temporary `as never` casts removed from the inventory, rooms and contracts repositories. Typecheck, server tests and lint pass.
- `supabase/verification/inventory_lite.sql` was NOT run: it is written for staging and creates fixtures and triggers. Run it on staging.
- Not done: app deploy and authenticated smoke test.

No accepted capability promotion is claimed.
