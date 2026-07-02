# API Reference

All business APIs live under `server/api/**`. This document is an inventory of checked-in route handlers, not a requirements spec. For behavior details, read the relevant service and OpenSpec capability.

## API Shape

Handlers should:

1. Require auth for business data.
2. Validate query/body/params with Zod where input exists.
3. Call a service.
4. Return the standard envelope.

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

Server services should raise domain-specific conflicts rather than letting database errors leak to the UI.
