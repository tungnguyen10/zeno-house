## 1. Storage Policy Migration

- [x] 1.1 Add a migration with a link-based `select` policy on the document bucket joining `tenant_user_links` against `split_part(name, '/', 1)`.
- [x] 1.2 Add matching `insert`/`delete` policies with the same `tenant_user_links` predicate; keep the existing admin-all policy.
- [x] 1.3 If a dedicated `tenant-documents` bucket is used, create it private with mime/size limits.
- [x] 1.4 Add SQL tests asserting policies reference `tenant_user_links`, `auth.uid()`, and the path segment (not `auth.uid() = foldername[1]`).

## 2. Repository + Service

- [x] 2.1 Add `server/repositories/tenant-portal/documents.ts` for list/upload/remove + signed URL generation (5-minute expiry).
- [x] 2.2 Add `server/services/tenant-portal/documents.ts` resolving tenant id, rechecking `tenant.documents.read`/`write`, building paths from the resolved id only.
- [x] 2.3 Validate mime and size server-side; reject oversized/invalid uploads with a clear error.

## 3. API Routes

- [x] 3.1 `GET /api/tenant/documents` — list caller documents with signed URLs.
- [x] 3.2 `POST /api/tenant/documents` — upload (multipart), validated.
- [x] 3.3 `DELETE /api/tenant/documents/[id]` — remove caller's own document only.

## 4. Tests

- [x] 4.1 Policy matches existing `tenant.id`-keyed paths for the linked tenant and denies others.
- [x] 4.2 Upload rejects wrong mime and oversized files.
- [x] 4.3 Signed URLs are short-lived and scoped to caller documents.
- [x] 4.4 Cross-tenant read/delete attempts are denied consistently.

## 5. Verification

- [x] 5.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 5.2 Run `openspec validate --specs`.

## 6. Shared Identity-Image Slots

- [x] 6.1 Add a forward migration granting linked tenants select/insert/delete on their own paths in `tenant-id-images`, while retaining the admin-all policy and private bucket.
- [x] 6.2 Add a self-scoped identity-image repository/service that reads and updates the existing front/back path columns, validates JPEG/PNG/WebP up to 5MB, replaces superseded objects, and returns five-minute signed URLs.
- [x] 6.3 Add `GET /api/tenant/id-images`, `POST /api/tenant/id-images/[side]`, and `DELETE /api/tenant/id-images/[side]` with auth, `resolveTenantId`, side validation, and standard responses.
- [x] 6.4 Add policy, repository, service, and API tests for empty-slot upload, replacement, removal, five-minute URLs, and cross-tenant denial.
- [x] 6.5 Regenerate API docs and rerun typecheck, full tests, lint, and OpenSpec validation.
- [x] 6.6 Reconcile proposal, design, and delta spec with the final bucket-by-document-type decision and explicit Tenant Portal identity-image contract.
