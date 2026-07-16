## 1. Types, Validators, Mappers

- [x] 1.1 Add `app/types/tenant-portal.ts` DTOs: `TenantProfile`, `TenantContractSummary`, `TenantInvoiceListItem`, `TenantInvoiceDetail`.
- [x] 1.2 Add `app/utils/validators/tenant-portal.ts`: profile update whitelist schema and invoice list query schema.
- [x] 1.3 Add `app/utils/mappers/tenant-portal.ts` mapping DB rows to the DTOs.

## 2. Repositories

- [x] 2.1 Add `server/repositories/tenant-portal/profile.ts` (read + whitelist update by tenant id).
- [x] 2.2 Add `server/repositories/tenant-portal/contract.ts` (active contract summary by tenant id).
- [x] 2.3 Add `server/repositories/tenant-portal/invoices.ts` reusing invoice list shaping with a hard `tenant_id` filter.

## 3. Services

- [x] 3.1 Add `server/services/tenant-portal/profile.ts` — resolve tenant id, recheck `tenant.profile.read`/`update`, apply whitelist.
- [x] 3.2 Add `server/services/tenant-portal/contract.ts` — resolve tenant id, recheck `tenant.contract.read`.
- [x] 3.3 Add `server/services/tenant-portal/invoices.ts` — resolve tenant id, recheck `tenant.invoices.read`, derive overdue status, enforce ownership on detail.

## 4. API Routes

- [x] 4.1 `GET /api/tenant/me`.
- [x] 4.2 `PATCH /api/tenant/me` (whitelist validated).
- [x] 4.3 `GET /api/tenant/contract`.
- [x] 4.4 `GET /api/tenant/invoices` (paginated).
- [x] 4.5 `GET /api/tenant/invoices/[id]` (ownership-enforced, consistent not-found).
- [x] 4.6 Ensure all handlers use `requireAuth` + `resolveTenantId` and ignore client-supplied tenant identifiers.

## 5. Tests

- [x] 5.1 Self-scope: handlers ignore client `tenant_id` and use the resolver.
- [x] 5.2 Profile whitelist rejects/ignores non-whitelisted fields.
- [x] 5.3 Invoice list returns only caller invoices; overdue derivation correct.
- [x] 5.4 Invoice detail returns not-found for another tenant's invoice (no existence leak).
- [x] 5.5 Active contract excludes terminated/expired.
- [x] 5.6 Internal roles cannot reach `/api/tenant/**` (guard regression).

## 6. Verification

- [x] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [x] 6.2 Run `openspec validate --specs`.
- [x] 6.3 Regenerate API inventory if applicable (`node scripts/generate-api-inventory.mjs`).
