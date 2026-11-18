---
type: Change Design
title: "tenant-access-contract-linking-design"
status: draft
change_state: archived
tags: [superpowers, change, tenants, contracts, security, v2]
---

# Tenant Access & Contract Linking (Tenant optimization PR1, P0)

## Goal

A tenant can never be attached to a contract outside the actor's permission by calling the API directly, while a legitimate re-rental keeps working: a former tenant who moves to a building of **another owner** keeps the **same Tenant ID**, contract quick-create stays fast, and no out-of-scope data is exposed.

## Confirmed gaps (develop, 2026-11-18)

1. `ContractService.create` checks only the room's building scope; `tenant_id` and `occupants[].tenant_id` were never checked against `TenantAuthorizationService`.
2. `ContractService.update` accepted a new `tenant_id` without a tenant check, wrote client `building_id` verbatim and did not resync `building_id` when the room changed.
3. `ContractOccupantService.add` did not check the added tenant.
4. Create used `input.building_id ?? room.buildingId` (the DB guard `INVENTORY_ROOM_SCOPE` caught mismatches, the service did not).
5. A tenant who left Owner A could not be reused by Owner B: create returned the generic identity conflict and the picker never showed the record.
6. No DB guard for "tenant is primary on another active contract" (only `contract_occupants_active_tenant_unique` exists), so two concurrent creates could both pass the service pre-check.

## Decisions (approved in brainstorming)

| Topic | Decision |
| --- | --- |
| Reuse model | **Additive access.** Same Tenant ID. B gains access through the new active relation; A keeps its historical `basic` view. No ownership transfer. |
| Data B sees after linking | **Shared profile.** Once the contract is active the existing ZH-SEC-01 matrix gives B `full` (all profile fields and ID images) and A `basic`. No access-level change. |
| Verification | **Tiered.** Record with `id_number` **or** ID images → phone + ID number must match. Record without both → phone + normalized full name (NFC, collapsed whitespace, case-insensitive). |
| Mechanism | **Short-lived signed link token** (HMAC-SHA256, 10 min, bound to actor + tenant + building), no new table. |
| Linkable without token | Tenant level `full` **or** `basic` for the actor (the actor already has a scope relation; the picker already lists these). `none` requires a valid token. |
| Busy tenants | Never linkable, token or not. Enforced in service pre-check and by a DB trigger under a per-tenant advisory lock. |
| Required tenant profile (7 DOCX fields) | Approved as a **separate change** `tenant-required-profile` (not part of this PR). Until it ships, the name tier covers legacy records. |

## Server design

### `server/utils/tenant-link-token.ts`

`signTenantLinkToken(secret, { sub, tid, bid })` → `{ token, expiresAt }`; `verifyTenantLinkToken(secret, token)` → claims or `null` (bad format, bad signature via `timingSafeEqual`, expired, wrong version). `getTenantLinkSecret(event)` reads `runtimeConfig.tenantLinkSecret` (`NUXT_TENANT_LINK_SECRET`, ≥ 32 chars) or returns `null` (fail closed).

### `TenantAuthorizationService.assertLinkable(event, user, tenantId, { buildingId, linkToken? })`

1. Valid token whose `sub/tid/bid` equal actor/tenant/building → allowed.
2. Otherwise resolve access; `full` or `basic` → allowed.
3. Otherwise `404 TENANT_NOT_LINKABLE` (does not reveal whether the tenant exists).

Call sites: `ContractService.create` (primary + each roommate, building = `room.buildingId`), `ContractService.update` (when `tenant_id` changes; building = target room's building), `ContractOccupantService.add` (building = contract's building).

### Building/room consistency

- Create ignores client `building_id`; always `room.buildingId`.
- Update never writes client `building_id`; when the room changes, `building_id` follows the new room. Moving a contract to a room in another building → `409 CONTRACT_ROOM_BUILDING_CHANGE` (use checkout + new contract).

### `POST /api/tenants/link-verify`

Body `{ building_id: uuid, phone, proof }` (`proof` = ID number or full name; digits-only after removing spaces → ID number tier).

1. `contracts.create` capability, `assertBuildingScope(building, 'write')`.
2. Secret missing → `503 TENANT_LINK_DISABLED`.
3. Rate limit shared with identity conflict (`TenantIdentityConflictLimitRepository`).
4. Find by normalized phone, apply tier. Not found **or** mismatch → identical `404 TENANT_LINK_UNVERIFIED`, one limiter unit and audit `tenant.link_verify_failed` (actor + building only, no PII).
5. Active relation anywhere → `409 TENANT_BUSY` (no building/owner detail).
6. Success → `{ tenant: { id, code, fullName, phone }, linkToken, expiresAt }` and audit `tenant.link_verified` (tenant + building).

Tokens are kept only in page state; never written to the contract server draft or browser storage.

### Migration `20261118120000_tenant_availability_guard.sql`

`guard_tenant_availability()` trigger (security invoker, `search_path = ''`):

- `contracts` `BEFORE INSERT OR UPDATE OF tenant_id, status` when `NEW.status = 'active'` and (insert, tenant changed or status became active).
- `contract_occupants` `BEFORE INSERT` (and `UPDATE OF tenant_id, move_out_date` re-opening) when `move_out_date IS NULL`.
- Takes `pg_advisory_xact_lock` per tenant, then raises `TENANT_BUSY` (`23505`) if the tenant is primary on another active contract or has an open occupancy on another contract.
- Renewal is compatible: `renew_contract_atomic` closes occupancies and marks the old contract `renewed` before inserting the successor; occupants inserted for the same contract as the tenant's primary contract are allowed.
- Rollout precondition: read-only query for existing violations; stop and report if any exist. No unique index in this PR (PR4 after data is clean).

### Error codes

| Code | HTTP | Source |
| --- | --- | --- |
| `TENANT_NOT_LINKABLE` | 404 | `assertLinkable` |
| `TENANT_LINK_UNVERIFIED` | 404 | link-verify |
| `TENANT_BUSY` | 409 | link-verify, trigger (mapped in `throwDbError`) |
| `CONTRACT_ROOM_BUILDING_CHANGE` | 409 | contract update |
| `TENANT_LINK_DISABLED` | 503 | link-verify without secret |
| `RATE_LIMITED` | 429 | shared limiter |

## UI design (lean)

- **One field.** `TenantPicker` keeps scoped search. When the search text is a valid phone with no scoped result and the picker has a `buildingId`, a single inline row appears under the field: `[CCCD hoặc họ tên] [Xác minh]`, plus the existing "Thêm khách mới" option.
- **Success** → selection chip with a check mark; token kept in component/page state and sent as `tenant_link_token` / `occupants[].link_token` / occupant `link_token`.
- **Errors** → one short line under the field ("Không khớp", "Đang thuê nơi khác", "Thử lại sau N phút", "Tính năng chưa bật").
- **Quick create conflict** → dialog closes and the verify row opens prefilled with the typed phone and ID number.
- **Room changed to another building** → token dropped, selection cleared with "Xác minh lại".
- **Restored draft / expired token** → server `TENANT_NOT_LINKABLE` maps to the tenant field error "Cần xác minh lại khách".
- Only existing `Ui*` primitives; no new tokens or shared primitives.

## Out of scope

Required 7-field tenant profile (separate change), unique index on active primary contracts, OTP consent, global tenant search.
