# Zeno House - Project Status

Last reviewed from source: 2026-06-28.

This file summarizes what the current codebase already handles. It reflects the working tree as read on 2026-06-28, including active invoice browse work currently present in the repo.

Zeno House is now an authenticated internal operations app for rental buildings. The implemented surface covers the core landlord workflow from property setup to contract lifecycle, service configuration, meter readings, monthly billing, invoice collection, corrections, period close, and operational dashboard monitoring.

## Source Inventory

| Area | Current count / scope |
| --- | --- |
| Nuxt pages | 27 Vue page files under `app/pages/**` |
| Vue components | 79 Vue component files under `app/components/**` |
| Server API handlers | 71 route handlers under `server/api/**` |
| Supabase migrations | 37 SQL migration files under `supabase/migrations` |
| Tests | 57 `*.test.ts` / `*.spec.ts` files under `tests/**` |
| OpenSpec specs | 50+ capability specs under `openspec/specs/**` |
| Archived OpenSpec changes | 45 archived changes under `openspec/changes/archive/**` |
| Active OpenSpec changes | `simplify-billing-period-workflow` and `contracts-overhaul` |

## Current Stack

| Layer | Current implementation |
| --- | --- |
| App framework | Nuxt 4 compatibility mode, Vue 3, TypeScript strict |
| UI | TailwindCSS, operational dark theme, self-hosted Inter, `nuxt-svgo` icons |
| Charts | Chart.js + `vue-chartjs` for dashboard collection and revenue visuals |
| State | Pinia for auth/session; composables for server state and workflow state |
| Backend | Nuxt server routes, service/repository layers, Supabase Postgres/Auth |
| Validation | Zod schemas in `app/utils/validators/**` |
| Data mapping | DTO mappers in `app/utils/mappers/**` |
| Tests | Vitest with happy-dom, service/repository/unit/component coverage |
| Workflow docs | OpenSpec specs and archived change proposals/design/tasks |

## Architecture Shape

Business data follows one server-mediated path:

```text
page/component
  -> composable ($fetch/useFetch)
  -> server/api handler (auth + Zod)
  -> service (business rules + permissions + audit)
  -> repository (Supabase query/persistence)
  -> Supabase Postgres
```

Client business flows do not query Supabase tables directly. API handlers return a shared envelope:

```ts
type ApiSuccess<T, M extends Record<string, unknown> = Record<string, unknown>> = {
  data: T
  meta?: M
}

type ApiError = {
  error: {
    code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'CONFLICT' | 'INTERNAL'
    message: string
    details?: unknown
  }
}
```

Readable operational identifiers are first-class. Public route/query/body boundaries can accept UUIDs or readable codes/slugs where supported, then services/repositories resolve them back to UUIDs before doing persistence work.

## Product Surface

### Auth And App Shell

- Supabase Auth powers sessions.
- Route protection lives in `app/middleware/auth.global.ts`.
- Login uses `app/pages/login.vue` plus guest-only middleware.
- Server API auth is normalized by `server/middleware/01.auth.ts`.
- Global auth/session state lives in `app/stores/auth.ts`.
- Supported roles are `admin` and `manager`.
- Capability checks live in `server/utils/permissions.ts`.
- `admin` has full operational access, including billing close/unissue.
- `manager` has read/write operations for day-to-day work, but cannot close or unissue billing periods and does not have broad entity create/update/delete rights.

### Dashboard

- Route: `/`
- API: `GET /api/dashboard/summary`
- Data source: `server/repositories/dashboard/index.ts`
- Capability: `dashboard.read`

Implemented dashboard data:

- total buildings
- rooms by status
- active contracts
- contracts expiring within 30 days and 7 days
- tenant count
- current-month billing totals
- collection rate
- overdue amount
- per-building occupancy breakdown
- 12-month billing trend for the current calendar year
- revenue breakdown by rent, electricity, water, service, and other
- pending operations for missing readings, unissued invoices, and overdue invoices
- generated-at metadata for refresh/relative-time UI

Implemented dashboard UI:

- collection donut / half-donut
- room summary card
- contract summary card
- yearly revenue trend chart
- revenue category breakdown
- building filter for trend projection
- occupancy list by building
- pending operations list linking into the billing workspace
- loading, forbidden, and error states

### Buildings

Routes:

- `/buildings`
- `/buildings/create`
- `/buildings/[id]`
- `/buildings/[id]/edit`
- `/buildings/[id]/settings`
- `/buildings/[id]/meter-readings`
- `/buildings/[id]/rooms/[room]`

API:

- `GET/POST /api/buildings`
- `GET/PATCH/DELETE /api/buildings/[id]`
- `GET /api/buildings/[id]/rooms/[room]`

Implemented:

