# API Reference

All business APIs live under `server/api/**`.

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

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard/summary` | Operational dashboard summary. |

## Buildings

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/buildings` | List buildings. |
| POST | `/api/buildings` | Create building. |
| GET | `/api/buildings/[id]` | Get building detail by id/identifier. |
| PATCH | `/api/buildings/[id]` | Update building. |
| DELETE | `/api/buildings/[id]` | Delete building. |
| GET | `/api/buildings/[id]/rooms/[room]` | Get building-scoped room detail. |

## Rooms

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/rooms` | List rooms. |
| POST | `/api/rooms` | Create room. |
| GET | `/api/rooms/[id]` | Get room detail. |
| PATCH | `/api/rooms/[id]` | Update room. |
| DELETE | `/api/rooms/[id]` | Delete room. |

## Tenants

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/tenants` | List tenants. |
| POST | `/api/tenants` | Create tenant. |
| GET | `/api/tenants/[id]` | Get tenant detail. |
| PATCH | `/api/tenants/[id]` | Update tenant. |
| DELETE | `/api/tenants/[id]` | Delete tenant. |

## Contracts

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/contracts` | List contracts. |
| POST | `/api/contracts` | Create contract. |
| GET | `/api/contracts/[id]` | Get contract detail. |
| PATCH | `/api/contracts/[id]` | Update contract. |
| DELETE | `/api/contracts/[id]` | Delete contract. |
| GET | `/api/contracts/[id]/occupants` | List contract occupants. |
| POST | `/api/contracts/[id]/occupants` | Add occupant. |
| PATCH | `/api/contracts/[id]/occupants/[occupantId]` | Update or move out occupant. |
| DELETE | `/api/contracts/[id]/occupants/[occupantId]` | Delete occupant. |
| GET | `/api/contracts/[id]/payments` | List contract payments. |
| POST | `/api/contracts/[id]/payments` | Add contract payment. |
| PATCH | `/api/contracts/[id]/payments/[paymentId]` | Update contract payment. |
| DELETE | `/api/contracts/[id]/payments/[paymentId]` | Delete contract payment. |
| GET | `/api/contracts/[id]/renewals` | List renewals. |
| POST | `/api/contracts/[id]/renew` | Renew contract. |

## Services

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/service-catalog` | List service catalog items. |
| GET | `/api/building-services` | List building service settings. |
| POST | `/api/building-services` | Upsert building service settings. |
| PATCH | `/api/building-services/[id]` | Update building service setting. |
| GET | `/api/contract-services` | List contract services. |
| GET | `/api/contract-services/by-building` | List contract services by building context. |
| PATCH | `/api/contract-services/[id]` | Update contract service. |
| POST | `/api/contract-services/sync` | Sync missing building services into active contracts. |

## Meter Readings

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/meter-readings` | List meter readings. |
| POST | `/api/meter-readings` | Create meter reading. |
| PATCH | `/api/meter-readings/[id]` | Update meter reading. |
| GET | `/api/meter-readings/bulk` | Get bulk meter-reading data. |
| POST | `/api/meter-readings/bulk` | Bulk upsert readings. |

## Billing Periods

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/billing/periods` | List billing periods with queue metrics. |
| POST | `/api/billing/periods` | Open or get a building/month period. |
| GET | `/api/billing/periods/[id]` | Get period detail. |
| GET | `/api/billing/periods/[id]/overview` | Get workspace KPI overview and audit preview. |
| GET | `/api/billing/periods/[id]/drafts` | Calculate draft invoices. |
| GET | `/api/billing/periods/[id]/draft-grid` | Get room-centered draft grid. |
| GET | `/api/billing/periods/[id]/utility-usages` | List utility usage overrides. |
| POST | `/api/billing/periods/[id]/utility-usages` | Save utility usage override. |
| POST | `/api/billing/periods/[id]/issue` | Issue eligible invoices. |
| GET | `/api/billing/periods/[id]/invoices` | List invoices in period. |
| GET | `/api/billing/periods/[id]/audit` | List audit events. |
| GET | `/api/billing/periods/[id]/export` | Export period workbook. |
| POST | `/api/billing/periods/[id]/close` | Close period. |
| POST | `/api/billing/periods/[id]/unissue` | Unissue period. |

## Billing Invoices

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/billing/invoices/[id]` | Get invoice with charges and payments. |
| GET | `/api/billing/invoices/[id]/payments` | List invoice payments. |
| POST | `/api/billing/invoices/[id]/payments` | Record invoice payment. |
| POST | `/api/billing/invoices/bulk-payments` | Record multiple payments in one operation. |
| POST | `/api/billing/invoices/[id]/adjustment` | Add adjustment charge. |
| POST | `/api/billing/invoices/[id]/void` | Void unpaid invoice with reason. |
| POST | `/api/billing/invoices/[id]/reissue` | Reissue a voided invoice from fresh draft data. |

## Error Rules

Use standardized error codes where possible:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `CONFLICT`

Server services should raise domain-specific conflicts rather than letting database errors leak to the UI.
