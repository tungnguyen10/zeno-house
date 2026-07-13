# Zeno House

Zeno House is an internal property operations app for landlords and building managers. It covers the core workflow from building/room setup through tenant contracts, service configuration, meter readings, monthly billing, invoice collection, and period close.

## Stack

- Nuxt 4 compatibility mode, Vue 3, TypeScript strict
- Supabase Auth and Postgres via `@nuxtjs/supabase`
- Pinia for global auth/session state; composables for server state
- TailwindCSS, self-hosted Inter, `nuxt-svgo` icons
- Zod validators shared by API handlers and client forms
- Vitest for unit, service, repository, and component tests

## Local Setup

```bash
npm install
npm run dev
```

The Nuxt dev server is configured for HTTPS in `nuxt.config.ts`.

Required environment values live in `.env` locally and map into Nuxt runtime config:

- Supabase project URL/key values used by `@nuxtjs/supabase`
- `RESEND_API_KEY`
- `ADMIN_EMAIL`
- `NUXT_TURNSTILE_SECRET_KEY`
- `NUXT_PUBLIC_SITE_URL`
- `NUXT_PUBLIC_GA_ID`
- `NUXT_PUBLIC_TURNSTILE_SITE_KEY`

Resend, Turnstile, and GA runtime config exist, but product flows currently focus on authenticated operations rather than public marketing or notification surfaces.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm test
npm run test:coverage
```

## Product Areas

- Dashboard: operational summary across buildings, rooms, tenants, and active contracts.
- Buildings: CRUD, slug-based detail routes, rooms, service defaults, and monthly meter entry.
- Rooms: CRUD, status tracking, building-scoped room detail routes, active contract and history.
- Tenants: CRUD, enriched identity/contact profile, active contract and contract history.
- Contracts: create/edit/detail, occupants, payments, renewals, per-contract services, and handover readings.
- Service catalog: default service definitions, building overrides, and contract-level service sync.
- Meter readings: monthly and handover readings for electricity/water, including bulk entry.
- Monthly operations: billing periods, draft grid, invoice issue, payments, bulk payments, adjustment, void/reissue, unissue, Excel export, audit drawer, invoice detail.
- Internal AI agent platform (planned): chat-driven workflow orchestration through whitelisted internal tools, starting with billing as the pilot domain.

## Architecture

Business data follows one server-mediated path:

```text
page/component
  -> composable ($fetch/useFetch)
  -> server/api handler (auth + Zod)
  -> service (business rules + permissions)
  -> repository (Supabase queries)
```

Client code does not query Supabase directly for business data. API responses use the shared envelope:

```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError = { error: { code: string; message: string; details?: unknown } }
```

Planned internal AI workflows follow the same server-mediated pattern:

```text
chat UI
  -> server/api/ai/chat
  -> internal tool gateway (whitelist + validation + policy)
  -> service (business rules + permissions)
  -> repository (Supabase queries)
```

The model layer is limited to intent parsing and tool selection. Permission checks, scope enforcement, confirmations for mutating actions, and idempotent writes remain server-side.

## Key Docs

- Docs index: `docs/README.md`
- Current project map: `docs/project-status.md`
- Architecture rules: `docs/architecture/rules.md`
- Frontend architecture: `docs/architecture/frontend.md`
- API reference: `docs/architecture/api.md`
- Database and migrations: `docs/architecture/database.md`
- Auth and permissions: `docs/architecture/auth-permissions.md`
- Billing feature guide: `docs/features/billing.md`
- Contracts feature guide: `docs/features/contracts.md`
- Property operations guide: `docs/features/property-operations.md`
- Services and meter readings guide: `docs/features/services-meter-readings.md`
- Local setup: `docs/development/local-setup.md`
- Change workflow: `docs/development/change-workflow.md`
- Testing guide: `docs/development/testing.md`
- Operational design system: `docs/ui-patterns/design-system.md`
- OpenSpec specs: `openspec/specs/**`

## Database

Schema history is kept in `supabase/migrations`. The current migration set includes core property entities, contract/payment/renewal entities, service catalog configuration, simplified meter readings, billing runtime tables, building slugs, and human-readable contract/invoice codes.

Billing runtime tables include:

- `billing_periods`
- `invoices`
- `invoice_charges`
- `invoice_payments`
- `billing_utility_usages`
- `billing_audit_events`

RLS is enabled in migrations as a safety net. Server business operations run through the application service layer and capability checks.

## Tests

```bash
npm test
```

The test suite covers billing rules/services, permissions, SQL/RLS assertions, repository mappings, route helpers, dashboard response shape, and the billing draft grid component. Billing fixtures are deterministic and live in `tests/__fixtures__/billing`.
