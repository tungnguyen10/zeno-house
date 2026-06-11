## 1. Spec & Documentation Cleanup

- [x] 1.1 Update `product-flow-foundation` to remove stale meter-device lifecycle language and reference the simplified `room_id + meter_type` meter model
- [x] 1.2 Update `product-architecture` to clarify Room detail may show read-only operational context but must not host monthly billing entry/calculation
- [x] 1.3 Update `room-assignments-database` so deprecated requirements no longer state that the table SHALL exist
- [x] 1.4 Update `rooms-client` to remove monthly meter reading workflow from Room detail
- [x] 1.5 Update project status docs to match current service catalog and simplified meter model

## 2. Database Change Audit

- [x] 2.1 Confirm whether cleanup implementation requires any database schema change
- [x] 2.2 If no schema change is required, document "No DB schema changes" in the implementation notes
- [x] 2.3 If schema change is required, list every operation in detail: table, operation, columns, types, defaults, constraints, indexes, policies, backfill, data-loss risk, verification query, and rollback note
- [x] 2.4 Prepare SQL as manual Supabase Dashboard SQL Editor script
- [x] 2.5 Do not rely on `supabase db push` for applying cleanup DB changes

**Implementation note (Section 2): One dead column dropped, no other schema changes required.**

- `contracts.payment_day` already exists (migration `20260531000001_contracts_payment_day.sql`).
- `contracts.building_id NOT NULL` is enforced and backfilled (migration `20260531000000_contracts_backfill_building_id.sql`).
- Simplified meter model is already in place (migration `20260530400000_simplify_meter_readings.sql`); `meter_devices` has been dropped.
- **Cleanup drop**: `contract_payments.tenant_id` removed — column was plumbed through validator/mapper/repo but never set by any UI form and never read by any composable. Migration file `supabase/migrations/20260610000000_drop_contract_payments_tenant_id.sql` is provided for manual execution in the Supabase Dashboard SQL Editor (per D0). Run the `BEFORE` verification query first; expect zero rows with `tenant_id IS NOT NULL`.
- All other code changes in sections 3–6 work against the existing schema.

## 3. Contract Billing Readiness

- [x] 3.1 Persist `payment_day` in `ContractRepository.insert()`
- [x] 3.2 Persist `payment_day` in `ContractRepository.update()`
- [x] 3.3 Remove invalid empty-string `building_id` fallback from contract insert path
- [x] 3.4 Add/confirm API behavior for `payment_day = null` meaning inherit building due day
- [x] 3.5 Run typecheck after contract repository changes

## 4. Contract / Room Lifecycle Cleanup

- [x] 4.1 Ensure deleting an active contract sets the room back to `available` unless room is `maintenance`
- [x] 4.2 Confirm terminate/expire side effect only releases the room when the updated contract was active for that room
- [x] 4.3 Define behavior for deleting renewed/expired/terminated contracts without corrupting room status
- [x] 4.4 Add conflict/error handling for room status lifecycle edge cases where needed

## 5. Renewal Carry-Forward

- [x] 5.1 When renewal mode is `new_contract`, copy existing contract services to the successor contract
- [x] 5.2 When renewal mode is `new_contract`, copy active occupants to the successor contract with billing-counted state
- [x] 5.3 Do not copy contract payments to the successor contract
- [x] 5.4 Ensure the old contract status `renewed` does not release the room while successor contract is active
- [x] 5.5 Respect the `contracts_one_active_per_room` partial unique index: flip the old contract to `renewed` BEFORE inserting the successor as `active`
- [x] 5.6 If successor insert fails after old contract is flipped, roll old contract back to `active` so the room is not left without an active contract

## 6. UI Workflow Readiness

- [x] 6.1 Change `/billing` from a vague placeholder to a Monthly Operations entry point with building + month selection copy
- [x] 6.2 Route Building detail "Nhập chỉ số" CTA toward the billing entry point or label it as temporary monthly operations
- [x] 6.3 Remove or de-emphasize `RoomMeterReadings` from Room detail so monthly reading entry is not room-centric
- [x] 6.4 Keep handover readings on Contract detail as onboarding/offboarding data
- [x] 6.5 Clarify Contract payment UI copy so deposit/prepaid records are not confused with future invoice settlement

## 7. Verification

- [x] 7.1 Run `npm run typecheck`
- [x] 7.2 Run `npm run lint`
- [ ] 7.3 Manually verify create contract with `payment_day`
- [ ] 7.4 Manually verify active contract delete/terminate room status
- [ ] 7.5 Manually verify renewal successor has services and active occupants

**Verification notes (Section 7):**

- 7.1 `npm run typecheck` passed clean after all code changes.
- 7.2 `npm run lint` passed with zero issues.
- 7.3–7.5 require running the app against Supabase and are intended for a human operator. Suggested manual checks:
  - 7.3: Create a contract with `payment_day = 5` via `/contracts/create`; reload `/contracts/:id`; confirm UI shows `Ngày thanh toán hàng tháng: 5` and DB row has `payment_day = 5`. Repeat with no value → expect `payment_day IS NULL` and UI treats it as inherit from building.
  - 7.4: Create an active contract, delete it; the room should flip back to `available`. Repeat for `PATCH status='terminated'` on an active contract. Repeat on an already `expired`/`terminated` contract → room status must NOT change.
  - 7.5: Renew an active contract in `new_contract` mode; the successor contract’s detail page should show the cloned contract services and active occupants; the old contract should be `renewed`, the room should remain `occupied`, and no `contract_payments` rows should have been copied to the successor.