- building CRUD
- slug-based readable detail routes
- address/display metadata
- operational and pricing configuration
- room list integration
- building service settings
- building service matrix
- monthly meter-reading workspace
- building-scoped room detail route

### Rooms

Routes:

- `/rooms`
- `/rooms/create`
- `/rooms/[code]`
- `/rooms/[code]/edit`
- `/buildings/[id]/rooms/[room]`

API:

- `GET/POST /api/rooms`
- `GET/PATCH/DELETE /api/rooms/[id]`

Implemented:

- room CRUD
- readable room code/slug routes
- statuses: `available`, `occupied`, `maintenance`
- room cards and forms
- active contract/history display through room detail flows
- occupancy state controlled by contract lifecycle services, not UI-only changes

### Tenants

Routes:

- `/tenants`
- `/tenants/create`
- `/tenants/[code]`
- `/tenants/[code]/edit`

API:

- `GET/POST /api/tenants`
- `GET/PATCH/DELETE /api/tenants/[id]`

Implemented:

- tenant CRUD
- readable tenant codes
- enriched tenant profile fields:
  - gender
  - occupation
  - identity issue date/place
  - emergency contact name/phone
- current active contract and contract history surfaces

### Contracts And Occupancy

Routes:

- `/contracts`
- `/contracts/create`
- `/contracts/[code]`
- `/contracts/[code]/edit`

API:

- `GET/POST /api/contracts`
- `GET/PATCH/DELETE /api/contracts/[id]`
- `GET/POST /api/contracts/[id]/occupants`
- `PATCH/DELETE /api/contracts/[id]/occupants/[occupantId]`
- `GET/POST /api/contracts/[id]/payments`
- `PATCH/DELETE /api/contracts/[id]/payments/[paymentId]`
- `GET /api/contracts/[id]/renewals`
- `POST /api/contracts/[id]/renew`

Implemented:

- contract list/create/detail/edit
- readable contract codes
- room, building, and tenant relationship resolution
- commercial terms:
  - monthly rent
  - deposit
  - payment day
  - occupant count
  - discount
  - surcharge
- statuses: `active`, `expired`, `terminated`, with source code also treating non-terminated overlapping contracts as billable
- active contract creation marks a room occupied
- termination/expiry/delete releases the room unless it is under maintenance
- active-room and active-tenant conflict prevention
- occupant/roommate management
- contract lifecycle payments separate from invoice payments
- contract renewals
- per-contract services
- handover reading display
- `create_contract_with_handover` RPC creates the contract and electricity/water handover-in readings atomically
- create form prefill can use latest meter readings

### Services

API:

- `GET /api/service-catalog`
- `GET/POST /api/building-services`
- `PATCH /api/building-services/[id]`
- `GET /api/contract-services`
- `GET /api/contract-services/by-building`
- `PATCH /api/contract-services/[id]`
- `POST /api/contract-services/sync`

Implemented:

- seeded service catalog
- building-level service defaults
- contract-level cloned service rows
- service enable/disable
- amount, quantity, pricing type, notes
- sync missing building service defaults into active contracts without overwriting existing custom rows
- enabled contract services feed monthly billing charge lines

### Meter Readings

Routes:

- `/buildings/[id]/meter-readings`

API:

- `GET/POST /api/meter-readings`
- `PATCH /api/meter-readings/[id]`
- `GET /api/meter-readings/latest`
- `GET/POST /api/meter-readings/bulk`

Implemented:

- electricity and water readings
- reading types:
  - `monthly`
  - `handover_in`
  - `handover_out`
- reading key model by room, meter type, period year/month, and reading type
- latest reading lookup per room for contract handover prefill
- bulk monthly entry
- building-level room meter status
- billing draft fallback from previous monthly reading to handover-in when needed
- manual usage override path when meter readings are invalid or reset

### Monthly Billing

Routes:

- `/billing`
- `/billing/[building]/[period]`
- `/billing/invoices/[id]`
- `/billing/print/[building]/[period]`
- `/invoices`

Period API:

- `GET/POST /api/billing/periods`
- `GET /api/billing/periods/[id]`
- `GET /api/billing/periods/[id]/overview`
- `GET /api/billing/periods/[id]/drafts`
- `GET /api/billing/periods/[id]/draft-grid`
- `GET/POST /api/billing/periods/[id]/utility-usages`
- `POST /api/billing/periods/[id]/issue`
- `GET /api/billing/periods/[id]/invoices`
- `GET /api/billing/periods/[id]/audit`
- `GET /api/billing/periods/[id]/export`
- `POST /api/billing/periods/[id]/close`
- `POST /api/billing/periods/[id]/unissue`

Invoice API:

- `GET /api/invoices`
- `GET /api/billing/invoices/[id]`
- `GET/POST /api/billing/invoices/[id]/payments`
- `POST /api/billing/invoices/bulk-payments`
- `POST /api/billing/invoices/[id]/adjustment`
- `POST /api/billing/invoices/[id]/void`
- `POST /api/billing/invoices/[id]/reissue`

