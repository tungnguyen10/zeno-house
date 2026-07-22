# Frontend Architecture

Zeno House uses Nuxt file-based routing, auto-imported composables, auto-imported components, Pinia for auth state, and Tailwind for styling.

## Page Layer

Pages live in `app/pages/**`.

Primary route groups:

- `/`: role-based landing
- `/login`, `/register`, `/forgot-password`: guest auth screens
- `/auth/callback`, `/auth/reset-password`, `/auth/pending`: OAuth, recovery, and pending lifecycle
- `/dashboard/**`: internal admin/owner/manager operations
- `/portal/**`: tenant experience

Pages should orchestrate data loading and route-level workflow. They should not contain repository logic or direct Supabase business queries.

## Composable Layer

Composables live in `app/composables/**` and mirror product workflows.

| Area | Composables |
| --- | --- |
| Auth | `auth/useAuth`, `useAuthStore`, `useAccessRequests` |
| Dashboard | `useDashboardSummary` |
| Buildings | `useBuildingList`, `useBuildingDetail`, `useBuildingForm`, `useBuildingServices`, `useBuildingMeterReadings`, `useBuildingContractServices` |
| Rooms | `useRoomList`, `useRoomDetail`, `useRoomForm` |
| Tenants | `useTenantList`, `useTenantDetail`, `useTenantForm` |
| Contracts | `useContractList`, `useContractDetail`, `useContractForm`, `useContractOccupants`, `useContractPayments`, `useContractRenewals`, `useContractServices`, `useContractHandoverReadings` |
| Billing | `useBillingPeriodList`, `useBillingPeriodWorkspace`, `useBillingInvoiceActions`, `invoices/useInvoiceList`, `invoices/useInvoiceDetail` |
| Shared period filters | `usePeriodOptions` |
| Feedback | `useToast` |

Server state belongs here, usually via `useFetch` or `$fetch`. Form state can live in a form composable when it is reused by create/edit screens.

Portal home, building settings, and billing workspace use keyed bootstrap composables for their initial SSR data. Components sharing the same workspace consume that payload instead of starting parallel endpoint waterfalls; mutations continue through their domain APIs and refresh the bootstrap payload when necessary.

## Component Layer

Component groups:

- `app/components/ui/**`: primitives such as buttons, tables, modals, drawer, tabs, form controls, metrics, alerts.
- `app/components/app/**`: shell components such as sidebar, header, dashboard stat card.
- `app/components/<domain>/**`: domain-specific forms and workflow blocks.

Rules:

- Keep primitives reusable and domain-agnostic.
- Keep domain components mostly presentational.
- Emit named intents such as `refresh`, `submit`, `intent:adjustment`; avoid generic `click` for business events.
- Handle loading, empty, and error states for user-facing data regions.

## Routing Helpers

Operational URL helpers live in `app/utils/routes/operational.ts`.

Use these helpers instead of manually concatenating links for:

- building routes
- building settings routes
- building-scoped room routes
- billing workspace routes
- billing workspace invoice deep-links
- contract routes
- invoice routes
- tenant routes

Current route identifiers prefer readable values where available:

- building `slug`
- room `slug` or slugified `roomNumber`
- contract `slug`, `contractCode`, or `code`
- invoice `invoiceCode` or `code`

## DTOs, Mappers, Validators

- DTO types live in `app/types/**`.
- DB-to-DTO mappers live in `app/utils/mappers/**`.
- Zod validators live in `app/utils/validators/**`.

Do not return raw DB row shapes to the UI. If a new server field is needed by the UI, add it to the relevant type and mapper.

## Auth Composition

All auth pages use `layouts/auth.vue`. Desktop renders a brand/operational-illustration panel beside
the form; mobile reduces the illustration to a compact top band. The layout and forms reuse the
existing dark/cyan/Inter tokens and `UiInput`, `UiButton`, `UiAlert`, and related primitives.
`AuthPasswordField` composes `UiInput` with an accessible suffix toggle; it does not introduce a
new input primitive. Auth business calls remain in `auth/useAuth`, while the pending queue uses
the authenticated self-status API rather than browser-side table access.

## Styling

The app is a dense operational tool, not a marketing site.

- Use Tailwind utilities.
- Use design-system tokens from `tailwind.config.ts`.
- Use `docs/ui-patterns/design-system.md` for component and layout rules.
- Avoid inline styles unless there is no practical Tailwind or component alternative.

### UI Polish Workflow

Every user-visible UI change follows `.agents/skills/zeno-house/references/ui-polish-workflow.md` and ships polished in its first implementation pass.

- Use `frontend-design` for hierarchy, composition, density, interaction emphasis, and copy judgment.
- Use Hallmark for anti-slop critique, affected states, responsiveness, restraint, and final polish.
- Keep existing Zeno House tokens, Inter typography, operational density, primitives, status mappings, and icon conventions authoritative over generic skill defaults.
- Match exploration depth to the change: focused affected-state polish for narrow edits; full direction and visual verification for new surfaces or redesigns.
- Surface material optimizations for a user decision with the problem, recommendation, affected surfaces, benefit, cost, and fallback.

## UI Primitive Contracts

- Use `UiInput`, `UiTextarea`, `UiSelect`, `UiCombobox`, and `UiCheckbox` for form controls instead of hand-written control classes.
- Every `UiInput type="number"` in domain/page code must declare `numberMode` so keyboard, step, and constraints match the value intent.
- Use `UiDatePicker` for domain/page date fields; keep values as ISO `YYYY-MM-DD` strings and declare `dateMode` for payment, reading, period, past, future, or operational dates.
- Keep formatted numeric display fields as `type="text"` with explicit `inputmode` when the component formats while typing.
- Use `error`/`hint` props for field helper text so primitives can wire `data-invalid`, `aria-invalid`, and `aria-describedby` consistently.
