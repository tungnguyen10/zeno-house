---
type: Implementation Plan
title: "2026-11-05-atomic-contract-renewal"
status: draft
change_state: implementation-review
tags: [superpowers, change, migration]
sources:
  - resource: "https://github.com/tungnguyen10/zeno-house/blob/060d0d77e07095c593b9ff154450580db8ba0f41/docs/superpowers/plans/2026-11-05-atomic-contract-renewal.md"
generated:
  by: "process:docs-okf-consolidation"
  at: "2026-11-06T00:00:00Z"
---

> Migrated P0 design/execution artifact. Validate actual source, migrations, tests, and rollout state before treating checked tasks as delivered. Canonical accepted requirements live in `docs/capabilities/**`.

# Atomic Contract Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete PR2 / ZH-CTR-01: contract renewal either fully succeeds or fully rolls back, and occupants, services and held deposits move to the successor contract.

**Architecture:** One `security invoker` Postgres RPC `renew_contract_atomic` (service_role only) performs the whole renewal under row locks and writes the audit rows. The TypeScript service only checks capability and building scope, then calls the repository. Checkout RPCs and a receipt-lock trigger are updated in the same migration so a transferred deposit stays usable.

**Tech Stack:** Nuxt, Vue, TypeScript, Zod, Vitest, Supabase PostgreSQL (cloud Dashboard SQL, no local DB).

**Spec:** `docs/changes/atomic-contract-renewal/design.md`

## Global Constraints

- `end_date` is inclusive. Successor `start_date = old.end_date + 1`; old occupancy `move_out_date = old.end_date`; new occupancy `move_in_date = old.end_date + 1`.
- Services own permissions and business rules; repositories only query/persist; client business data goes through `server/api/**`.
- RPC: `security invoker`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.
- Lock order for `new_contract`: contract, room, open occupants (by id), checkout sources (by id).
- `audit_events.operation_id` has a unique partial index: renewal audit rows share `correlation_id` and leave `operation_id` null.
- Never hand-edit `app/types/database.types.ts`; regenerate it only after the migration is applied to staging. Do not start local DB or install dependencies; produce SQL for the cloud Dashboard.
- Vietnamese copy must have diacritics. UI uses existing primitives only (`UiAlert`, `UiButton`, `UiInput`, `UiDatePicker`, `UiStatusBadge`, existing icons).
- Every user-visible UI change follows `.agents/skills/zeno-house/references/ui-polish-workflow.md` (`frontend-design` + `hallmark`).
- No existing renewal behavior outside this spec changes; billing/checkout/prorate date conventions are out of scope.

## Review Focus

- Replay with the same `operation_id` after a network failure returns the first result and creates nothing new.
- Two concurrent renewals of one contract: exactly one wins, the other gets `CONTRACT_NOT_ACTIVE` or `CONTRACT_ALREADY_RENEWED`.
- A contract with zero co-occupants (only the primary row) and one with services disabled still clone fully.
- A failure after the successor insert (service clone) leaves the old contract `active`, no successor, occupants and sources unchanged.
- A deposit already partly refunded/allocated transfers only when its balance is greater than 0, and checkout of the successor sees the same balance.
- Receipt insert/update/delete on a `renewed` contract is rejected by service and by trigger.
- A `scheduled` amendment on the old contract is cancelled with audit in the same transaction.

---

## File Structure

- Create `supabase/migrations/20261105120000_atomic_contract_renewal.sql`: schema, RPC, checkout function updates, receipt lock trigger.
- Create `supabase/verification/contract_renewal_integrity.sql` (read-only) and `supabase/verification/atomic_contract_renewal.sql` (fixtures, rollback).
- Create `supabase/sql-editor/repair-contract-renewal-chains.sql` (run only after approval).
- Modify `server/services/contract-renewals.ts`, `server/repositories/contract-renewals/index.ts`, `server/utils/errors.ts`, `server/services/contract-payments.ts`, `server/repositories/contract-occupants/index.ts`, `server/repositories/contract-services/index.ts`, `server/repositories/contracts/index.ts`.
- Modify `app/utils/validators/contract-renewals.ts`, `app/types/contracts.ts`, `app/utils/mappers/contracts.ts`, `app/types/checkout.ts`, `app/utils/constants/audit.ts`, `app/composables/contracts/useContractRenewals.ts`.
- Modify UI: `ContractRenewalForm.vue`, `ContractDetailHero.vue`, `ContractPaymentsSection.vue`, `ContractCheckoutSection.vue`, `app/pages/dashboard/contracts/[code]/index.vue`.
- Docs: `docs/features/contracts.md`, `docs/architecture/database.md`, `docs/changes/add-contract-amendments/tasks.md` (task 2.3).
- Tests: `tests/server/contracts/renewal-migration.test.ts`, `renewal-service.test.ts`, `renewal-errors.test.ts`, `payments-renewed-lock.test.ts`, `tests/utils/contract-renewals-mapper.test.ts`, `tests/utils/contracts-mapper-chain.test.ts`, `tests/components/contracts/renewal.test.ts`.