Implemented billing workspace:

- billing period queue with filters
- idempotent open-or-get period by building/month
- workspace overview
- sticky compact KPI strip
- draft grid tab
- issue tab
- payments/debt tab
- audit drawer
- Excel export
- close-period modal
- period unissue modal
- invoice detail page
- print route for selected billing rows
- mobile draft-row component
- bulk reading entry modal
- optimistic draft-grid helpers
- copy/paste helpers
- draft discrepancy callouts
- adjustment and void/reissue entry points from billing rows

Implemented cross-period invoice browse:

- sidebar entry "Hoá đơn" between contracts and billing
- `/invoices` page with building, year/month, all-months, status, and tenant search filters
- URL-synced filter state for share/refresh
- server-side pagination with default page size 50 and cap 100
- `GET /api/invoices` server route with auth, Zod validation, role scope, derived overdue status, deterministic sort, and metadata envelope
- manager scope from `app_metadata.assigned_building_ids` or legacy `building_ids`; managers without assignments receive an empty result set
- read-only invoice preview drawer using the standard app `UiDrawer` detail pattern
- mobile invoice cards plus desktop table rendering
- payment history cards in the mobile drawer and desktop payment table at `md`
- CTA to copy invoice code and deep-link into the billing period workspace without exposing mutate actions on `/invoices`
- deep-link handler switches the period workspace to payments and highlights the target invoice

Billing statuses:

- Period: `draft`, `readings`, `review`, `issued`, `collecting`, `closed`
- Invoice: `draft`, `issued`, `partial`, `paid`, `overdue`, `void`
- Charge types: `rent`, `electricity`, `water`, `service`, `discount`, `surcharge`, `adjustment`

Implemented billing rules:

- billable contracts overlap the period and are not `terminated`
- rent is prorated by billable days
- electricity supports `per_kwh` and `fixed`
- tiered electricity exists in config/types but is blocked as unsupported in v1
- water supports `per_m3`, `per_person`, and `fixed_per_room`
- per-person water can use counted occupants, falling back to contract occupant count
- current monthly reading is required for usage-based pricing
- previous monthly reading is used as baseline
- handover-in reading can be used as previous-reading fallback
- explicit utility usage override can unblock corrected consumption
- duplicate active invoices block issuing
- issuing recomputes drafts server-side
- issue flow skips blocked drafts and contracts that already have a non-void invoice
- issue flow writes invoices and invoice charges transactionally through `issue_period_invoices`
- payment recording updates paid, balance, and invoice status
- single payment has best-effort rollback if totals update fails
- bulk payments run transactionally through `record_bulk_payments`
- first payment can advance period from `issued` to `collecting`
- void is blocked once an invoice has paid amount
- reissue only works from a voided invoice and recomputes the latest draft
- reissued invoices are linked to the superseded invoice
- adjustment can be positive or negative
- negative adjustment cannot exceed paid amount according to service validation
- large/risky corrections require explicit reasons through reason guards
- close requires `billing.close`, period status `issued` or `collecting`, and no outstanding invoices
- unissue requires `billing.unissue`, reason length >= 10, and a non-closed period
- unissue voids unpaid invoices and retains paid invoices
- destructive billing flows append audit events

## Database Snapshot

The migration set covers these model groups:

- buildings
- rooms
- tenants
- legacy room assignments and their removal
- contracts and commercial terms
- contract occupants
- contract payments
- contract renewals
- service catalog
- building services
- contract services
- meter readings
- billing periods
- invoices
- invoice charges
- invoice payments
- billing utility usage overrides
- billing audit events
- readable slugs/codes for buildings, rooms, tenants, contracts, and documents
- transaction RPCs for invoice issue and bulk payments
- atomic contract creation with handover readings

Important database functions/RPCs:

- `slugify_text`
- `set_updated_at`
- `issue_period_invoices`
- `record_bulk_payments`
- `create_contract_with_handover`

RLS is enabled across exposed public tables in migrations as a safety net. Application writes still go through Nuxt server services and capability checks.

## Client Organization

Composables mirror product workflows:

- Auth: `useAuth`
- Dashboard: `useDashboardSummary`
- Buildings: list, detail, form, services, meter readings, contract services
- Rooms: list, detail, form
- Tenants: list, detail, form
- Contracts: list, detail, form, occupants, payments, renewals, services, handover readings
- Billing: period list, workspace, invoice actions, draft-grid autosave, filters, navigation
- Invoices: cross-period list, detail lazy-load, URL filter/pagination state
- Feedback: `useToast`
- Charts: `useChartTheme`

UI primitives live in `app/components/ui/**`:

