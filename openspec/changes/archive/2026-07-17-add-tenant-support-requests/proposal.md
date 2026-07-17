## Why

Tenants need a channel to report issues (repairs, questions) from the portal, and operators need to see those requests scoped to their buildings. This change adds a minimal, self-scoped support-request workflow: tenants create and track their own requests; owners/managers can see requests for their assigned buildings. The status model is intentionally small to avoid redesign churn. The tenant identity, self-scope resolver, capabilities, and document-storage convention are already implemented and archived; this change builds on them.

## What Changes

- Add a `support_requests` table (tenant-authored) with a minimal status set (`new`, `in_progress`, `resolved`), optional attachment reference, building/contract context derived server-side, timestamps, and RLS.
- Add tenant self-scoped endpoints (using the existing `tenant.requests.read`/`tenant.requests.write` capabilities already present in `TENANT_CAPABILITIES`):
  - `GET /api/tenant/requests` — the caller's requests (timeline).
  - `POST /api/tenant/requests` — create a request, with an optional attachment stored in the existing private `tenant-documents` bucket (link-based policy via `tenant_user_links`, server-generated signed URLs).
- Add server audit events for request lifecycle.
- Add an owner/manager visibility hook so support requests for assigned buildings can be surfaced in the internal app in a later change (read path scaffolded, building-scoped).
- Enforce `resolveTenantId` on tenant endpoints; internal visibility enforces building scope via existing `assertBuildingScope`.

## Capabilities

### New Capabilities
- `tenant-support-requests`: Defines the support-request data model, minimal status lifecycle, tenant self-scoped create/list API, RLS, attachment storage on the existing `tenant-documents` bucket, audit events, and the building-scoped internal visibility hook.

## Impact

- `supabase/migrations/**` — `support_requests` table + RLS + indexes; regenerate types. Reuses the existing `tenant-documents` bucket and `tenant_user_links`-scoped storage policy for attachments (no new bucket).
- `server/api/tenant/requests/index.get.ts`, `index.post.ts` — new tenant routes.
- `server/services/tenant-portal/requests.ts`, `server/repositories/tenant-portal/requests.ts` — self-scoped create/list + audit; attachment upload reuses the documents storage convention.
- `app/types/tenant-portal.ts`, `app/utils/validators/tenant-portal.ts`, `app/utils/mappers/tenant-portal.ts` — request DTO/validator/mapper.
- Internal read hook (building-scoped) for future operator UI.
- Consumes existing `tenant.requests.read`/`tenant.requests.write` capabilities; no permission-map change required.
- Tests for self-scope, status transitions, attachment scoping on `tenant-documents`, and building-scoped internal reads.
