## Context

`add-tenant-identity-foundation` gives the tenant role, linkage, and `resolveTenantId`. `add-tenant-documents` establishes the private-bucket + link-based attachment pattern. Internal building scope is enforced by `getAssignedBuildingIds`/`assertBuildingScope` in `server/utils/scope.ts`, and audit events are appended via `AuditService`.

This change adds a lightweight tenant-authored support-request workflow. Tenants own their requests; operators (owner/manager/admin) can later view requests for buildings in their scope. The status model stays minimal to avoid churn.

## Goals / Non-Goals

**Goals:**
- Tenant can create and list their own support requests with a clear status.
- Requests carry building/contract context derived server-side (never client-declared).
- Optional attachment reuses the tenant-documents private + signed-URL pattern.
- Owner/manager visibility is building-scoped (read hook scaffolded).
- Lifecycle changes emit audit events.

**Non-Goals:**
- Full ticketing/back-office automation, SLAs, assignment routing, or messaging threads.
- Operator response UI (future change consumes the read hook).
- Notifications (Zalo OA / push) — separate post-MVP change.

## Decisions

### D1 — Minimal status model

Statuses: `new` → `in_progress` → `resolved`. No sub-states, priorities, or reopen flows in MVP. This is enough to be useful and cheap to extend later.

### D2 — Server-derived context

A request's `tenant_id` comes from `resolveTenantId`. Its `building_id`/`contract_id` are derived server-side from the tenant's active contract, not accepted from the client. This keeps operator scoping trustworthy.

### D3 — Tenant self-scope + operator building scope

Tenant endpoints (`/api/tenant/requests`) resolve tenant id and return only the caller's requests. The internal visibility hook filters by `getAssignedBuildingIds` so owners/managers see only requests for their assigned buildings; admin is unscoped. Tenants can create and read; only operators may transition status (enforced later in the operator change, capability-gated).

### D4 — Attachment reuse

An optional attachment uses the same private bucket + `tenant_user_links` policy from `add-tenant-documents`; the request stores an object reference, and reads return signed URLs.

### D5 — Audit

Create and status transitions append `AuditService` events with the building context so the existing audit surfaces can include support-request activity for operators.