---

### Task 1: Migration, SQL verification and migration text test

**Files:**
- Create: `supabase/migrations/20261105120000_atomic_contract_renewal.sql`
- Create: `supabase/verification/atomic_contract_renewal.sql`, `supabase/verification/contract_renewal_integrity.sql`
- Test: `tests/server/contracts/renewal-migration.test.ts`

**Interfaces:**
- Produces: `public.renew_contract_atomic(p_contract_id uuid, p_mode text, p_new_end_date date, p_new_monthly_rent numeric, p_reason text, p_actor_id uuid, p_operation_id uuid, p_correlation_id uuid) returns jsonb` with `{ renewal, contract, new_contract, transferred_source_ids, replayed }`. `renewal` is the `contract_renewals` row as JSON (snake_case); `contract` is the old contract row; `new_contract` is the successor row or null.
- Produces error messages (exact `raise exception` text, with SQLSTATE): `CONTRACT_NOT_FOUND` P0002, `CONTRACT_NOT_ACTIVE` 23514, `CONTRACT_CHECKOUT_IN_PROGRESS` 23514, `CONTRACT_ALREADY_RENEWED` 23505, `RENEWAL_OPERATION_MISMATCH` 23505, `RENEWAL_OCCUPANTS_MISSING` 23514, `RENEWAL_END_DATE_INVALID` 22008, `CONTRACT_RENEWED_RECEIPT_LOCKED` 23514.
- Produces: `contract_checkout_get` sources with `originContractId`, `originContractCode`.

- [ ] **Step 1: Write the failing migration text test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve('supabase/migrations/20261105120000_atomic_contract_renewal.sql'), 'utf8')

