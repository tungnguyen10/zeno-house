# API Reference

All business APIs live under `server/api/**`. The generated route inventory and its pagination/cache/performance contract live in [`docs/api-inventory.md`](../api-inventory.md). Regenerate it with `node scripts/generate-api-inventory.mjs` whenever handlers change.

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

High-fan-out workspaces use authenticated bootstrap endpoints: `/api/tenant/bootstrap`, `/api/buildings/[id]/settings-bootstrap`, and `/api/billing/workspace/bootstrap`. Their clients use stable Nuxt data keys so one SSR response is reused during hydration. The billing bootstrap is an idempotent POST because opening a missing period is part of the existing workspace contract.

Every API response includes `x-request-id` and `Server-Timing`. Timing is split across auth, namespace, database, Storage, and other Supabase calls. Slow GET requests above 500 ms and mutations above 1 second emit structured diagnostics containing route, status, duration, response bytes, round trips, Vercel region, and cold-start state.

## Internal AI Agent API Contract

The AI routes follow the same authenticated API → service → repository boundary. The chat response is typed SSE rather than the standard JSON success envelope. Conversation/action endpoints use `{ data, meta? }`.

The current runtime exposes scoped context, meter status, billing overview/draft reads, and planning tools for period opening, meter import/correction, and utility overrides. Direct-confirmed executors are registered only for those implemented mutations. Server-owned action plans, deterministic stored-message parsing, atomic domain/audit RPCs, optimistic versions, structured errors, retention, streaming, and telemetry contracts are documented in [`docs/architecture/ai-agent.md`](./ai-agent.md).

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
| GET | `/api/buildings/[id]/invoice-profile` |
| PUT | `/api/buildings/[id]/invoice-profile` |

Invoice-profile updates use `multipart/form-data`. The initial save requires complete bank fields and `qr_image`; later saves preserve omitted images and accept `remove_logo=true`. Images are JPEG, PNG, or WebP up to 5 MB. Responses contain short-lived signed URLs and never private Storage paths.

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

## Tenant Portal

Tenant portal handlers resolve the authenticated user's active `tenant_user_links` row and never
accept a tenant id from the client. Document uploads use multipart field `document`, accept JPEG,
PNG, WebP, or PDF files up to 5 MB, and return five-minute signed URLs from a private bucket.
Identity-image routes use the existing `tenant-id-images` front/back slots shared with admin and
owner workflows. Tenant uploads use multipart field `image`, accept JPEG/PNG/WebP up to 5 MB, and
replace the same `id_card_front_path` or `id_card_back_path` value rather than creating actor-specific copies.
Support requests accept JSON title/description when no file is present, or multipart fields `title`,
`description`, and optional `attachment`. Attachments reuse the private `tenant-documents` bucket;
the server derives tenant/building/contract context and returns five-minute signed URLs.

| Method | Path |
| --- | --- |
| GET | `/api/tenant/documents` |
| POST | `/api/tenant/documents` |
| DELETE | `/api/tenant/documents/[id]` |
| GET | `/api/tenant/id-images` |
| POST | `/api/tenant/id-images/[side]` |
| DELETE | `/api/tenant/id-images/[side]` |
| GET | `/api/tenant/requests` |
| POST | `/api/tenant/requests` |

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
| POST | `/api/billing/invoices/print-data` |
| POST | `/api/billing/invoices/printed` |
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
