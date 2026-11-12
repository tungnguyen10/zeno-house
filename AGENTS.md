# Zeno House Agent Guide

This is the canonical cross-agent contract for repository-level rules.
Keep other entry files thin and reference this file instead of duplicating rules.

## Fast Read Order — One Document Root

1. Read `docs/index.md` and `docs/agent-context.md` first. The entire `docs/**` tree is the OKF v0.2 bundle; do not create a second knowledge or specification root.
2. Read the one relevant accepted `docs/capabilities/<name>.md` and any related `docs/changes/<slug>/**` before making decisions. `docs/features/**` and `docs/architecture/**` describe current implementation details.
3. Inspect real source, SQL migrations, and tests. If actual behavior differs from accepted requirements, report and reconcile explicitly; do not silently promote in-progress designs.
4. Read `docs/workflow.md` for the lifecycle; apply available Superpowers skills for brainstorming, planning, TDD, debugging, executing plans, code review, and verification.
5. Never create `docs/superpowers/specs/**`, `docs/superpowers/plans/**`, `knowledge/**` or `openspec/**`. Existing archived design/plan artifacts live in `docs/history/superpowers/**`.

## UI Quality Gate

- Every user-visible UI change must follow `.agents/skills/zeno-house/references/ui-polish-workflow.md`; do not ship a functional-but-unpolished first pass for later redesign.
- Use `frontend-design` for hierarchy, composition, density, interaction, and copy judgment. Use Hallmark for anti-slop critique, affected states, responsiveness, restraint, and final polish.
- Resolve conflicts in this order: explicit user requirements -> accepted behavior -> Zeno House design system and primitives -> frontend architecture/instructions -> `frontend-design` -> Hallmark -> model defaults.
- Generic design skills must not introduce a parallel theme, font system, token set, root `tokens.css`, `design.md`, `.hallmark/*`, CSS stamps, or new reusable primitives unless the user explicitly approves a design-system change.
- Match exploration depth to scope, but keep the quality bar constant. A narrow UI edit preserves the current direction and polishes affected states; a new surface or redesign gets a full direction and visual verification pass.
- When a material optimization needs a product/design-system decision, explain the problem, recommendation, affected surfaces, benefit, cost, and fallback, then ask one focused question.

## Context Budget

- Start with the relevant `docs/capabilities/*.md` and `docs/changes/index.md`; do not load the entire bundle for a small task.
- For active changes, read `docs/changes/<slug>/implementation-plan.md` or `tasks.md`, whichever is canonical; never maintain two competing checklists.
- Work one testable task at a time. Read `docs/history/**` only when history or provenance matters.

## Sources of Truth

1. **Accepted requirements:** `docs/capabilities/**` (OKF); only change these after acceptance/verification.
2. **Proposed or active work:** `docs/changes/**` (OKF proposal, design, and one execution checklist). Not automatically accepted or deployed.
3. **Engineering and user reference:** `docs/architecture/**`, `docs/features/**`, `docs/development/**`, `docs/user-guide/**` (all OKF concepts).
4. **Historical evidence:** `docs/history/**` (deprecated/archived, never current spec).
5. **Implementation evidence:** Source code, database migrations, CI/tests and rollout reports show what actually runs. Report conflicts with documentation.

## Agent Execution Protocol

- **Research/bug investigation:** read matching OKF docs + source/tests; use Superpowers systematic-debugging where needed.
- **Behavioral feature/change:** Superpowers brainstorming and design; store canonical proposal/design under `docs/changes/<slug>/`. One implementation checklist lives in `implementation-plan.md` or migrated `tasks.md`.
- **Implementation:** use Superpowers TDD, executing-plans/subagent-driven-development and review skills as available; do not start a second specifications workflow.
- **Verification:** unit/integration/typecheck/lint, permission/scope, financial invariants and cloud migrations separately; attach evidence to the change.
- **Promotion:** reconcile approved behavior into `docs/capabilities/**`, update engineering docs, and move completed change records to `docs/history/**` (preserve links/provenance).

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

- OKF: run `npm run knowledge:check` to validate the entire `docs/**` bundle, index links and absence of duplicate spec directories.
- Source modifications: run narrow tests first, then `npm run typecheck`, `npm test`, `npm run lint` as appropriate.
- For database or deployment work, verify migration and cloud rollout separately; never claim cloud checks passed from static checks alone.
- On completion: update accepted `docs/capabilities/**`, relevant `docs/changes/**` status, architecture docs, and verification evidence in the same PR.