describe('atomic contract renewal migration', () => {
  it('adds idempotency and one-successor constraints', () => {
    expect(migration).toMatch(/add column operation_id uuid unique/i)
    expect(migration).toMatch(/create unique index contracts_one_successor[\s\S]*where previous_contract_id is not null/i)
  })

  it('defines a service-role-only invoker RPC with every domain error code', () => {
    expect(migration).toMatch(/function public\.renew_contract_atomic/i)
    expect(migration).toMatch(/security invoker/i)
    expect(migration).toMatch(/set search_path = ''/i)
    expect(migration).toMatch(/revoke all on function public\.renew_contract_atomic[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute on function public\.renew_contract_atomic[\s\S]*to service_role/i)
    for (const code of ['CONTRACT_NOT_FOUND', 'CONTRACT_NOT_ACTIVE', 'CONTRACT_CHECKOUT_IN_PROGRESS', 'CONTRACT_ALREADY_RENEWED', 'RENEWAL_OPERATION_MISMATCH', 'RENEWAL_OCCUPANTS_MISSING', 'RENEWAL_END_DATE_INVALID', 'CONTRACT_RENEWED_RECEIPT_LOCKED']) {
      expect(migration).toContain(code)
    }
  })

  it('uses the inclusive-end-date convention and moves deposit sources', () => {
    expect(migration).toMatch(/old_row\.end_date \+ 1/)
    expect(migration).toMatch(/move_out_date = old_row\.end_date/)
    expect(migration).toMatch(/update public\.contract_checkout_sources[\s\S]*contract_checkout_source_balance\(id\) > 0/i)
  })

  it('locks receipts on renewed contracts before the checkout guard runs', () => {
    expect(migration).toMatch(/trigger a_contract_payments_renewed_lock[\s\S]*before insert or update or delete on public\.contract_payments/i)
    expect(migration).toMatch(/contract_checkout_payment_guard[\s\S]*h\.contract_id = source\.contract_id/i)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/server/contracts/renewal-migration.test.ts`
Expected: FAIL (ENOENT, migration file missing).

- [ ] **Step 3: Write the migration**

Start the file with the schema and the receipt lock:

```sql
alter table public.contract_renewals add column operation_id uuid unique;

create unique index contracts_one_successor on public.contracts(previous_contract_id)
  where previous_contract_id is not null;

create or replace function public.contract_payments_renewed_lock() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_status text;
begin
  select status into v_status from public.contracts
  where id = coalesce(new.contract_id, old.contract_id);
  if v_status = 'renewed' then
    raise exception 'CONTRACT_RENEWED_RECEIPT_LOCKED' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Before-row triggers fire alphabetically; the 'a_' prefix makes this run before
-- 'contract_checkout_receipt_mutation'.
create trigger a_contract_payments_renewed_lock
  before insert or update or delete on public.contract_payments
  for each row execute function public.contract_payments_renewed_lock();
```

Then `create or replace` the three checkout functions by copying their current definitions verbatim from `20261001143337_contract_checkout_settlement.sql` (`contract_checkout_credit` line 353, `contract_checkout_payment_guard` line 419) and `20261010140000_checkout_per_person_utilities.sql` (`contract_checkout_get` line 96), changing only:

1. `contract_checkout_payment_guard`: replace `h.contract_id=old.contract_id` with `h.contract_id = source.contract_id`.
2. `contract_checkout_credit`: replace `select * into p from public.contract_payments where id=p_payment_id and contract_id=p_contract_id for update;` with
```sql
 select * into p from public.contract_payments pay
  where pay.id = p_payment_id
    and (pay.contract_id = p_contract_id or pay.contract_id in (
      with recursive chain(id, prev, depth) as (
        select c.id, c.previous_contract_id, 1 from public.contracts c where c.id = p_contract_id
        union all
        select c.id, c.previous_contract_id, chain.depth + 1
        from public.contracts c join chain on c.id = chain.prev
        where chain.depth < 20 and c.status = 'renewed'
      ) select id from chain where id <> p_contract_id))
  for update;
```
3. `contract_checkout_get`: `sources` becomes sources of this contract plus unsourced receipts of this contract:
```sql
 'sources',(select coalesce(jsonb_agg(x.j order by x.id),'[]') from (
   select p.id, jsonb_build_object('id',p.id,'paymentType',p.payment_type,'amount',p.amount,'approvedAmount',coalesce(cs.approved_amount,0),'originContractId',p.contract_id,'originContractCode',oc.contract_code) as j
   from public.contract_checkout_sources cs
   join public.contract_payments p on p.id = cs.payment_id
   join public.contracts oc on oc.id = p.contract_id
   where cs.contract_id = p_contract_id
   union all
   select p.id, jsonb_build_object('id',p.id,'paymentType',p.payment_type,'amount',p.amount,'approvedAmount',0,'originContractId',p.contract_id,'originContractCode',oc.contract_code)
   from public.contract_payments p
   join public.contracts oc on oc.id = p.contract_id
   where p.contract_id = p_contract_id
     and not exists (select 1 from public.contract_checkout_sources s where s.payment_id = p.id)
 ) x),
```

Then the RPC. Write `renew_contract_atomic` with `declare old_row public.contracts%rowtype; new_row public.contracts%rowtype; renewal public.contract_renewals%rowtype; v_rent numeric; v_closed_occ jsonb; v_sources jsonb := '[]'; v_building_name text; v_building_code text; v_code text; v_prefix text; v_seq integer; am record;` and this body, in order:

```sql
  select * into renewal from public.contract_renewals where operation_id = p_operation_id;
  if found then
    select * into old_row from public.contracts where id = renewal.contract_id;
    if renewal.contract_id = p_contract_id and renewal.mode = p_mode
       and renewal.new_end_date = p_new_end_date
       and renewal.new_monthly_rent = coalesce(p_new_monthly_rent, renewal.old_monthly_rent) then
      return jsonb_build_object('renewal', to_jsonb(renewal), 'contract', to_jsonb(old_row),
        'new_contract', (select to_jsonb(c) from public.contracts c where c.id = renewal.new_contract_id),
        'transferred_source_ids', '[]'::jsonb, 'replayed', true);
    end if;
    raise exception 'RENEWAL_OPERATION_MISMATCH' using errcode = '23505';
  end if;

  select * into old_row from public.contracts where id = p_contract_id for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002'; end if;
  if old_row.status <> 'active' then raise exception 'CONTRACT_NOT_ACTIVE' using errcode = '23514'; end if;
  if exists (select 1 from public.contract_checkouts where contract_id = p_contract_id) then
    raise exception 'CONTRACT_CHECKOUT_IN_PROGRESS' using errcode = '23514';
  end if;
  if p_mode not in ('extend', 'new_contract') or (p_new_monthly_rent is not null and (p_new_monthly_rent < 0 or p_new_monthly_rent <> trunc(p_new_monthly_rent)))
     or (p_mode = 'new_contract' and p_new_monthly_rent is null) then
    raise exception 'RENEWAL_END_DATE_INVALID' using errcode = '22008';
  end if;
  v_rent := coalesce(p_new_monthly_rent, old_row.monthly_rent);
```

Replay note: the renewal lookup happens before locking; the unique `operation_id` index prevents a concurrent duplicate insert (the second insert raises a unique violation that the repository maps to `RENEWAL_OPERATION_MISMATCH`-safe 409 `CONTRACT_ALREADY_RENEWED`). The stored `renewal.new_monthly_rent` is the resolved rent, so comparison uses `coalesce(p_new_monthly_rent, renewal.old_monthly_rent)`.

`extend` branch: validate `p_new_end_date > old_row.end_date` else `RENEWAL_END_DATE_INVALID`; `update public.contracts set end_date = p_new_end_date, monthly_rent = v_rent, original_end_date = coalesce(original_end_date, old_row.end_date), renewal_count = renewal_count + 1 where id = old_row.id returning * into new_row;` insert renewal (`contract_id, new_contract_id null, mode, old_end_date, new_end_date, old_monthly_rent, new_monthly_rent, reason, created_by = p_actor_id, operation_id`) `returning * into renewal`; cancel amendments (shared loop below); audit `CONTRACT_RENEWED`.

Shared amendment cancel loop (used by both branches; `p_cancel_reason` is `'Hợp đồng đã được gia hạn'` or `'Hợp đồng đã được gia hạn thành hợp đồng mới'`):

```sql
  for am in select * from public.contract_amendments
            where contract_id = old_row.id and status = 'scheduled' order by id for update loop
    update public.contract_amendments
      set status = 'cancelled', cancelled_by = p_actor_id,
          cancellation_reason = p_cancel_reason, cancelled_at = now()
      where id = am.id;
    insert into public.audit_events (building_id, building_name_snapshot, building_code_snapshot, actor_id,
      action, entity_type, entity_id, correlation_id, before_data, after_data, metadata)
    values (old_row.building_id, v_building_name, v_building_code, p_actor_id,
      'contract.amendment.cancelled', 'contract_amendment', am.id, p_correlation_id,
      am.before_terms, am.after_terms,
      jsonb_build_object('contract_id', old_row.id, 'reason', p_cancel_reason));
  end loop;
```

Before the loop select `v_building_name, v_building_code` from `public.buildings where id = old_row.building_id`. If `enforce_contract_amendment_lifecycle` trigger blocks the contract update while a scheduled amendment exists, run the cancel loop before the contract update in both branches (verify in Step 6).

`new_contract` branch, in the spec order: validate `p_new_end_date > old_row.end_date + 1`; `perform 1 from public.rooms where id = old_row.room_id for update;` `perform 1 from public.contract_occupants where contract_id = old_row.id and move_out_date is null order by id for update;` `perform 1 from public.contract_checkout_sources where contract_id = old_row.id order by id for update;` if `exists (select 1 from public.contracts where previous_contract_id = old_row.id)` raise `CONTRACT_ALREADY_RENEWED` 23505; if no open occupants raise `RENEWAL_OCCUPANTS_MISSING` 23514; capture open occupants into `v_closed_occ` (`jsonb_agg` of `tenant_id, role, billing_counted`), then `update public.contract_occupants set move_out_date = old_row.end_date where contract_id = old_row.id and move_out_date is null;` then `update public.contracts set status = 'renewed' where id = old_row.id;` allocate code like `create_contract_with_handover` (building advisory lock `pg_advisory_xact_lock(hashtextextended(old_row.building_id::text, 1))`, prefix and sequence computed with the same queries as lines 58-79 of `20260626100000_create_contract_with_handover.sql`; copy them), insert the successor with fields listed in the spec, insert occupants from the captured JSON with `move_in_date = old_row.end_date + 1`, clone `contract_services` (`catalog_id, amount, quantity, is_enabled, notes`), transfer sources:

```sql
  with moved as (
    update public.contract_checkout_sources s
       set contract_id = new_row.id, updated_at = clock_timestamp()
     where s.contract_id = old_row.id and public.contract_checkout_source_balance(s.id) > 0
     returning s.id, s.source_type, public.contract_checkout_source_balance(s.id) as balance
  ) select coalesce(jsonb_agg(jsonb_build_object('id', id, 'source_type', source_type, 'balance', balance)), '[]') into v_sources from moved;
```

then insert renewal with `new_contract_id = new_row.id`, cancel amendments, and write audits (`CONTRACT_RENEWED` on old, `CONTRACT_CREATED` on successor with `after_data = to_jsonb(new_row)`, and `CONTRACT_CHECKOUT_SOURCE_TRANSFERRED` only if `jsonb_array_length(v_sources) > 0`) using `p_correlation_id` and null `operation_id`. Return `jsonb_build_object('renewal', to_jsonb(renewal), 'contract', to_jsonb(old_row), 'new_contract', to_jsonb(new_row), 'transferred_source_ids', (select coalesce(jsonb_agg(e->'id'), '[]') from jsonb_array_elements(v_sources) e), 'replayed', false)`.

Footer:
```sql
revoke all on function public.renew_contract_atomic(uuid, text, date, numeric, text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.renew_contract_atomic(uuid, text, date, numeric, text, uuid, uuid, uuid) to service_role;
```

Check `audit_events` for an action CHECK constraint (`grep -n "action" supabase/migrations/20260721160000_expand_audit_event_coverage.sql`); if one exists, extend it with `contract.checkout_source.transferred`.

- [ ] **Step 4: Write `supabase/verification/atomic_contract_renewal.sql`**

A single `begin; ... rollback;` script with a `do $$` block per scenario. Each block builds a fixture (building, room, tenant, active contract, occupants, services, a deposit receipt via `contract_payments` insert) then asserts with `if not (...) then raise exception 'FAIL: <name>'; end if;`. Scenarios exactly as in the spec "Test" section: extend, new_contract with 0/1/n occupants and a disabled service, deposit source transfer plus `contract_checkout_preview` balance equality, replay, operation mismatch, checkout in progress, forced mid-failure (fixture: a unique constraint violation on the services clone, caught with `begin ... exception when others then` and then assert the old contract is still `active`), receipt lock for insert/update/delete, `contract_checkout_credit` accepting a prior-contract `prepaid_rent` receipt. Put the two-session concurrency instructions in a comment header: session A `begin; select public.renew_contract_atomic(...)` without commit, session B calls with another `operation_id` and blocks; after A commits B must raise `CONTRACT_NOT_ACTIVE` or `CONTRACT_ALREADY_RENEWED`.

- [ ] **Step 5: Write `supabase/verification/contract_renewal_integrity.sql`**

Six read-only `select` queries with aliases: `successors_without_primary_occupant`, `renewed_contracts_with_open_occupants`, `renewed_contracts_with_positive_deposit_sources`, `contracts_with_multiple_successors` (must be 0 before the unique index), `successors_with_overlapping_start_date`, and a `has_function_privilege` check that only `service_role` can execute `renew_contract_atomic`.

- [ ] **Step 6: Run tests, then apply the migration to cloud staging**

Run: `npm test -- tests/server/contracts/renewal-migration.test.ts` → PASS.
Ask the user before applying SQL to any cloud database. Run `contract_renewal_integrity.sql` first; stop and report if `contracts_with_multiple_successors` is not 0. After approval, apply the migration and run `atomic_contract_renewal.sql`; every block must pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261105120000_atomic_contract_renewal.sql supabase/verification tests/server/contracts/renewal-migration.test.ts
git commit -m "feat(contracts): add atomic renewal RPC and receipt lock (ZH-CTR-01)"
```

---

### Task 2: Server service, repository, errors, validator

**Files:**
- Modify: `server/services/contract-renewals.ts`, `server/repositories/contract-renewals/index.ts`, `server/utils/errors.ts`, `app/utils/validators/contract-renewals.ts`, `app/utils/constants/audit.ts`, `server/repositories/contract-occupants/index.ts`, `server/repositories/contract-services/index.ts`
- Test: `tests/server/contracts/renewal-service.test.ts`, `tests/server/contracts/renewal-errors.test.ts`, `tests/server/contracts/validators.test.ts`

**Interfaces:**
- Consumes: RPC from Task 1.
- Produces: `ContractRenewalRepository.renewAtomic(event, args: RenewAtomicArgs): Promise<RenewAtomicResult>`:
```ts
export interface RenewAtomicArgs {
  contractId: string
  mode: 'extend' | 'new_contract'
  newEndDate: string
  newMonthlyRent: number | null
  reason: string | null
  actorId: string
  operationId: string
  correlationId: string
}
export interface RenewAtomicResult { renewal: ContractRenewal; newContractId: string | null; transferredSourceIds: string[]; replayed: boolean }
```
- Produces: `contractRenewSchema` accepts `operation_id?: string (uuid)` on both modes. `AUDIT_ACTIONS.CONTRACT_CHECKOUT_SOURCE_TRANSFERRED = 'contract.checkout_source.transferred'`.
- Produces: `throwDbError` maps `CONTRACT_NOT_FOUND`→404 `NOT_FOUND`, `CONTRACT_NOT_ACTIVE|CONTRACT_CHECKOUT_IN_PROGRESS|CONTRACT_ALREADY_RENEWED|RENEWAL_OPERATION_MISMATCH|RENEWAL_OCCUPANTS_MISSING|CONTRACT_RENEWED_RECEIPT_LOCKED`→409 `CONFLICT` with `{ reason }`, `RENEWAL_END_DATE_INVALID`→422 `VALIDATION_ERROR`, all with the Vietnamese messages of the spec table. Postgres `23505` on `contracts_one_active_per_room` or `contracts_one_successor` maps to 409 `CONTRACT_ALREADY_RENEWED`.

- [ ] **Step 1: Write failing tests**

`renewal-errors.test.ts`: for each code in the spec table, call `throwDbError({ message: code }, 'x')` inside `expect(() => ...).toThrow()` and assert `statusCode` plus `data.error.message`; also `{ code: '23505', message: 'duplicate key value violates unique constraint "contracts_one_successor"' }` → 409 with `reason: 'CONTRACT_ALREADY_RENEWED'`; and a plain `CHECKOUT_X` message still maps to the existing checkout conflict.

`renewal-service.test.ts` (mock `ContractRepository.findById`, `ContractRenewalRepository.renewAtomic`, `assertBuildingScope`, `can`; follow `tests/server/contracts/service.test.ts` for the stubbing pattern): (a) no `contracts.update` → 403 and `renewAtomic` not called; (b) scope failure → no RPC; (c) happy path passes `contractId = contract.id` (canonical), `actorId = user.id`, `operationId = input.operation_id`, a UUID `correlationId`, `newMonthlyRent = input.new_monthly_rent ?? null`; (d) missing `operation_id` → service generates a UUID; (e) returns the renewal DTO.

Validator test: `contractRenewSchema.parse({ mode: 'extend', new_end_date: '2027-01-01', operation_id: crypto.randomUUID() })` succeeds; a non-UUID `operation_id` fails.

- [ ] **Step 2: Run** `npm test -- tests/server/contracts/renewal-service.test.ts tests/server/contracts/renewal-errors.test.ts tests/server/contracts/validators.test.ts` → expected FAIL.

- [ ] **Step 3: Implement**

Validator: add `operation_id: z.string().uuid().optional()` to both union members. Audit constant: add `CONTRACT_CHECKOUT_SOURCE_TRANSFERRED`, plus the display label/enrichment where `CONTRACT_RENEWED` is handled (`grep -rn CONTRACT_RENEWED app server`).

Repository:

```ts
async renewAtomic(event: H3Event, args: RenewAtomicArgs): Promise<RenewAtomicResult> {
  const client = serverSupabaseClient(event)
  const { data, error } = await client.rpc('renew_contract_atomic', {
    p_contract_id: args.contractId,
    p_mode: args.mode,
    p_new_end_date: args.newEndDate,
    p_new_monthly_rent: args.newMonthlyRent,
    p_reason: args.reason,
    p_actor_id: args.actorId,
    p_operation_id: args.operationId,
    p_correlation_id: args.correlationId,
  })
  if (error) throwDbError(error, 'contractRenewals.renewAtomic')
  const result = data as { renewal: Tables<'contract_renewals'>; new_contract: { id: string } | null; transferred_source_ids: string[]; replayed: boolean }
  return {
    renewal: mapContractRenewal(result.renewal),
    newContractId: result.new_contract?.id ?? null,
    transferredSourceIds: result.transferred_source_ids,
    replayed: result.replayed,
  }
}
```

(Until `database.types.ts` is regenerated, cast the rpc call through the existing pattern used by amendments repository: see `server/repositories/contract-amendments`.) Remove `insert`/`deleteById` if unused (`grep -rn "ContractRenewalRepository\.\(insert\|deleteById\)"`).

Service `renew`:

```ts
async renew(event, user, contractId, input): Promise<ContractRenewal> {
  if (!can(user, 'contracts.update')) throwForbidden('Không có quyền gia hạn hợp đồng')
  const contract = await ContractRepository.findById(event, contractId)
  if (!contract) throwNotFound('Không tìm thấy hợp đồng')
  await assertBuildingScope(event, user, contract.buildingId, 'write')
  const result = await ContractRenewalRepository.renewAtomic(event, {
    contractId: contract.id,
    mode: input.mode,
    newEndDate: input.new_end_date,
    newMonthlyRent: input.new_monthly_rent ?? null,
    reason: input.reason ?? null,
    actorId: user.id,
    operationId: input.operation_id ?? randomUUID(),
    correlationId: randomUUID(),
  })
  return result.renewal
}
```

Delete unused imports (`serverSupabaseClient`, `AuditService`, `AUDIT_ACTIONS`, `ContractAmendmentService`, service/occupant repos). Remove `cloneActiveToContract` and `cloneFromContract` (and their tests, if any) since `grep` shows only the renewal service used them.

`throwDbError`: add a `RENEWAL_ERRORS` map keyed by code with `{ status, message }`, check `^(CONTRACT|RENEWAL)_[A-Z_]+$` messages against it, and check `error.code === '23505'` with `/contracts_one_(active_per_room|successor)/` in `message` to produce `CONTRACT_ALREADY_RENEWED`. Keep the existing `CHECKOUT_` branch first.

- [ ] **Step 4: Run the Step 2 command again** → PASS. Then `npm run typecheck` (expect no new errors).

- [ ] **Step 5: Commit**

```bash
git add server app/utils tests/server/contracts
git commit -m "feat(contracts): route renewal through atomic RPC (ZH-CTR-01)"
```

---

### Task 3: Receipt lock in service, contract chain DTO, checkout source origin

**Files:**
- Modify: `server/services/contract-payments.ts`, `server/repositories/contracts/index.ts`, `app/types/contracts.ts`, `app/utils/mappers/contracts.ts`, `app/types/checkout.ts`
- Test: `tests/server/contracts/payments-renewed-lock.test.ts`, `tests/utils/contracts-mapper-chain.test.ts`

**Interfaces:**
- Produces: `ContractWithDetails.previousContract: { id: string; code: string } | null` and `successorContract: { id: string; code: string } | null`; `CheckoutSource.originContractId: string; originContractCode: string`.

- [ ] **Step 1: Write failing tests.** Payments: with `contract.status === 'renewed'`, `create`, `update`, `remove` each reject with 409 and message `Hợp đồng đã gia hạn, không thể thay đổi khoản thu`, and the repository mocks are not called. Mapper: `mapContractWithDetails` with `previous_contract: { id, contract_code }` and `successor: { id, contract_code }` yields the two objects; absent values yield `null`.
- [ ] **Step 2: Run both files** → FAIL.
- [ ] **Step 3: Implement.** In `ContractPaymentService`, after `assertBuildingScope` in `create`/`update`/`remove` add `if (contract.status === 'renewed') throwConflict('Hợp đồng đã gia hạn, không thể thay đổi khoản thu')`. Extend `DETAIL_SELECT` in the contract repository with the previous contract (`previous_contract:contracts!contracts_previous_contract_id_fkey(id, contract_code)`; confirm the FK name with `grep -n previous_contract_id supabase/migrations/*.sql`) and a second query `findSuccessor(event, contractId)` merged in `findById`/`findByIdentifier` (a self-referencing reverse relation is ambiguous in PostgREST, so use one extra `select('id, contract_code').eq('previous_contract_id', id).maybeSingle()`). Update mapper and DTOs; add the two fields to `CheckoutSource`.
- [ ] **Step 4: Run both files** → PASS; run `npm test -- tests/server/contracts` to check regressions.
- [ ] **Step 5: Commit** `feat(contracts): lock renewed receipts and expose renewal chain`.

---

### Task 4: UI

**Files:**
- Modify: `ContractRenewalForm.vue`, `ContractDetailHero.vue`, `ContractPaymentsSection.vue`, `ContractCheckoutSection.vue`, `app/pages/dashboard/contracts/[code]/index.vue`, `app/composables/contracts/useContractRenewals.ts`
- Test: `tests/components/contracts/renewal.test.ts`

**Interfaces:**
- `ContractRenewalForm` new optional props `occupantCount?: number`, `serviceCount?: number`, `depositHeld?: number`; still emits `submit` with `ContractRenewInput` now including `operation_id`.

- [ ] **Step 1: Read** `.agents/skills/zeno-house/references/ui-polish-workflow.md`, then `frontend-design` and `hallmark` skills fully (scope: narrow edit to an existing flow, keep direction).
- [ ] **Step 2: Write failing component tests** (pattern: `tests/components/contracts/checkout.test.ts`): (a) form in `new_contract` mode shows `Hợp đồng mới bắt đầu: ` plus `currentEndDate + 1` formatted `vi-VN`, and a summary with counts and `formatCurrency(depositHeld)`; (b) a `new_end_date` equal to `currentEndDate + 1` or earlier is rejected with an inline error; (c) two submits (simulating retry after error) emit the same `operation_id`, which is a UUID; (d) while `loading`, mode buttons and submit are disabled; (e) `apiError` renders in `UiAlert`; (f) `ContractPaymentsSection` with a `renewed` contract renders no add/edit/delete controls and shows `Hợp đồng đã gia hạn. Tiền cọc đang giữ đã chuyển sang HĐ <code>.`; (g) `ContractDetailHero` shows `Đã gia hạn sang HĐ <code>` link for renewed and `Gia hạn từ HĐ <code>` for a successor; (h) `ContractCheckoutSection` shows `Từ HĐ <code>` when `originContractId !== contractId`.
- [ ] **Step 3: Run** `npm test -- tests/components/contracts/renewal.test.ts` → FAIL.
- [ ] **Step 4: Implement.** `operation_id = crypto.randomUUID()` created once in form setup (not per submit). In `new_contract` mode validation uses `form.new_end_date <= addDays(currentEndDate, 1)` with a helper in `app/utils/format` if no date helper exists (check first with `grep -rn "addDays" app/utils`). The page passes counts from already-loaded occupants/services and `deposit` from the contract. Surface API errors through the existing error-message helper (`grep -rn "getApiErrorMessage\|apiErrorMessage" app/utils`) instead of generic strings in `ContractPaymentsSection`. Only existing primitives and tokens.
- [ ] **Step 5: Run** the test file → PASS; `npm run lint`.
- [ ] **Step 6: Visual check** on a running dev server (ask the user first if one is not already running): renewal modal both modes, error state, submitting state, renewed and successor detail pages, desktop and mobile widths. Fix issues found.
- [ ] **Step 7: Commit** `feat(contracts): clarify renewal flow and chain links`.

---

### Task 5: Legacy data scripts, docs, OKF, full verification

**Files:**
- Create: `supabase/sql-editor/repair-contract-renewal-chains.sql`
- Modify: `docs/features/contracts.md`, `docs/architecture/database.md`, `docs/changes/add-contract-amendments/tasks.md`, any matching `docs/capabilities/contracts*.md` requirement for renewal

- [ ] **Step 1: Write the repair script.** One `begin;` transaction, one shared `correlation_id`, per chain: find the latest `active` successor, close open occupants of `renewed` contracts at their own `end_date` (`raise notice` per row), insert missing occupants on the latest successor when the tenant has no open occupancy, move sources with balance > 0 to the latest successor, write audit `CONTRACT_RENEWAL_REPAIRED` (`contract.renewal.repaired`; extend the audit action constraint if one exists). It never touches `start_date` or billing data. End with reconciliation `select`s and `rollback;` (comment says switch to `commit;` after review).
- [ ] **Step 2: Docs.** `docs/features/contracts.md`: inclusive-date convention, atomic renewal behavior, deposit transfer, idempotency, receipt lock. `docs/architecture/database.md`: RPC, `contracts_one_successor`, `contract_payments_renewed_lock`. Mark task 2.3 done in `docs/changes/add-contract-amendments/tasks.md`. Update the renewal requirement in the matching OKF spec; run `npm run knowledge:check`.
- [ ] **Step 3: Regenerate types.** After staging migration is applied, regenerate `app/types/database.types.ts` with the project's documented command (see `docs/architecture/database.md`); never hand-edit. Replace any cast workaround from Task 2.
- [ ] **Step 4: Full verification.** `npm test`, `npm run typecheck`, `npm run lint`, `npm run knowledge:check`. All green.
- [ ] **Step 5: Commit** `docs(contracts): document atomic renewal and add repair script`.

---

## Self-Review

- Spec coverage: schema/RPC/errors/replay/lock order (Task 1), checkout and receipt changes (Task 1), service/repo/errors/validator/cleanup (Task 2), receipt service lock, DTOs (Task 3), UI (Task 4), legacy data, docs, OKF (Task 5), tests including SQL fixtures and concurrency (Tasks 1-4).
- Ordering risk: the app code in Task 2 calls an RPC that only exists after the migration is applied. Deploy the migration to the target environment before the server code; do not merge Task 2 to a branch that auto-deploys first.
- Type names are consistent across tasks: `renewAtomic`, `RenewAtomicArgs`, `RenewAtomicResult`, `previousContract`, `successorContract`, `originContractId`, `originContractCode`, `operation_id`.
