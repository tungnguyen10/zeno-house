# Zeno House Instructions

Use the checked-in project context instead of rebuilding context from stale phase notes.

## First Reads

1. `AGENTS.md`
2. `docs/agent-context.md`
3. The one architecture, feature, or OpenSpec file that matches the task.

## Core Rules

- Current developer guidance lives in `docs/**`.
- Accepted requirements live in `openspec/specs/**`.
- Active OpenSpec changes live in `openspec/changes/**` excluding `archive`.
- Archived OpenSpec changes are historical context only.
- Browser business data must go through `server/api/**`; do not query Supabase business tables from client code.
- Standard flow: page/component -> composable -> API handler -> service -> repository -> Supabase.
- Services own business rules, permissions, scope checks, and audit side effects.
- Repositories query/persist only.
- Use Zod validators from `app/utils/validators/**` on client/server boundaries.
- Use DTOs from `app/types/**` and mappers from `app/utils/mappers/**`; do not expose raw DB row shapes to UI.
- Use `nuxt-svgo` icons from `app/assets/icons/**`; do not inline SVG for app icons.

## Validation

- Specs: `openspec validate --specs`
- Active changes: `openspec list --json`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`