- alert, badge, button, checkbox, combobox, confirm modal, drawer, empty state, input, list row, metric, modal, page header, section, select, skeleton, status badge, table, tabs, textarea, toast host, toggle, toolbar

Domain components live under:

- `app/components/dashboard/**`
- `app/components/buildings/**`
- `app/components/rooms/**`
- `app/components/tenants/**`
- `app/components/contracts/**`
- `app/components/billing/**`

## Operational Design System

The UI is intentionally a dense dark operations tool, not a marketing surface.

Implemented patterns include:

- compact page headers
- toolbar filters
- reusable dark primitives
- status badges mapped through constants
- metric strips
- table-driven operational lists
- drawers for reference/context surfaces
- modals for correction and destructive actions
- toast feedback
- bulk-select pattern for invoice payment collection
- mobile billing draft rows
- Chart.js dashboard visuals using the dark operational palette

## Tests And Verification Surface

Current tests cover:

- billing draft math and blockers
- billing core period/contract overlap helpers
- invoice status transitions
- period status transitions
- close/unissue permissions
- adjustment validation
- void/reissue flows
- single and bulk payment behavior
- billing audit summaries
- SQL/RLS assertions
- billing display enrichment
- billing consistency regressions
- dashboard envelope and permissions
- dashboard summary response shape
- dashboard chart/list components
- building and tenant repository behavior
- contract service and contract service-layer behavior
- contract validators
- meter-reading latest lookup
- route helper behavior for operational readable URLs
- slug/code/currency/relative-time utilities
- billing draft grid and bulk reading UI behavior
- contract form component behavior
- invoice browse service scope, URL sync/filter reset, responsive mobile list/drawer, and deep-link helper behavior
- invoice browse performance guard for 600 service-layer list items under 1s

Useful verification commands:

```bash
npm run typecheck
npm run lint
npm test
npm run test:coverage
openspec validate --strict
```

## OpenSpec Status

Active changes:

- `simplify-billing-period-workflow`, 0/38 tasks complete
- `contracts-overhaul`, 7/50 tasks complete

Most recently archived:

- `2026-06-28-add-invoices-browse-page`
- Status: archived after 43/43 tasks completed
- Verified with `npm run typecheck`, `npm run lint`, full `npm run test`, and `openspec validate add-invoices-browse-page --strict`
- QA notes:
  - manager assigned-building scope is covered by service tests, including `assigned_building_ids`, legacy `building_ids`, no-assignment empty result, forbidden out-of-scope building filter, and admin no-scope behavior
  - smoke coverage is automated for filter/search/page URL sync, drawer read-only behavior, deep-link helper output, mobile list cards, and mobile drawer payment cards
  - no Playwright/e2e dependency or seeded 3-building x 6-month database fixture exists in the repo; manual browser smoke should be rerun against staging seed data before production release
  - performance guard currently verifies service-layer processing of 600 invoice rows under 1s; DB-level `EXPLAIN` remains an environment check when staging data is available

Recent archived changes show completed work in these areas:

- cross-period invoice browse page
- dashboard visualization and polish
- dashboard contract and hardening
- billing transaction hardening
- billing consistency and action safety
- billing draft grid maintainability
- handover readings required on contract create
- entity slug/code routes
- bulk meter-reading entry
- billing power features
- monthly operations workspace
- operational design system
- billing readability and polish
- service definitions
- meter readings/model simplification
- contract-as-assignment model
- tenant enrichment
- contracts, payments, occupants, renewals
- buildings, rooms, tenants vertical slices
- auth/session/app shell/API server foundations

## Known Gaps / Not Yet Productized

- Tenant portal role and tenant self-service screens are not present.
- Email/notification flows are not wired into product actions.
- Resend, Turnstile, and GA runtime config exist but are not central to the authenticated operations app yet.
- Tiered electricity is recognized but blocked as unsupported in billing v1.
- CI pipeline is specified in OpenSpec, but no GitHub workflow file is present in the current file map.
- Billing header cleanup still needs manual smoke/spot-check before the active change should be archived.
- Active change docs and current source have small UI mismatches around KPI strip layout wording and the missing kebab icon in the action trigger.

## Bottom Line

The project already handles the complete internal rental-operations backbone:

```text
Buildings
  -> Rooms
  -> Tenants
  -> Contracts / occupants / renewals / deposits
  -> Services / meter readings / handover readings
  -> Monthly billing drafts
  -> Invoice issue
  -> Collection / bulk collection
  -> Corrections / void / reissue / adjustment
  -> Audit / export / print / close period
  -> Dashboard monitoring
```

The heaviest production logic is in billing and contract lifecycle management. The main remaining work is product expansion around tenant-facing flows, notifications, CI automation, final UI smoke for the active billing header change, and future billing pricing modes such as tiered electricity.
