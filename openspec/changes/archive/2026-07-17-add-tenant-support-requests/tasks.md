## 1. Schema

- [x] 1.1 Add a migration for `support_requests` (id, tenant_id FK, building_id, contract_id, title/description, status default `new`, attachment_path nullable, created_at, updated_at).
- [x] 1.2 Enable RLS; add tenant self-select/insert policies scoped via `tenant_user_links`, and operator select policies scoped via building assignment.
- [x] 1.3 Add indexes on `tenant_id`, `building_id`, `status`.
- [x] 1.4 Regenerate `app/types/database.types.ts`.

## 2. Types, Validators, Mappers

- [x] 2.1 Add `TenantSupportRequest` DTO to `app/types/tenant-portal.ts`.
- [x] 2.2 Add create-request Zod schema (title/description; optional attachment) to `app/utils/validators/tenant-portal.ts`.
- [x] 2.3 Add mapper in `app/utils/mappers/tenant-portal.ts`.

## 3. Repository + Service

- [x] 3.1 Add `server/repositories/tenant-portal/requests.ts` (self-scoped list/create; building-scoped operator list).
- [x] 3.2 Add `server/services/tenant-portal/requests.ts` — resolve tenant id, recheck `tenant.requests.read`/`tenant.requests.write`, derive building/contract context, append audit.
- [x] 3.3 Store optional attachments in the existing `tenant-documents` bucket, building the path server-side from the resolved tenant id and returning signed URLs (reuse the archived documents convention; no new bucket/policy).
- [x] 3.4 Add the building-scoped internal read hook using `getAssignedBuildingIds`.

## 4. API Routes

- [x] 4.1 `GET /api/tenant/requests` — caller's requests (timeline order).
- [x] 4.2 `POST /api/tenant/requests` — create with optional attachment stored in `tenant-documents`.

## 5. Tests

- [x] 5.1 Self-scope: tenant sees only own requests; context derived server-side.
- [x] 5.2 Operator read hook returns only requests for assigned buildings; admin unscoped.
- [x] 5.3 Attachment stored in `tenant-documents` under the tenant's path; reads return signed URLs; cross-tenant access denied.
- [x] 5.4 Audit events emitted on create.

## 6. Verification

- [x] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 6.2 Run `openspec validate --specs`.
