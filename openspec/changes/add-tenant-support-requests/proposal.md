## Why

Tenants need a channel to report issues (repairs, questions) from the portal, and operators need to see those requests scoped to their buildings. This change adds a minimal, self-scoped support-request workflow: tenants create and track their own requests; owners/managers can see requests for their assigned buildings. The status model is intentionally small to avoid redesign churn.

## What Changes

- Add a `support_requests` table (tenant-authored) with a minimal status set (`new`, `in_progress`, `resolved`), optional attachment reference, building/contract context derived server-side, timestamps, and RLS.
- Add tenant self-scoped endpoints:
  - `GET /api/tenant/requests` — the caller's requests (timeline).
  - `POST /api/tenant/requests` — create a request (optional attachment via the tenant-documents pattern).
- Add server audit events for request lifecycle.
- Add an owner/manager visibility hook so support requests for assigned buildings can be surfaced in the internal app in a later change (read path scaffolded, building-scoped).
- Enforce `resolveTenantId` on tenant endpoints; internal visibility enforces building scope via existing `assertBuildingScope`.

## Capabilities

### New Capabilities
- `tenant-support-requests`: Defines the support-request data model, minimal status lifecycle, tenant self-scoped create/list API, RLS, audit events, and the building-scoped internal visibility hook.

## Impact

- `supabase/migrations/**` — `support_requests` table + RLS + indexes; regenerate types.
- `server/api/tenant/requests/index.get.ts`, `index.post.ts` — new tenant routes.
- `server/services/tenant-portal/requests.ts`, `server/repositories/tenant-portal/requests.ts` — self-scoped create/list + audit.
- `app/types/tenant-portal.ts`, `app/utils/validators/tenant-portal.ts`, `app/utils/mappers/tenant-portal.ts` — request DTO/validator/mapper.
- Internal read hook (building-scoped) for future operator UI.
- Tests for self-scope, status transitions, attachment scoping, and building-scoped internal reads.
