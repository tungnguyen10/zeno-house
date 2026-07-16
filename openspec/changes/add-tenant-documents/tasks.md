## 1. Storage Policy Migration

- [ ] 1.1 Add a migration with a link-based `select` policy on the document bucket joining `tenant_user_links` against `split_part(name, '/', 1)`.
- [ ] 1.2 Add matching `insert`/`delete` policies with the same `tenant_user_links` predicate; keep the existing admin-all policy.
- [ ] 1.3 If a dedicated `tenant-documents` bucket is used, create it private with mime/size limits.
- [ ] 1.4 Add SQL tests asserting policies reference `tenant_user_links`, `auth.uid()`, and the path segment (not `auth.uid() = foldername[1]`).

## 2. Repository + Service

- [ ] 2.1 Add `server/repositories/tenant-portal/documents.ts` for list/upload/remove + signed URL generation (5-minute expiry).
- [ ] 2.2 Add `server/services/tenant-portal/documents.ts` resolving tenant id, rechecking `tenant.documents.read`/`write`, building paths from the resolved id only.
- [ ] 2.3 Validate mime and size server-side; reject oversized/invalid uploads with a clear error.

## 3. API Routes

- [ ] 3.1 `GET /api/tenant/documents` — list caller documents with signed URLs.
- [ ] 3.2 `POST /api/tenant/documents` — upload (multipart), validated.
- [ ] 3.3 `DELETE /api/tenant/documents/[id]` — remove caller's own document only.

## 4. Tests

- [ ] 4.1 Policy matches existing `tenant.id`-keyed paths for the linked tenant and denies others.
- [ ] 4.2 Upload rejects wrong mime and oversized files.
- [ ] 4.3 Signed URLs are short-lived and scoped to caller documents.
- [ ] 4.4 Cross-tenant read/delete attempts are denied consistently.

## 5. Verification

- [ ] 5.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [ ] 5.2 Run `openspec validate --specs`.
