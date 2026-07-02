# Zeno House Agent Guide

This file is the first-read map for agents working in this repo. Keep it short; route detailed context to the right source instead of duplicating it here.

## Read Order

1. Read `docs/agent-context.md` for the project map, source-of-truth rules, and task routing.
2. Read only the detailed doc/spec that matches the task:
   - architecture rules: `docs/architecture/rules.md`
   - frontend/UI: `docs/architecture/frontend.md`, `docs/ui-patterns/design-system.md`
   - server/API: `docs/architecture/api.md`
   - database/Supabase: `docs/architecture/database.md`
   - auth/permissions: `docs/architecture/auth-permissions.md`
   - feature behavior: `docs/features/*.md`
   - requirement-level behavior: `openspec/specs/<capability>/spec.md`
3. For OpenSpec workflow tasks, use the matching `.agents/skills/openspec-*` skill.

## Source Of Truth

- Current implementation guidance lives in `docs/**`.
- Accepted requirements live in `openspec/specs/**`.
- Active proposals/tasks live in `openspec/changes/**` excluding `archive`.
- Archived changes are history only. Do not resync archive content blindly; later specs may intentionally supersede it.
- Code wins over stale prose. If code and docs disagree, verify in source, then update docs/specs as part of the change.

## OpenSpec

- Use OpenSpec for product behavior, data model, API contracts, permissions, billing/financial behavior, and multi-file workflow changes.
- Current specs validate with `openspec validate --specs`.
- Before archiving or syncing specs, compare active deltas with current main specs and later archives; avoid resurrecting deprecated requirements.

## Engineering Rules

- Client business data goes through `server/api/**`; do not call Supabase table queries from browser code.
- Standard flow: page/component -> composable -> server API -> service -> repository -> Supabase.
- Services own business rules, permissions, and audit side effects. Repositories query/persist only.
- Use Zod validators from `app/utils/validators/**` on both client and server boundaries.
- Map DB rows through `app/utils/mappers/**`; UI consumes DTOs from `app/types/**`.
- Pinia is for global auth/app state, not domain server state.

## Icon Usage

- Do not inline `<svg>` in Vue templates for app icons.
- Use the existing `nuxt-svgo` convention: add SVG files to `app/assets/icons/` and render them as `IconName` components.
- Keep inline SVG out of components unless it is a genuinely custom drawing that cannot reasonably live in the icon asset set.

## Verification

- For docs/spec-only edits: run `openspec validate --specs` when specs changed.
- For code edits: run the narrowest relevant test first, then `npm run typecheck` or broader tests when risk warrants it.
- Do not modify generated `app/types/database.types.ts` by hand.
