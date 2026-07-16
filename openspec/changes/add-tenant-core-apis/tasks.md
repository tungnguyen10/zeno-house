## 1. Types, Validators, Mappers

- [ ] 1.1 Add `app/types/tenant-portal.ts` DTOs: `TenantProfile`, `TenantContractSummary`, `TenantInvoiceListItem`, `TenantInvoiceDetail`.
- [ ] 1.2 Add `app/utils/validators/tenant-portal.ts`: profile update whitelist schema and invoice list query schema.
- [ ] 1.3 Add `app/utils/mappers/tenant-portal.ts` mapping DB rows to the DTOs.

## 2. Repositories

- [ ] 2.1 Add `server/repositories/tenant-portal/profile.ts` (read + whitelist update by tenant id).
- [ ] 2.2 Add `server/repositories/tenant-portal/contract.ts` (active contract summary by tenant id).
- [ ] 2.3 Add `server/repositories/tenant-portal/invoices.ts` reusing invoice list shaping with a hard `tenant_id` filter.

## 3. Services

- [ ] 3.1 Add `server/services/tenant-portal/profile.ts` — resolve tenant id, recheck `tenant.profile.read`/`update`, apply whitelist.
- [ ] 3.2 Add `server/services/tenant-portal/contract.ts` — resolve tenant id, recheck `tenant.contract.read`.
- [ ] 3.3 Add `server/services/tenant-portal/invoices.ts` — resolve tenant id, recheck `tenant.invoices.read`, derive overdue status, enforce ownership on detail.

## 4. API Routes

- [ ] 4.1 `GET /api/tenant/me`.
- [ ] 4.2 `PATCH /api/tenant/me` (whitelist validated).
- [ ] 4.3 `GET /api/tenant/contract`.
- [ ] 4.4 `GET /api/tenant/invoices` (paginated).
- [ ] 4.5 `GET /api/tenant/invoices/[id]` (ownership-enforced, consistent not-found).
- [ ] 4.6 Ensure all handlers use `requireAuth` + `resolveTenantId` and ignore client-supplied tenant identifiers.

## 5. Tests

- [ ] 5.1 Self-scope: handlers ignore client `tenant_id` and use the resolver.
- [ ] 5.2 Profile whitelist rejects/ignores non-whitelisted fields.
- [ ] 5.3 Invoice list returns only caller invoices; overdue derivation correct.
- [ ] 5.4 Invoice detail returns not-found for another tenant's invoice (no existence leak).
- [ ] 5.5 Active contract excludes terminated/expired.
- [ ] 5.6 Internal roles cannot reach `/api/tenant/**` (guard regression).

## 6. Verification

- [ ] 6.1 Run `npm run typecheck`, `npm test`, `npm run lint`.
- [ ] 6.2 Run `openspec validate --specs`.
- [ ] 6.3 Regenerate API inventory if applicable (`node scripts/generate-api-inventory.mjs`).
