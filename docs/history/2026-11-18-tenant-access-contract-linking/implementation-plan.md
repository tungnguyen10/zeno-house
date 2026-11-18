---
type: Change Implementation Plan
title: "tenant-access-contract-linking-implementation-plan"
status: draft
change_state: archived
tags: [superpowers, change, tenants, contracts, security]
---

# Tenant Access & Contract Linking — implementation plan

**Spec:** [design.md](./design.md). Single checklist for this change. TDD: each task starts with a failing test.

- [x] 1. Link token util (`server/utils/tenant-link-token.ts`) — sign/verify, tamper, expiry, version, secret length; `runtimeConfig.tenantLinkSecret`.
- [x] 2. `TenantAuthorizationService.assertLinkable` — full/basic allowed, none → 404 `TENANT_NOT_LINKABLE`, valid token allowed, token for other actor/tenant/building rejected.
- [x] 3. `TenantLinkService.verify` + `POST /api/tenants/link-verify` + `tenantLinkVerifySchema` — ID tier, name tier, identical 404s, busy 409, disabled 503, limiter + audit without PII.
- [x] 4. `ContractService.create` — `assertLinkable` for primary and roommates, building from room only; validator accepts `tenant_link_token` and `occupants[].link_token`.
- [x] 5. `ContractService.update` — `assertLinkable` on tenant change, no client `building_id`, building follows room, cross-building move → 409.
- [x] 6. `ContractOccupantService.add` — `assertLinkable` with contract building; validator accepts `link_token`.
- [x] 7. Migration `20261118120000_tenant_availability_guard.sql` + `supabase/verification/tenant_availability_guard.sql`; `throwDbError` maps `TENANT_BUSY`; SQL-text contract test.
- [x] 8. UI — `TenantPicker` inline verify row, token emit, re-verify states; quick-create conflict handoff; `contracts/create.vue`, `ContractOccupantForm`, `ContractOccupantsSection` pass building and tokens.
- [x] 9. Audit labels, API inventory, docs; scoped tests, full `npm test`, `npm run typecheck`, `npm run lint`, `npm run knowledge:check`.
- [x] 10. Cloud rollout: violation preflight (none), migration applied, SQL verification passed on production (2026-11-18), `NUXT_TENANT_LINK_SECRET` set on Vercel Production. No generated type change was needed (no new table or function signature used by the app).
- [ ] 11. Deployed smoke and visual QA — open, tracked in [verification](./verification.md); requires the application to be deployed and an authenticated browser session.
- [x] 12. Promoted to `docs/capabilities/tenants-api.md`, `contracts-api.md`, `tenants-ui.md`; archived under `docs/history/2026-11-18-tenant-access-contract-linking/`.