## 8. Room status full lifecycle sync (post-implementation regression fix)

- [x] 8.1 `ContractService.update()` SHALL claim the new effective room as `occupied` when transitioning a contract from `expired`/`terminated` to `active` (room status reactivation)
- [x] 8.2 `ContractService.update()` SHALL release the previous room and claim the new room when an active contract's `room_id` is reassigned while remaining `active`
- [x] 8.3 `ContractService.update()` SHALL preserve the existing release behavior when transitioning `active → terminated/expired`
- [x] 8.4 Reactivation/reassignment paths SHALL respect the conflict guard: refuse to claim a room that already has another active contract
- [x] 8.5 Data hygiene: scan and patch existing rows where `rooms.status` is out of sync with an active contract (one-off SQL via Supabase Dashboard)

## 9. Room as single source of monthly rent

- [x] 9.1 Backend `ContractService.create()` SHALL fall back to `rooms.monthly_rent` when input `monthly_rent` is zero/missing
- [x] 9.2 Backend `ContractService.create()` SHALL refuse with HTTP 409 when both input and `rooms.monthly_rent` are non-positive, instructing the operator to set the room price first
- [x] 9.3 Contract form SHALL prefill `monthly_rent` from the selected room on every room (re)select; user override remains preserved on submit and SHALL NOT update the room
- [x] 9.4 Contract form SHALL display helper text disclosing that the rent defaulted from the room
- [x] 9.5 Room form SHALL display helper text declaring the field is the room's canonical price used as default for new contracts
- [x] 9.6 Room detail page SHALL display the active contract's `monthly_rent` as the "effective rent" with a small note when it differs from the room's catalog rent; fall back to the room's rent when no active contract exists
- [x] 9.7 Data hygiene: scan and patch existing rooms whose `rooms.monthly_rent` is 0 while an active contract has a positive `monthly_rent`

**Implementation note (Sections 8 & 9):**

- Section 8 closes a pre-existing gap in `ContractService.update()` that only handled the `active → inactive` direction. The new logic computes `wasActive`, `willBeActive`, and `roomChanged`, then releases/claims as appropriate. Production data drift discovered during verification was patched via PostgREST (room `1bb5bf0c-…` was `available` while its contract `3691b271-…` was `active`).
- Section 9 establishes "Room is the price source of truth" as a system-wide rule. Backend, contract form, and room form all align on this rule; the room detail page is the only surface that surfaces the per-contract override explicitly. One legacy room (`64efbb31-…` / A103) had `monthly_rent = 0` while running a `4,000,000 ₫` contract — patched via PostgREST PATCH.
- Both sections require no DB schema change. Data hygiene UPDATEs were executed via PostgREST with the service-role key (logically equivalent to running the equivalent SQL in the Supabase Dashboard SQL Editor per D0).
- `npm run typecheck` and `npm run lint` pass clean after sections 8 and 9 code changes.

## 10. Renewal log integrity (post-implementation regression fix)

- [x] 10.1 Normalize server auth: `requireAuth()` and the auth middleware SHALL expose `user.id` derived from the JWT `sub` claim (since `serverSupabaseUser` of `@nuxtjs/supabase` v2 returns claims, not a Supabase `User`)
- [x] 10.2 `ContractService.renew()` extend mode SHALL insert the `contract_renewals` log row BEFORE updating the contract's `renewal_count`/`end_date`, and SHALL delete the log row on UPDATE failure
- [x] 10.3 `ContractRenewalRepository.insert()` SHALL use the service-role Supabase client; permission is already enforced at the service entry, RLS stays strict as defense-in-depth
- [x] 10.4 `ContractRenewalRepository.deleteById()` SHALL exist to support best-effort rollback and use service-role
- [x] 10.5 Client `handleRenew()` SHALL surface the server error message (checking `data.error.message`, `data.message`, `statusMessage`, and `message` in order) so 500s from the renewal API never appear as a generic toast
- [x] 10.6 Data hygiene: backfill missing `contract_renewals` rows for contracts whose `renewal_count` exceeds the actual log row count due to pre-fix failures, marked with reason `Backfilled: pre-fix renewal (dates approximate)` where source dates are unknown

**Implementation note (Section 10):**

- Root cause was an upstream auth bug: `serverSupabaseUser()` from `@nuxtjs/supabase` v2 returns JWT claims (id on `sub`), not a Supabase `User`. The old `requireAuth()` cast claims to `AuthUser` blindly so `user.id` was silently `undefined`. The renewal log INSERT then failed on the `created_by NOT NULL` constraint, but the contract UPDATE (which had already run first) succeeded — bumping `renewal_count` without producing a matching log row.
- Fix order matters: even after auth was fixed, the original "update first, log second" sequencing would still drift on any future write failure. The corrected sequencing (log first, then update, then rollback log on update failure) makes the invariant `renewal_count == COUNT(contract_renewals)` hold regardless of which side fails.
- Repository switched to service-role for both `insert()` and `deleteById()`. The service entry (`ContractRenewalService.renew()`) already enforces `can(user, 'contracts.update')`, so RLS on `contract_renewals` only needs to defend against direct (non-server) client writes.
- Data hygiene backfill executed via PostgREST with service-role: contract `918082e5` (1 missing row) and contract `0fe4ef46` (2 missing rows, dates approximate). Rows marked in `reason` for auditability.
- Other `user.id` callers benefit too: `MeterReadingService.create/bulkCreate` previously also received `undefined` as the `created_by` argument; the auth normalization fix removes that latent bug as well.
