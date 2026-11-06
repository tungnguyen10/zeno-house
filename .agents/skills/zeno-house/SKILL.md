---
name: zeno-house
description: Use when working in the Zeno House Nuxt/Supabase repository, including product behavior, architecture, UI, API, database, auth, docs, specs, instructions, or project file routing.
---

# Zeno House

Use this skill to get oriented quickly before changing Zeno House. Keep context small: read the task, read `AGENTS.md`, then read only the reference/doc/spec that matches the task.

## Quick Start

1. Read `AGENTS.md` and `docs/index.md` (only OKF root).
2. Read one task-matching `docs/capabilities/<capability>.md` (accepted requirements), and `docs/changes/<slug>/**` only when it affects active work.
3. Read `docs/agent-context.md` and matching `docs/architecture/**` or `docs/features/**` for implementation guidance.
4. Inspect real source, migrations and tests before changes.
5. Apply Superpowers skills for planning, TDD, debugging and review. Create proposal/design/implementation-plan only under `docs/changes/<slug>/**`.
6. Update accepted capabilities only after verifying and approving behavior; never generate parallel spec/plan trees.

## UI Work

For every user-visible UI change, read `references/ui-polish-workflow.md` before editing. This includes pages, layouts, components, shared styling, responsive behavior, visual states, accessibility presentation, UI copy, and design-system work.

The workflow requires both design skills at the depth appropriate to the change:

- **REQUIRED SUB-SKILL:** Use `frontend-design` for design judgment.
- **REQUIRED SUB-SKILL:** Use `hallmark` for anti-slop critique and final polish.

Read each selected skill's complete `SKILL.md`, then load only task-relevant references. Zeno House requirements, design-system rules, primitives, and frontend architecture override generic design-skill defaults.

## Context Routing

Read `references/context-map.md` when you need:

- a domain-to-file map
- which docs/specs to read for a task
- project invariants
- validation commands
- stale-context warnings

## Project Rules

- Browser business data goes through `server/api/**`; do not query Supabase business tables from client code.
- Flow is page/component -> composable -> API handler -> service -> repository -> Supabase.
- Services own business rules, permissions, scope checks, transactions/RPC orchestration, and audit side effects.
- Repositories query and persist only.
- UI consumes DTOs from `app/types/**`; DB rows map through `app/utils/mappers/**`.
- Zod validators in `app/utils/validators/**` are shared across client/server boundaries.
- OKF concepts live in `docs/**`; accepted behavior is `docs/capabilities/**`, active changes are `docs/changes/**`, historical evidence is `docs/history/**`.

## Verification

- Knowledge: `npm run knowledge:check` (all `docs/**` concepts)
- Changes: consult `docs/changes/index.md`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`
