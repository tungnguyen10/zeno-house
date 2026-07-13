# API Reference

All business APIs live under `server/api/**`. The generated, complete 131-route inventory and its pagination/cache/performance contract live in [`docs/api-inventory.md`](../api-inventory.md). Regenerate it with `node scripts/generate-api-inventory.mjs` whenever handlers change.

## API Shape

Handlers should:

1. Require auth for business data.
2. Validate query/body/params with Zod where input exists.
3. Call a service.
4. Return the standard envelope.

Shared helpers in `server/utils/` remove per-handler boilerplate (all auto-imported):

- `parseBody(event, schema, message?)` / `parseQuery(event, schema, message?)` validate and return typed data, throwing `VALIDATION_ERROR` with `error.flatten()` as `details` on failure.
- `paginated(items, { total, page, limit })` builds the `{ data, meta: { total, page, limit, totalPages } }` envelope.
- `throwForbidden` / `throwNotFound` / `throwValidationError` / `throwConflict(message, details?)` / `throwDbError(error, context)` raise standardized error envelopes.

```ts
type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> }
type ApiError = { error: { code: string; message: string; details?: unknown } }
```

Business flow:

```text
server/api/*
  -> server/services/*
  -> server/repositories/*
  -> Supabase
```

Initial SSR reads use `useFetch` so Nuxt payload hydration prevents a duplicate browser request. Imperative reads and mutations use the shared `apiFetch` wrapper, which supplies a 15-second timeout, an `x-request-id`, no automatic retry, explicit in-flight dedupe keys, and superseded-request cancellation through `createLatestApiRequest`.

Every API response includes `x-request-id` and `Server-Timing`. Slow GET requests above 500 ms and mutations above 1 second emit structured diagnostics containing route, status, duration, response bytes, and application database round trips.

## Internal AI Agent API Contract

The internal AI assistant uses the same server-mediated architecture as the rest of the product:

```text
chat UI
  -> /api/ai/chat
  -> internal tool gateway (whitelist + schema validation + policy)
  -> domain service
  -> repository
  -> Supabase
```

### Agent Runtime Boundaries

- The model may interpret intent and request tool calls.
- The model cannot query business tables directly.
- All tool execution is server-side and must enforce capability and building scope checks.
- Mutating tools require explicit confirmation and idempotency.

### Chat Envelope

`POST /api/ai/chat` follows the shared envelope and may stream partial assistant output.

- Success: `{ data: { message, toolCalls?, toolResults?, conversationId }, meta? }`
- Error: `{ error: { code, message, details? } }`

Streaming responses must preserve `x-request-id` for correlation with tool execution logs.

### Tool Call Lifecycle

1. Client sends user message and current conversation ID.
2. Server sends model messages plus allowed tool definitions.
3. Model returns either final text or tool call requests.
4. Tool gateway validates tool name, schema, confirmation policy, and capability/scope.
5. Server executes domain service.
6. Tool result is returned to the model for the next step or final answer.

### Agent-Specific Error Semantics

In addition to standard API codes, agent handlers should normalize these states using existing codes:

- validation failure in tool arguments: `VALIDATION_ERROR`
- permission or scope violation: `FORBIDDEN`
- stale conversation or optimistic lock conflict: `CONFLICT`
- unknown/unregistered tool request: `VALIDATION_ERROR`
- missing authenticated session: `UNAUTHENTICATED`

## Dashboard

| Method | Path |
| --- | --- |
| GET | `/api/dashboard/summary` |

## Buildings

| Method | Path |
| --- | --- |
| GET | `/api/buildings` |
| POST | `/api/buildings` |
| GET | `/api/buildings/[id]` |
| PATCH | `/api/buildings/[id]` |
| DELETE | `/api/buildings/[id]` |
| POST | `/api/buildings/bulk` |
| GET | `/api/buildings/[id]/rooms/[room]` |

## Rooms

| Method | Path |
| --- | --- |
| GET | `/api/rooms` |
| POST | `/api/rooms` |
| GET | `/api/rooms/[id]` |
| PATCH | `/api/rooms/[id]` |
| DELETE | `/api/rooms/[id]` |
| POST | `/api/rooms/bulk` |

## Tenants

| Method | Path |
| --- | --- |
| GET | `/api/tenants` |
| POST | `/api/tenants` |
| GET | `/api/tenants/[id]` |
| PATCH | `/api/tenants/[id]` |
| DELETE | `/api/tenants/[id]` |
| POST | `/api/tenants/bulk` |

## Contracts

| Method | Path |
| --- | --- |
| GET | `/api/contracts` |
| POST | `/api/contracts` |
| GET | `/api/contracts/[id]` |
| PATCH | `/api/contracts/[id]` |
| DELETE | `/api/contracts/[id]` |
| POST | `/api/contracts/bulk` |
| GET | `/api/contracts/[id]/occupants` |
| POST | `/api/contracts/[id]/occupants` |
| GET | `/api/contracts/[id]/payments` |
| POST | `/api/contracts/[id]/payments` |
| GET | `/api/contracts/[id]/renewals` |
| POST | `/api/contracts/[id]/renew` |

## Service Catalog And Services

