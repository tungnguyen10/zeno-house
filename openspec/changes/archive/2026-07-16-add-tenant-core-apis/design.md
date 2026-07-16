## Context

`add-tenant-identity-foundation` provides the `tenant` role, `TENANT_CAPABILITIES`, `tenant_user_links`, `resolveTenantId(event, user)`, and an active API namespace guard. Internal invoice reads already exist: `server/repositories/invoices.ts` shapes cross-period invoice list rows and `server/services/billing/invoice-query.ts` derives overdue status. The `tenants` and `contracts` services/repositories hold the profile and contract data.

This change adds the tenant-facing read/update surface, strictly self-scoped, without reusing internal broad-query endpoints (which are building-scoped and capability-gated for internal roles).

## Goals / Non-Goals

**Goals:**
- Provide profile read + whitelist update, active contract summary, and invoice list/detail for the logged-in tenant only.
- Enforce self-scope in every handler via `resolveTenantId`.
- Reuse internal shaping/derived-status logic without exposing internal endpoints.
- Return consistent not-found for rows outside the caller's scope (no existence leak).

**Non-Goals:**
- Document upload (next change) and support requests (separate change).
- Tenant UI/PWA.
- Any write to invoices/contracts (tenant is read-only there).
- Payment operations.

## Decisions

### D1 — Self-scope is mandatory and server-derived

Every `/api/tenant/**` handler calls `resolveTenantId(event, user)` and uses that id for all queries. Client-supplied `tenant_id` (body/query/path) is ignored. Capability is rechecked in the service (`tenant.profile.*`, `tenant.contract.read`, `tenant.invoices.read`) even though the namespace guard already blocks internal roles.

### D2 — Profile update whitelist

`PATCH /api/tenant/me` accepts only: `phone`, `email`, `emergency_contact_name`, `emergency_contact_phone`, `notes`. It SHALL reject or ignore any other field, including `status`, `code`, `id_number`, `full_name` policy fields, and any linkage field. Validation is a dedicated Zod schema in `app/utils/validators/tenant-portal.ts`; the same schema is shared client-side later.

### D3 — Invoice reads reuse internal shaping, tenant-filtered

The invoice list/detail reuse the row shaping in `server/repositories/invoices.ts` and the derived overdue logic in `server/services/billing/invoice-query.ts`, but always add a hard filter `invoices.tenant_id = resolvedTenantId`. Detail returns charge lines only when the invoice belongs to the caller; otherwise a consistent not-found (no existence leak between tenants).

### D4 — Active contract summary is read-only and minimal

`GET /api/tenant/contract` returns the caller's currently active contract summary (room number, building name, start/end dates, monthly rent, deposit, status). Terminated/expired contracts are excluded from "active"; the endpoint returns an empty/absent result rather than another tenant's data.

### D5 — Dedicated DTOs

Tenant DTOs live in `app/types/tenant-portal.ts` and are mapped from DB rows via `app/utils/mappers/tenant-portal.ts`. The UI never receives raw row shapes, matching the project invariant.
