## Why

With the tenant role, linkage, and self-scope resolver in place, tenants need read/update access to their own data through a dedicated, self-scoped API. This change delivers the functional core of the portal — profile view/update, active contract summary, and invoice list/detail — under `/api/tenant/**`, reusing internal mapping/shaping logic without exposing any internal broad-query endpoint. This is the minimum backend for a soft go-live.

## What Changes

- Add a `/api/tenant/**` namespace with self-scoped endpoints:
  - `GET /api/tenant/me` — the caller's tenant profile (safe fields only).
  - `PATCH /api/tenant/me` — update a strict whitelist of contact fields (phone, email, emergency contact name/phone, notes). Never status, code, id_number policy fields, or links.
  - `GET /api/tenant/contract` — the caller's active contract summary (room, building, dates, rent, deposit, status).
  - `GET /api/tenant/invoices` — the caller's invoices with derived overdue status and pagination.
  - `GET /api/tenant/invoices/[id]` — one invoice detail with charge lines, only if it belongs to the caller.
- Every handler resolves `tenant_id` via `resolveTenantId` and ignores any client-supplied tenant identifier.
- New service + repository under `server/services/tenant-portal/**` and `server/repositories/tenant-portal/**`, reusing invoice shaping from `server/repositories/invoices.ts` and the derived-status logic from `server/services/billing/invoice-query.ts`.
- New DTOs, mappers, and Zod validators dedicated to the tenant portal.
- Responses use the standard `{ data, meta? }` / `{ error }` envelope.

## Capabilities

### New Capabilities
- `tenant-portal-api`: Defines the tenant self-service API contract (profile read/update whitelist, active contract summary, invoice list/detail), the self-scope enforcement rules, and the error/not-found consistency guarantees.

## Impact

- `server/api/tenant/me.get.ts`, `server/api/tenant/me.patch.ts`, `server/api/tenant/contract.get.ts`, `server/api/tenant/invoices/index.get.ts`, `server/api/tenant/invoices/[id].get.ts` — new routes.
- `server/services/tenant-portal/**` — profile, contract, invoice services with capability + self-scope checks.
- `server/repositories/tenant-portal/**` — self-scoped queries; reuse invoice list shaping.
- `app/types/tenant-portal.ts`, `app/utils/mappers/tenant-portal.ts`, `app/utils/validators/tenant-portal.ts` — DTOs/mappers/validators.
- Tests for self-scope enforcement, profile whitelist, invoice ownership, and edge cases (terminated contract, voided invoice, cross-tenant id attempts).
