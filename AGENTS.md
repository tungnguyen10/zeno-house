# Zeno House Agent Guide

This is the canonical cross-agent contract for repository-level rules.
Keep other entry files thin and reference this file instead of duplicating rules.

## Fast Read Order

- Read `docs/agent-context.md` first for project map and task routing.
- Read only the task-matching deep sources needed for the current scope:
   - architecture: `docs/architecture/rules.md`
   - frontend/UI: `docs/architecture/frontend.md`, `docs/ui-patterns/design-system.md`
   - server/API: `docs/architecture/api.md`
   - database/Supabase: `docs/architecture/database.md`
   - auth/permissions: `docs/architecture/auth-permissions.md`
   - feature behavior: `docs/features/*.md`
   - requirement behavior: `openspec/specs/<capability>/spec.md`
- For OpenSpec workflow tasks, use matching `.agents/skills/openspec-*` skill.

## UI Quality Gate

- Every user-visible UI change must follow `.agents/skills/zeno-house/references/ui-polish-workflow.md`; do not ship a functional-but-unpolished first pass for later redesign.
- Use `frontend-design` for hierarchy, composition, density, interaction, and copy judgment. Use Hallmark for anti-slop critique, affected states, responsiveness, restraint, and final polish.
- Resolve conflicts in this order: explicit user requirements -> accepted behavior -> Zeno House design system and primitives -> frontend architecture/instructions -> `frontend-design` -> Hallmark -> model defaults.
- Generic design skills must not introduce a parallel theme, font system, token set, root `tokens.css`, `design.md`, `.hallmark/*`, CSS stamps, or new reusable primitives unless the user explicitly approves a design-system change.
- Match exploration depth to scope, but keep the quality bar constant. A narrow UI edit preserves the current direction and polishes affected states; a new surface or redesign gets a full direction and visual verification pass.
- When a material optimization needs a product/design-system decision, explain the problem, recommendation, affected surfaces, benefit, cost, and fallback, then ask one focused question.

## Context Budget

- Use delta-first reads: `openspec/changes/<active-change>/tasks.md` before broad spec scanning.
- Do not scan all `openspec/specs/**` unless task scope spans multiple capabilities.
- Start implementation with a short read plan (target files + why).
- Keep implementation scope to one checklist task item at a time.

## Source Of Truth

- Current implementation guidance lives in `docs/**`.
- Accepted requirements live in `openspec/specs/**`.
- Active proposals/tasks live in `openspec/changes/**` excluding `archive`.
- Archived changes are history only. Do not resync archive content blindly; later specs may intentionally supersede it.
- Code wins over stale prose. If code and docs disagree, verify in source, then update docs/specs as part of the change.

## Non-Negotiables

- Read the project context and task-matching source before choosing tooling or setup steps.
- Ask for explicit approval before installing any local/system dependency or starting a local
  container/runtime. Do not assume local Postgres is required; database work uses the configured
  Supabase cloud workflow unless project documentation says otherwise.
- Client business data goes through `server/api/**`; do not call Supabase table queries from browser code.
- Standard flow: page/component -> composable -> server API -> service -> repository -> Supabase.
- Services own business rules, permissions, and audit side effects. Repositories query/persist only.
- Use Zod validators from `app/utils/validators/**` on both client and server boundaries.
- Map DB rows through `app/utils/mappers/**`; UI consumes DTOs from `app/types/**`.
- Pinia is for global auth/app state, not domain server state.
- Do not inline `<svg>` in Vue templates for app icons.
- Use the existing `nuxt-svgo` convention: add SVG files to `app/assets/icons/` and render them as `IconName` components.
- Do not modify generated `app/types/database.types.ts` by hand.
- For source code text (comments, user-facing labels/messages, seeded content), never write Vietnamese without diacritics. If Vietnamese copy quality is uncertain, use English instead of unaccented Vietnamese.

## Verification

- Specs changed: `openspec validate --specs`
- Check active changes: `openspec list --json`
- Code edits: run narrow relevant tests first, then `npm run typecheck`, `npm test`, `npm run lint` as needed.
