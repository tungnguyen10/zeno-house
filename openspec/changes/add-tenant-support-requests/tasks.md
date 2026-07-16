## 1. Schema

- [ ] 1.1 Add a migration for `support_requests` (id, tenant_id FK, building_id, contract_id, title/description, status default `new`, attachment_path nullable, created_at, updated_at).
- [ ] 1.2 Enable RLS; add tenant self-select/insert policies scoped via `tenant_user_links`, and operator select policies scoped via building assignment.
- [ ] 1.3 Add indexes on `tenant_id`, `building_id`, `status`.
- [ ] 1.4 Regenerate `app/types/database.types.ts`.

## 2. Types, Validators, Mappers

- [ ] 2.1 Add `TenantSupportRequest` DTO to `app/types/tenant-portal.ts`.
- [ ] 2.2 Add create-request Zod schema (title/description; optional attachment) to `app/utils/validators/tenant-portal.ts`.
- [ ] 2.3 Add mapper in `app/utils/mappers/tenant-portal.ts`.

## 3. Repository + Service

- [ ] 3.1 Add `server/repositories/tenant-portal/requests.ts` (self-scoped list/create; building-scoped operator list).
- [ ] 3.2 Add `server/services/tenant-portal/requests.ts` — resolve tenant id, recheck `tenant.requests.read`/`write`, derive building/contract context, append audit.
- [ ] 3.3 Add the building-scoped internal read hook using `getAssignedBuildingIds`.

## 4. API Routes

- [ ] 4.1 `GET /api/tenant/requests` — caller's requests (timeline order).
- [ ] 4.2 `POST /api/tenant/requests` — create with optional attachment (tenant-documents pattern).

## 5. Tests

- [ ] 5.1 Self-scope: tenant sees only own requests; context derived server-side.
- [ ] 5.2 Operator read hook returns only requests for assigned buildings; admin unscoped.
- [ ] 5.3 Attachment stored privately; reads return signed URLs.
- [ ] 5.4 Audit events emitted on create.

## 6. Verification

- [ ] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [ ] 6.2 Run `openspec validate --specs`.