| Method | Path |
| --- | --- |
| GET | `/api/service-catalog` |
| POST | `/api/service-catalog` |
| GET | `/api/building-services` |
| POST | `/api/building-services` |
| PATCH | `/api/building-services/[id]` |
| DELETE | `/api/building-services/[id]` |
| GET | `/api/contract-services` |
| GET | `/api/contract-services/by-building` |
| PATCH | `/api/contract-services/[id]` |
| DELETE | `/api/contract-services/[id]` |
| POST | `/api/contract-services/sync` |

## Meter Readings

| Method | Path |
| --- | --- |
| GET | `/api/meter-readings` |
| POST | `/api/meter-readings` |
| PATCH | `/api/meter-readings/[id]` |
| GET | `/api/meter-readings/bulk` |
| POST | `/api/meter-readings/bulk` |
| GET | `/api/meter-readings/latest` |

## Billing And Invoices

| Method | Path |
| --- | --- |
| GET | `/api/billing/periods` |
| POST | `/api/billing/periods` |
| GET | `/api/billing/invoices/[id]` |
| POST | `/api/billing/invoices/bulk-payments` |
| GET | `/api/invoices` |

Billing behavior is split across services under `server/services/billing/**`. Some period, invoice, payment, audit, issue, close, and correction operations are implemented as service/RPC paths rather than one route per action. Check source before adding or documenting a route.

## Manager Assignments And Audit

| Method | Path |
| --- | --- |
| GET | `/api/assignments` |
| POST | `/api/assignments` |
| PATCH | `/api/assignments/[id]` |
| DELETE | `/api/assignments/[id]` |
| GET | `/api/assignments/by-building/[id]` |
| GET | `/api/assignments/buildings-without-manager` |
| GET | `/api/audit` |

## Error Rules

Use standardized error codes where possible:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`
- `INTERNAL`

Server services should raise domain-specific conflicts rather than letting database errors leak to the UI. Repositories wrap Supabase failures with `throwDbError(error, context)`, which logs the original error server-side and returns a generic `INTERNAL` envelope — raw DB messages are never sent to the client. Client code reads error fields through `~/utils/api-error` (`getApiErrorMessage` / `getApiErrorCode` / `getApiErrorDetails`), which only trust the `data.error` envelope and fall back to a caller-provided message rather than leaking raw `FetchError` text.

## Operations Report

| Method | Path |
| --- | --- |
| GET | `/api/operations-report` |
| POST | `/api/operations-report/close` |
| POST | `/api/operations-report/reopen` |
| GET | `/api/operations-report/export` |
| GET | `/api/building-expenses` |
| POST | `/api/building-expenses` |
| PATCH | `/api/building-expenses/[id]` |
| DELETE | `/api/building-expenses/[id]` |
| POST | `/api/building-expenses/[id]/receipt` |
| DELETE | `/api/building-expenses/[id]/receipt` |
| GET | `/api/building-fixed-costs` |
| POST | `/api/building-fixed-costs` |
| PATCH | `/api/building-fixed-costs/[id]` |
| GET | `/api/recurring-expenses` |
| POST | `/api/recurring-expenses` |
| PATCH | `/api/recurring-expenses/[id]` |
| DELETE | `/api/recurring-expenses/[id]` |
| POST | `/api/recurring-expenses/[id]/record` |
| POST | `/api/recurring-expenses/[id]/dismiss` |
| GET | `/api/prepaid-expenses` |
| POST | `/api/prepaid-expenses` |
| PATCH | `/api/prepaid-expenses/[id]` |
| DELETE | `/api/prepaid-expenses/[id]` |
| GET | `/api/reserve-funds/[buildingId]` |
| POST | `/api/reserve-funds/[buildingId]/refresh-accrual` |
| GET | `/api/reserve-fund-rates` |
| POST | `/api/reserve-fund-rates` |
| PATCH | `/api/reserve-fund-rates/[id]` |
| GET | `/api/shared-expenses` |
| POST | `/api/shared-expenses` |
| PATCH | `/api/shared-expenses/[id]` |
| DELETE | `/api/shared-expenses/[id]` |
| POST | `/api/shared-expenses/[id]/allocate` |
| POST | `/api/internal/operations-report/auto-close` |

Operations report export requires `operations-report.export`; report close/reopen and reserve accrual refresh are admin-only. Close accepts `building_id`, `period_year`, and `period_month`; reopen also requires `reason`; reserve accrual refresh accepts only the target period and never accepts an amount. Expense receipt routes accept a private image attachment and return the expense DTO with a short-lived signed receipt URL when present. Recurring expense `record` advances the reminder and returns a prefill payload for the normal building expense form; the actual expense is still created through `/api/building-expenses`. Prepaid expenses are owner/admin configuration records and contribute monthly allocation to `/api/operations-report`.
One-off building expenses and fixed costs keep using their existing `note` fields for user-entered display labels; recurring expenses, prepaid expenses, and shared expenses use their existing `name` fields. Reserve fund routes are owner/admin for read/manage, derive balance from active transactions, and reserve rates are managed through building settings. Shared-expense routes are owner/admin only; allocation materializes normal `building_expenses` rows for the selected period. The internal auto-close route requires `NUXT_OPERATIONS_REPORT_AUTO_CLOSE_SECRET` and is intended for Nitro/platform cron, not browser use.
