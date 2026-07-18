---
name: zeno-house
description: Use when working in the Zeno House Nuxt/Supabase repository, including product behavior, architecture, UI, API, database, auth, docs, specs, instructions, or project file routing.
---

# Zeno House

Use this skill to get oriented quickly before changing Zeno House. Keep context small: read the task, read `AGENTS.md`, then read only the reference/doc/spec that matches the task.

## Quick Start

1. Read `docs/agent-context.md`.
2. If the task changes behavior, read the relevant `openspec/specs/<capability>/spec.md`.
3. If implementation guidance is needed, read the matching `docs/architecture/*` or `docs/features/*` file.
4. Inspect source files only after choosing the narrow area.
5. Update code, specs, and docs together when behavior changes.

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
- OpenSpec current specs live in `openspec/specs/**`; archives are history and may be superseded.

## Verification

- Specs: `openspec validate --specs`
- Active changes: `openspec list --json`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`
