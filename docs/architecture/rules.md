# Architecture Rules - Zeno House

## 1. State Rules

- State is split into **server state**, **global client state**, and **local component state**.
- Server state such as buildings, rooms, tenants, contracts, periods, invoices, and dashboard summaries lives in composables using `useFetch` or `$fetch`.
- Pinia is reserved for truly global state, currently auth/session and role-derived helpers.
- Form state belongs in the component or in a form-specific composable, not in a global store.
- Each domain should keep composables purpose-specific: `list`, `detail`, `form`, or a named workflow such as `useBillingPeriodWorkspace`.
- Do not duplicate derived state. Prefer `computed`.
- Stores should not directly control business modals or toast flows.

## 2. API Rules

- The client must not call Supabase directly for business data. Use `server/api/**`.
- Every mutating endpoint and every endpoint with query/body input validates through Zod schemas in `app/utils/validators/**`.
- Responses use the standard envelope:

  ```ts
  type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
  type ApiError = { error: { code: string; message: string; details?: unknown } }
  ```

- Repositories only query and persist. They do not contain business rules.
- Services own business rules, permissions, orchestration, and audit side effects.
- List endpoints for primary resources should support filtering and pagination when the UI needs it.
- Do not return raw DB rows. Map through `app/utils/mappers/**`.
- Standard error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`.
- Entities that expose a slug `code` (`buildings`, `rooms`, `tenants`, `contracts.contract_code`, `billing_invoices.invoice_code`) must accept BOTH UUID and code at every public boundary. Frontend routes pass slugs in URLs and query filters.
  - Resolve via `*Repository.findByIdentifier(event, value)` (built on `isUuid()`), then use `existing.id` (UUID) for all downstream repository calls — never pass the raw input through to `.eq('<uuid_column>', value)`.
  - This applies to route params (`[id]`), query filters (`building_id`, `room_id`, `tenant_id`, `contract_id`), and request bodies. Lookups by UUID-only (`findById`) are reserved for identifiers that originated from an API response, not user input.
  - Entities without a slug (`billing_periods`, `meter_readings`, `contract_payments/occupants/renewals/services`, `building_services`) accept UUID only.

## 3. Component Rules

- Components are split into `ui/` primitives, domain display/workflow components, and `app/` shell components.
- Components are presentational by default. Fetch data in pages or composables.
- Props must be typed clearly. Avoid passing large unmapped DB-shaped objects.
- Emits should describe intent, for example `submit`, `remove`, `refresh`, `intent:adjustment`.
- Important components must handle `loading`, `empty`, and `error` states.
- Accessibility is default: labels for inputs, `aria-label` for icon-only buttons, and visible focus styles.

## 4. Permission Rules

- Permission has three layers: route-level, action-level, and data-level.
- Route-level protection lives in Nuxt middleware.
- Action-level checks use role/capability helpers and should only hide or disable UI.
- Data-level enforcement is repeated on the server and backed by Supabase RLS policies.
- Do not scatter role string checks through components. Prefer constants and capability checks.
- Security lives on the server. UI checks are not sufficient.

### Billing Capabilities

| Capability | Roles | Notes |
| --- | --- | --- |
| `billing.read` | admin, manager | Read periods, drafts, invoices, payments, audit, and export Excel. |
| `billing.write` | admin, manager | Save readings/overrides, issue invoices, record payments, bulk payments, adjustments, void/reissue. |
| `billing.close` | admin | Close a period when status is `issued` or `collecting` and no invoice has an outstanding balance. |
| `billing.unissue` | admin | Unissue a non-closed period. Requires a reason of at least 10 characters, voids unpaid invoices, retains paid invoices, and records `period.unissued`. |

## 5. Styling Rules

- Use Tailwind utility classes.
- Use `clsx` for conditional or dynamic class composition.
- Avoid inline `style=""`.
- Custom CSS belongs in `app/assets/scss/main.scss` only when Tailwind cannot express the rule cleanly.
- Follow `docs/ui-patterns/design-system.md` for dark operational UI patterns.

## 6. Incremental Principle

- Create files and folders only when a real feature needs them.
- Do not add abstractions for one call site.
- Promote a shared pattern when it appears for the second time and the shape is stable.
- Each step should leave the app runnable.

## 7. Billing Invariants

- An issued invoice snapshot is immutable except through supported correction flows.
- Corrections use one of three paths: `void + reissue`, `adjustment`, or period-level `unissue`.
- `void + reissue` is only for unpaid invoices in non-closed periods.
- `adjustment` is used once collection has started or when replacing the invoice is not appropriate.
- Period close is admin-only and requires no outstanding invoices.
- Period unissue is admin-only, unavailable after close, and requires an explicit reason.
- Every destructive billing action writes audit metadata that can be rendered into Vietnamese summaries.

## 8. Test Rules

- Vitest is the default unit/component test runner.
- Billing service coverage is scoped first to `server/services/billing/**`.
- Use deterministic builders in `tests/__fixtures__/billing/`; avoid random data in baseline rule tests.
- Mock repositories and Supabase at service boundaries. Prefer pure rule helpers when validating billing math or status policy.

## 9. Internal AI Agent Rules

- Agent and LLM runtime must not access the database directly.
- Agent actions must route through whitelisted internal tools exposed by `server/api/**` and service orchestrators.
- Prompt text is untrusted input and cannot bypass server-side capability checks, scope checks, or status transitions.
- Mutating workflows must use a two-step mutation plan: preview/plan first, explicit confirm second.
- Every mutating tool requires an explicit confirmation signal and a server-generated idempotency key.
- Mutating tools that update existing records must enforce optimistic locking with a version token (for example `updated_at` or explicit `version`) and return `CONFLICT` on mismatch.
- Mutating tool execution and audit persistence must be transactional: either both commit or both roll back.
- Every mutating tool call must write audit metadata with actor, target entity, and before/after or operation summary.
- Conversation state for multi-step agent workflows must persist server-side per user/session and include staleness tracking for draft data.
- Tool gateway policy is deny-by-default: tools not explicitly registered are unavailable to the agent.
- Tool execution loops must be bounded per request and per conversation turn to prevent runaway tool-calling.
- The internal agent surface does not provide web search, URL browsing, or external side-effect tools.
