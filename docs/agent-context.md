# Agent Context

Use this as the compact orientation page for Zeno House. It should stay short and point to deeper files only when needed.

## Project Snapshot

Zeno House is an authenticated internal property-operations app for rental buildings. It covers building/room setup, tenants, contracts, occupants, services, meter readings, monthly billing, invoice collection, audit history, and manager building scope.

Stack:

- Nuxt 4 compatibility mode, Vue 3, TypeScript strict
- Supabase Auth/Postgres through `@nuxtjs/supabase`
- Pinia for auth/app state; composables for server/workflow state
- TailwindCSS, semantic light/dark dashboard UI, independent portal theme, `nuxt-svgo` icons
- Zod validators shared by client/server
- Vitest for unit, service, repository, and component tests

## Fast Read Routing

Read only what matches the task:

| Task | Start here | Then read |
| --- | --- | --- |
| Any code change | `AGENTS.md`, this file | relevant source files |
| Feature behavior | `knowledge/capabilities/<capability>.md` | `docs/features/*.md` if current UI/domain context is needed |
| New/changed requirement | `docs/development/change-workflow.md` | OKF change under `knowledge/changes/<name>` |
| Frontend/UI | `.agents/skills/zeno-house/references/ui-polish-workflow.md` | `docs/architecture/frontend.md`, `docs/ui-patterns/design-system.md`, applicable `.agents/instructions/**`; use `frontend-design` + Hallmark |
| Server/API | `docs/architecture/api.md` | `docs/architecture/rules.md`, relevant `server/services/**` |
| Auth/permissions | `docs/architecture/auth-permissions.md` | `server/utils/permissions.ts`, `server/utils/scope.ts` |
| Database/Supabase | `docs/architecture/database.md` | migrations under `supabase/migrations/**` |
| Billing | `docs/features/billing.md` | `knowledge/capabilities/billing-*`, `server/services/billing/**` |
| AI assistant | `docs/architecture/ai-agent.md` | active AI OKF change tasks, then `server/services/ai/**` |
| Contracts/occupancy | `docs/features/contracts.md` | `knowledge/capabilities/contracts-*`, `contract-occupants-*` |
| Property CRUD | `docs/features/property-operations.md` | `buildings-*`, `rooms-*`, `tenants-*` specs |
| Services/meters | `docs/features/services-meter-readings.md` | `meter-readings-api`, service specs |

## Source Order

1. Source code, migrations and tests determine what is implemented, not what is approved.
2. `knowledge/capabilities/**` is accepted requirement truth.
3. `knowledge/changes/**` is still-proposed/in-progress intent and checklists.
4. `docs/**` is engineering guidance; reconcile if stale.
5. `knowledge/history/**` links immutable legacy history, not authoritative behavior.

## Active OKF Changes

See `knowledge/changes/index.md`; the source snapshot has four open bundles, with verification evidence and remaining checkbox tasks recorded. Never treat a checked task as proof of cloud rollout or release without source verification.

## AI Implementation Snapshot

Implemented AI foundation surfaces:

- `app/components/app/AppAiDevChat.vue`
- `app/components/app/AppAiActionCard.vue`
- `app/composables/useAiChat.ts`
- `server/api/ai/**`
- `server/services/ai/**`
- `server/repositories/ai/**`
- `app/types/ai.ts`, `app/utils/mappers/ai.ts`, `app/utils/validators/ai.ts`

Current maturity: server-owned foundation plus scoped period opening, deterministic meter import/correction, read-only draft explanation, utility override, invoice issue, and invoice correction plan/confirm paths. Private kill switches, cost-controlled OpenRouter routing with explicit paid-primary opt-in and free fallback, bounded atomic chat turns, distributed user/global limits and circuit state, leased action recovery, prompt-injection regressions, and scheduled retention cleanup are implemented in source. The hardening migration and live staging checks remain explicit rollout steps; production flags stay off until they pass.

## Core Architecture Invariants

- Browser business data must go through `server/api/**`; no client-side Supabase table queries for business data.
- API handlers validate input, call services, and return `{ data, meta? }` or `{ error }`.
- Services own business rules, permissions, scope checks, transactions/RPC orchestration, and audit side effects.
- Repositories own Supabase queries and persistence only.
- UI consumes app DTOs from `app/types/**`, not raw database row shapes.
- DB rows map through `app/utils/mappers/**`.
- Zod schemas in `app/utils/validators/**` are shared across client/server boundaries.
- Pinia is for global auth/app state; server/domain state belongs in composables.

## Verification Shortcuts

- Knowledge: validate YAML frontmatter and links in `knowledge/**`
- Active changes: `knowledge/changes/index.md`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`

Use the narrowest meaningful check first, then broaden when the change touches shared behavior, billing, auth, database, or permissions.
