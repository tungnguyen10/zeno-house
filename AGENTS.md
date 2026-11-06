# Zeno House Agent Guide

This is the canonical cross-agent contract for repository-level rules.
Keep other entry files thin and reference this file instead of duplicating rules.

## Fast Read Order

1. Read `knowledge/index.md` and `docs/agent-context.md` for routing.
2. For accepted behavior, read only matching `knowledge/capabilities/<name>.md`.
3. For in-progress intent, inspect `knowledge/changes/<change-id>/**` and task checkboxes; do not assume accepted or deployed.
4. Read `docs/architecture/**`, `docs/features/**`, source and tests for runtime facts; archived change links in `knowledge/history/**` are provenance only.
5. Use installed Superpowers skills for brainstorming, writing execution plans, TDD, debugging, verification, and review. Do not invoke OpenSpec CLI or OpenSpec skills.

## UI Quality Gate

- Every user-visible UI change must follow `.agents/skills/zeno-house/references/ui-polish-workflow.md`; do not ship a functional-but-unpolished first pass for later redesign.
- Use `frontend-design` for hierarchy, composition, density, interaction, and copy judgment. Use Hallmark for anti-slop critique, affected states, responsiveness, restraint, and final polish.
- Resolve conflicts in this order: explicit user requirements -> accepted behavior -> Zeno House design system and primitives -> frontend architecture/instructions -> `frontend-design` -> Hallmark -> model defaults.
- Generic design skills must not introduce a parallel theme, font system, token set, root `tokens.css`, `design.md`, `.hallmark/*`, CSS stamps, or new reusable primitives unless the user explicitly approves a design-system change.
- Match exploration depth to scope, but keep the quality bar constant. A narrow UI edit preserves the current direction and polishes affected states; a new surface or redesign gets a full direction and visual verification pass.
- When a material optimization needs a product/design-system decision, explain the problem, recommendation, affected surfaces, benefit, cost, and fallback, then ask one focused question.

## Context Budget

- Read one relevant capability, active change, and source slice first; avoid scanning all 97 capabilities for narrow changes.
- For an active change, read `knowledge/changes/<id>/tasks.md` before exploring related specs.
- Keep one task checklist item in focus during implementation.

## Sources of Truth

- `knowledge/capabilities/**`: accepted requirements and scenarios (OKF).
- `knowledge/changes/**`: proposed/in-progress behavior, design, and tasks (OKF); never promote by default.
- `knowledge/history/**`: historical provenance; later accepted requirements and code may supersede history.
- `knowledge/workflow.md`: one feature/change lifecycle with Superpowers execution.
- `docs/**`: engineering and user guidance; if overlapping normative behavior conflicts, reconcile with accepted knowledge and tests.
- Actual code, migrations, and tests establish implemented behavior. Identify discrepancies explicitly; update knowledge only after verification.
- Treat baseline imported knowledge as migrated, not proof of implementation or production rollout.

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

- OKF: run `npm run knowledge:check` to validate concept frontmatter, lifecycle statuses and index links; no legacy specification CLI is required.
- Source modifications: run narrow tests first, then `npm run typecheck`, `npm test`, `npm run lint` as appropriate.
- For database or deployment work, verify migration and cloud rollout separately; never claim cloud checks passed from static checks alone.
- On completion: update accepted `knowledge/capabilities/**`, relevant `knowledge/changes/**` status, architecture docs, and verification evidence in the same PR.
