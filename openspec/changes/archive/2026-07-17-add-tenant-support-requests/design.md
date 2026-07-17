## Context

The tenant foundation is implemented and archived: `add-tenant-identity-foundation` added the tenant role, `tenant_user_links`, `resolveTenantId`, and `TENANT_CAPABILITIES` (including `tenant.requests.read`/`tenant.requests.write`). `add-tenant-documents` created the private `tenant-documents` bucket with a `tenant_user_links`-scoped storage policy and server-generated 5-minute signed URLs. Internal building scope is enforced by `getAssignedBuildingIds`/`assertBuildingScope` in `server/utils/scope.ts`, and audit events are appended via `AuditService`.

This change adds a lightweight tenant-authored support-request workflow on top of that foundation. Tenants own their requests; operators (owner/manager/admin) can later view requests for buildings in their scope. The status model stays minimal to avoid churn.

## Goals / Non-Goals

**Goals:**
- Tenant can create and list their own support requests with a clear status.
- Requests carry building/contract context derived server-side (never client-declared).
- Optional attachment reuses the existing `tenant-documents` private bucket + signed-URL convention.
- Owner/manager visibility is building-scoped (read hook scaffolded).
- Lifecycle changes emit audit events.

**Non-Goals:**
- Full ticketing/back-office automation, SLAs, assignment routing, or messaging threads.
- Operator response UI (future change consumes the read hook).
- New tenant capabilities or storage buckets (both already exist and are reused).
- Notifications (Zalo OA / push) — separate post-MVP change.

## Decisions

### D1 — Minimal status model

Statuses: `new` → `in_progress` → `resolved`. No sub-states, priorities, or reopen flows in MVP. This is enough to be useful and cheap to extend later.

### D2 — Server-derived context

A request's `tenant_id` comes from `resolveTenantId`. Its `building_id`/`contract_id` are derived server-side from the tenant's active contract, not accepted from the client. This keeps operator scoping trustworthy.

### D3 — Tenant self-scope + operator building scope

Tenant endpoints (`/api/tenant/requests`) resolve tenant id and return only the caller's requests, gated by the existing `tenant.requests.read`/`tenant.requests.write` capabilities. The internal visibility hook filters by `getAssignedBuildingIds` so owners/managers see only requests for their assigned buildings; admin is unscoped. Tenants can create and read; only operators may transition status (enforced later in the operator change, capability-gated).

### D4 — Attachment reuses the archived documents convention

An optional attachment is stored in the existing private `tenant-documents` bucket using the same `tenant_user_links`-scoped policy from the archived `add-tenant-documents` change. The upload path is built server-side from the resolved tenant id (never client input); the request row stores the object reference, and reads return short-lived signed URLs. No new bucket or storage policy is introduced.

### D5 — Audit

Create and status transitions append `AuditService` events with the building context so the existing audit surfaces can include support-request activity for operators.
