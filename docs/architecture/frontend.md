# Frontend Architecture

Zeno House uses Nuxt file-based routing, auto-imported composables, auto-imported components, Pinia for auth state, and Tailwind for styling.

## Page Layer

Pages live in `app/pages/**`.

Primary route groups:

- `/`: dashboard
- `/login`: auth screen
- `/buildings/**`: buildings, settings, meter readings, building-scoped room detail
- `/rooms/**`: room list/create/detail/edit
- `/tenants/**`: tenant list/create/detail/edit
- `/contracts/**`: contract list/create/detail/edit
- `/invoices`: cross-period invoice browse and read-only preview
- `/billing/**`: period list, period workspace, invoice detail
- `/ui-showcase`: design-system showcase

Pages should orchestrate data loading and route-level workflow. They should not contain repository logic or direct Supabase business queries.

## Composable Layer

Composables live in `app/composables/**` and mirror product workflows.

| Area | Composables |
| --- | --- |
| Auth | `auth/useAuth`, `useAuthStore` |
| Dashboard | `useDashboardSummary` |
| Buildings | `useBuildingList`, `useBuildingDetail`, `useBuildingForm`, `useBuildingServices`, `useBuildingMeterReadings`, `useBuildingContractServices` |
| Rooms | `useRoomList`, `useRoomDetail`, `useRoomForm` |
| Tenants | `useTenantList`, `useTenantDetail`, `useTenantForm` |
| Contracts | `useContractList`, `useContractDetail`, `useContractForm`, `useContractOccupants`, `useContractPayments`, `useContractRenewals`, `useContractServices`, `useContractHandoverReadings` |
| Billing | `useBillingPeriodList`, `useBillingPeriodWorkspace`, `useBillingInvoiceActions`, `invoices/useInvoiceList`, `invoices/useInvoiceDetail` |
| Shared period filters | `usePeriodOptions` |
| Feedback | `useToast` |

Server state belongs here, usually via `useFetch` or `$fetch`. Form state can live in a form composable when it is reused by create/edit screens.

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

## Styling

The app is a dense operational tool, not a marketing site.

- Use Tailwind utilities.
- Use design-system tokens from `tailwind.config.ts`.
- Use `docs/ui-patterns/design-system.md` for component and layout rules.
- Avoid inline styles unless there is no practical Tailwind or component alternative.

## UI Primitive Contracts

- Use `UiInput`, `UiTextarea`, `UiSelect`, `UiCombobox`, and `UiCheckbox` for form controls instead of hand-written control classes.
- Every `UiInput type="number"` in domain/page code must declare `numberMode` so keyboard, step, and constraints match the value intent.
- Keep formatted numeric display fields as `type="text"` with explicit `inputmode` when the component formats while typing.
- Use `error`/`hint` props for field helper text so primitives can wire `data-invalid`, `aria-invalid`, and `aria-describedby` consistently.
