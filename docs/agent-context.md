# Agent Context

Use this as the compact orientation page for Zeno House. It should stay short and point to deeper files only when needed.

## Project Snapshot

Zeno House is an authenticated internal property-operations app for rental buildings. It covers building/room setup, tenants, contracts, occupants, services, meter readings, monthly billing, invoice collection, audit history, and manager building scope.

Stack:

- Nuxt 4 compatibility mode, Vue 3, TypeScript strict
- Supabase Auth/Postgres through `@nuxtjs/supabase`
- Pinia for auth/app state; composables for server/workflow state
- TailwindCSS, operational dark UI, `nuxt-svgo` icons
- Zod validators shared by client/server
- Vitest for unit, service, repository, and component tests

## Fast Read Routing

Read only what matches the task:

| Task | Start here | Then read |
| --- | --- | --- |
| Any code change | `AGENTS.md`, this file | relevant source files |
| Feature behavior | `openspec/specs/<capability>/spec.md` | `docs/features/*.md` if current UI/domain context is needed |
| New/changed requirement | `docs/development/change-workflow.md` | OpenSpec change under `openspec/changes/<name>` |
| Frontend/UI | `docs/architecture/frontend.md` | `docs/ui-patterns/design-system.md`, `.agents/instructions/components.instructions.md` |
| Server/API | `docs/architecture/api.md` | `docs/architecture/rules.md`, relevant `server/services/**` |
| Auth/permissions | `docs/architecture/auth-permissions.md` | `server/utils/permissions.ts`, `server/utils/scope.ts` |
| Database/Supabase | `docs/architecture/database.md` | migrations under `supabase/migrations/**` |
| Billing | `docs/features/billing.md` | `openspec/specs/billing-*`, `server/services/billing/**` |
| Contracts/occupancy | `docs/features/contracts.md` | `openspec/specs/contracts-*`, `contract-occupants-*` |
| Property CRUD | `docs/features/property-operations.md` | `buildings-*`, `rooms-*`, `tenants-*` specs |
| Services/meters | `docs/features/services-meter-readings.md` | `meter-readings-api`, service specs |

## Source Order

1. Code is the final truth when docs are stale.
2. `openspec/specs/**` is the accepted requirement truth.
3. `openspec/changes/<active-change>/**` describes in-progress intended behavior.
4. `docs/**` explains current architecture and operating guidance.
5. `openspec/changes/archive/**` is history. Later archives or current specs may supersede it.

When a task changes behavior, update code, specs, and developer docs together unless the user explicitly asks for a narrow docs/spec-only edit.

## Active OpenSpec State

Run `openspec list --json` for the current source of truth. As of 2026-07-02, the active change is:

- `add-owner-scoped-access`

Do not assume archived changes still need syncing. Check current specs first.

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

- Specs: `openspec validate --specs`
- Active changes: `openspec list --json`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`

Use the narrowest meaningful check first, then broaden when the change touches shared behavior, billing, auth, database, or permissions.
