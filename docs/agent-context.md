---
type: Agent Context
title: "agent-context"
status: stable
tags: [engineering, reference]
---

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

- All documentation is in one OKF bundle: `docs/**`; see `docs/index.md`.
- Accepted requirements: `docs/capabilities/**`, in-progress work: `docs/changes/**`, history: `docs/history/**`.
- Feature behavior: relevant accepted capability + `docs/features/**` + implementation and tests.
- UI: `docs/ui-patterns/design-system.md`, `docs/architecture/frontend.md`, Zeno House UI polish workflow.
- Server/database/auth: `docs/architecture/{api,database,auth-permissions}.md` and relevant source/migrations.
- Execute designs/plans with Superpowers and keep new proposal, design and plan under the same `docs/changes/<slug>/**` directory.

## Source Order

1. Source code, migrations and tests determine what is implemented, not what is approved.
2. `docs/capabilities/**` is accepted requirement truth.
3. `docs/changes/**` is still-proposed/in-progress intent and checklists.
4. `docs/**` is engineering guidance; reconcile if stale.
5. `docs/history/**` links immutable legacy history, not authoritative behavior.

## Active OKF Changes

See `docs/changes/index.md`; nine tracked bundles, with verification evidence and remaining checkbox tasks recorded. Never treat a checked task as proof of cloud rollout or release without source verification.

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

- Knowledge: validate YAML frontmatter and links in `docs/**`
- Active changes: `docs/changes/index.md`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Lint: `npm run lint`

Use the narrowest meaningful check first, then broaden when the change touches shared behavior, billing, auth, database, or permissions.
