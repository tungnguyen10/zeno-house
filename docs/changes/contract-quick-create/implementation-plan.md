---
type: Change Implementation Plan
title: "contract-quick-create-implementation-plan"
status: draft
change_state: plan-review
tags: [superpowers, change, contracts, v2]
---

# Contract Quick Create (V2 PR4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a contract with handover, inventory, roommates, vehicles and services in one idempotent transaction from a shortened, skippable wizard prefilled with building defaults.

**Architecture:** New table `contract_vehicles` and RPC `create_contract_full` wrapping PR2's `create_contract_with_handover_and_inventory`. `ContractService.create` keeps pre-checks, calls the RPC, audits after commit. The wizard gains Handover and Confirm steps; step 3 (roommates, vehicles, services) is optional and kept client-side until submit.

**Tech Stack:** Nuxt 3, Vue 3, Zod, Vitest, Supabase RPC, PL/pgSQL.

**Spec:** [design.md](./design.md)

**Prerequisites merged:** PR0, PR1 (contract profile endpoint), PR2 (`create_contract_with_handover_and_inventory`, inventory UI in `ContractForm`), PR3 (`TenantPicker`, `ContractOccupantForm` emitting `tenantName`).

## Global Constraints

- Do not modify existing RPCs; add `create_contract_full`.
- New table/function: RLS on, no policies, revoke from `public, anon, authenticated`, grant `service_role`; functions `security invoker`, `set search_path = ''`.
- Idempotency key `contract.create:<request_id>`; replay only for the same actor.
- Limits: occupants ≤ 10, vehicles ≤ 10; plate number normalized `toUpperCase()`, internal whitespace collapsed to one space, trimmed; 1–20 chars.
- No tenant PII in drafts (only `tenant_id`, `tenantName`).
- Vietnamese copy with full diacritics; UI per `.agents/skills/zeno-house/references/ui-polish-workflow.md` with `frontend-design` + Hallmark; new tokens/primitives only after evaluation + approval.
- Cloud migration and type regeneration are separate gates; deploy app after migration.

## Review Focus

1. **Roommate already living elsewhere** — whole create rolls back; no orphan contract/readings/inventory. Pinned in Task 1 (SQL) and Task 3 (error mapping).
2. **Retry after lost response** — same `request_id` returns the existing contract, no second contract. Pinned in Task 1 and Task 5.
3. **User edits end date, then changes start date** — prefill must not overwrite the edited end date. Pinned in Task 4.
4. **`p_services` omitted** — services copied from building, matching old `cloneFromBuilding`. Pinned in Task 1.
5. **Draft restored mid-wizard with vehicles/services** — restored without tenant PII. Pinned in Task 5.

---

### Task 1: Migration — `contract_vehicles` + `create_contract_full`

**Files:**
- Create: `supabase/migrations/20261111120000_contract_quick_create.sql`
- Create: `supabase/verification/contract_quick_create.sql`
- Test: `tests/config/contract-quick-create-migration.test.ts`

**Interfaces:**
- `public.create_contract_full(p_contract jsonb, p_inventory jsonb, p_occupants jsonb, p_vehicles jsonb, p_services jsonb, p_actor_id uuid, p_request_id uuid) returns jsonb` → `{ contract_id, replayed }`.
- `p_contract` keys: `room_id, tenant_id, building_id, start_date, end_date, monthly_rent, deposit, payment_due_day, occupant_count, discount_amount, surcharge_amount, status, notes, handover_electricity_reading, handover_water_reading, handover_reading_date, recorded_by`.
- `p_occupants[]`: `{ tenant_id, move_in_date, billing_counted }`; `p_vehicles[]`: `{ owner_name, plate_number, vehicle_type, note }`; `p_services`: `null` or `[{ catalog_id, amount, quantity, is_enabled, notes }]`.
- Errors: `CONTRACT_CREATE_REQUEST_REQUIRED` (22023), `CONTRACT_CREATE_REQUEST_CONFLICT` (23505), `CONTRACT_OCCUPANT_LIMIT` (23514), `CONTRACT_OCCUPANT_PRIMARY` (23514), `CONTRACT_OCCUPANT_BUSY` (23505), `CONTRACT_SERVICE_INVALID` (23514), `CONTRACT_VEHICLE_DUPLICATE` (23505).

- [ ] **Step 1: Write the failing static test**

```ts
// tests/config/contract-quick-create-migration.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111120000_contract_quick_create.sql'), 'utf8')

describe('contract quick create migration', () => {
  it('creates contract_vehicles locked to service_role', () => {
    expect(sql).toContain('create table if not exists public.contract_vehicles')
    expect(sql).toContain('alter table public.contract_vehicles enable row level security;')
    expect(sql).toContain('revoke all on table public.contract_vehicles from public, anon, authenticated;')
  })

  it('wraps the PR2 function without redefining existing RPCs', () => {
    expect(sql).toContain('public.create_contract_with_handover_and_inventory(')
    expect(sql).not.toMatch(/function public\.create_contract_with_handover(_and_inventory)?\(/)
  })

  it('uses namespaced idempotency key and service_role grant', () => {
    expect(sql).toContain(`'contract.create:' || p_request_id::text`)
    expect(sql).toContain('grant execute on function public.create_contract_full(jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid) to service_role;')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Write the migration**

```sql
-- =============================================================================
-- Contract quick create (V2 PR4a)
-- =============================================================================
-- contract_vehicles + create_contract_full (contract, handover, inventory,
-- roommates, vehicles, services, room status) in one transaction.
-- Requires PR2 (create_contract_with_handover_and_inventory).
-- Data impact: ADDITIVE ONLY.
-- =============================================================================

create table if not exists public.contract_vehicles (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  owner_name text not null check (length(trim(owner_name)) between 1 and 100),
  plate_number text not null check (length(plate_number) between 1 and 20),
  vehicle_type text check (vehicle_type is null or length(vehicle_type) <= 50),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_vehicles_plate_uq unique (contract_id, plate_number)
);

drop trigger if exists contract_vehicles_set_updated_at on public.contract_vehicles;
create trigger contract_vehicles_set_updated_at
  before update on public.contract_vehicles
  for each row execute function public.set_updated_at();

alter table public.contract_vehicles enable row level security;
revoke all on table public.contract_vehicles from public, anon, authenticated;
grant select, insert, update, delete on table public.contract_vehicles to service_role;

create or replace function public.create_contract_full(
  p_contract jsonb,
  p_inventory jsonb,
  p_occupants jsonb,
  p_vehicles jsonb,
  p_services jsonb,
  p_actor_id uuid,
  p_request_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_op public.audit_operations%rowtype;
  v_contract public.contracts%rowtype;
  v_occupant_count integer;
  v_roommates integer := coalesce(jsonb_array_length(p_occupants), 0);
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'CONTRACT_CREATE_REQUEST_REQUIRED' using errcode = '22023';
  end if;
  v_key := 'contract.create:' || p_request_id::text;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.entity_id is null then
      raise exception 'CONTRACT_CREATE_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('contract_id', v_op.entity_id, 'replayed', true);
  end if;

  v_occupant_count := coalesce((p_contract->>'occupant_count')::integer, 1);
  if 1 + v_roommates > v_occupant_count then
    raise exception 'CONTRACT_OCCUPANT_LIMIT' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_occupants, '[]'::jsonb)) o
    where (o->>'tenant_id')::uuid = (p_contract->>'tenant_id')::uuid
  ) then
    raise exception 'CONTRACT_OCCUPANT_PRIMARY' using errcode = '23514';
  end if;

  select * into v_contract from public.create_contract_with_handover_and_inventory(
    (p_contract->>'room_id')::uuid,
    (p_contract->>'tenant_id')::uuid,
    (p_contract->>'building_id')::uuid,
    (p_contract->>'start_date')::date,
    (p_contract->>'end_date')::date,
    (p_contract->>'monthly_rent')::numeric,
    coalesce((p_contract->>'deposit')::numeric, 0),
    (p_contract->>'payment_due_day')::smallint,
    v_occupant_count,
    coalesce((p_contract->>'discount_amount')::numeric, 0),
    coalesce((p_contract->>'surcharge_amount')::numeric, 0),
    coalesce(p_contract->>'status', 'active'),
    p_contract->>'notes',
    (p_contract->>'handover_electricity_reading')::numeric,
    (p_contract->>'handover_water_reading')::numeric,
    (p_contract->>'handover_reading_date')::date,
    (p_contract->>'recorded_by')::uuid,
    p_inventory
  );

  begin
    insert into public.contract_occupants (contract_id, tenant_id, role, move_in_date, billing_counted)
    select v_contract.id, (o->>'tenant_id')::uuid, 'roommate',
           coalesce((o->>'move_in_date')::date, v_contract.start_date),
           coalesce((o->>'billing_counted')::boolean, true)
    from jsonb_array_elements(coalesce(p_occupants, '[]'::jsonb)) o;
  exception when unique_violation then
    raise exception 'CONTRACT_OCCUPANT_BUSY' using errcode = '23505';
  end;

  begin
    insert into public.contract_vehicles (contract_id, owner_name, plate_number, vehicle_type, note, sort_order)
    select v_contract.id, v->>'owner_name', v->>'plate_number', v->>'vehicle_type', v->>'note', (ord - 1)::integer
    from jsonb_array_elements(coalesce(p_vehicles, '[]'::jsonb)) with ordinality as e(v, ord);
  exception when unique_violation then
    raise exception 'CONTRACT_VEHICLE_DUPLICATE' using errcode = '23505';
  end;

  if p_services is null then
    insert into public.contract_services (contract_id, catalog_id, amount, quantity, is_enabled)
    select v_contract.id, bs.catalog_id, bs.default_amount, 1, true
    from public.building_services bs
    where bs.building_id = v_contract.building_id and bs.is_active;
  else
    if exists (
      select 1 from jsonb_array_elements(p_services) s
      where not exists (
        select 1 from public.building_services bs
        where bs.building_id = v_contract.building_id and bs.catalog_id = (s->>'catalog_id')::uuid
      )
    ) then
      raise exception 'CONTRACT_SERVICE_INVALID' using errcode = '23514';
    end if;
    insert into public.contract_services (contract_id, catalog_id, amount, quantity, is_enabled, notes)
    select v_contract.id, (s->>'catalog_id')::uuid, (s->>'amount')::numeric,
           coalesce((s->>'quantity')::integer, 1), coalesce((s->>'is_enabled')::boolean, true), s->>'notes'
    from jsonb_array_elements(p_services) s;
  end if;

  if v_contract.status = 'active' then
    update public.rooms set status = 'occupied' where id = v_contract.room_id;
  end if;

  insert into public.audit_operations (
    idempotency_key, actor_id, building_id, action, entity_type, entity_id, intent_data, status, completed_at
  ) values (
    v_key, p_actor_id, v_contract.building_id, 'contract.create', 'contract', v_contract.id,
    jsonb_build_object('occupants', v_roommates, 'vehicles', coalesce(jsonb_array_length(p_vehicles), 0)),
    'completed', now()
  );

  return jsonb_build_object('contract_id', v_contract.id, 'replayed', false);
end;
$$;

revoke all on function public.create_contract_full(jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_contract_full(jsonb, jsonb, jsonb, jsonb, jsonb, uuid, uuid) to service_role;
```

Verify `contract_occupants` has no extra required columns beyond those inserted (check latest migrations touching it); `rooms.status` update matches what `RoomRepository.update` did. Confirm `contract_services` grants allow `service_role` (RLS bypass) — yes for service role.

- [ ] **Step 4: Write the verification script** (`begin; … rollback;`): create a throwaway building/room/tenants via PR0/PR2 RPCs and plain inserts; then check:
  1. Happy path with 1 roommate, 1 vehicle, `p_services = null` → contract, 2 readings, inventory rows, occupant, vehicle, services copied, room `occupied`.
  2. Replay same actor → same `contract_id`, counts unchanged; other actor → `CONTRACT_CREATE_REQUEST_CONFLICT`.
  3. Roommate who is an active occupant elsewhere → `CONTRACT_OCCUPANT_BUSY` and **no** new contract/readings/inventory rows.
  4. `occupant_count = 1` with 1 roommate → `CONTRACT_OCCUPANT_LIMIT`.
  5. Unknown `catalog_id` → `CONTRACT_SERVICE_INVALID`, rolled back.
  6. Grants: anon/authenticated false, service_role true.

Follow the structure of `supabase/verification/inventory_lite.sql` (PR2): `do $$ … raise exception 'VERIFY n failed' … $$;` blocks and a final grants `select`.

- [ ] **Step 5: Run static test** → PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261111120000_contract_quick_create.sql supabase/verification/contract_quick_create.sql tests/config/contract-quick-create-migration.test.ts
git commit -m "feat(db): contract_vehicles and atomic create_contract_full"
```

---

### Task 2: Validators — vehicles, occupants, services, request id

**Files:**
- Create: `app/utils/validators/contract-vehicles.ts`
- Modify: `app/utils/validators/contracts.ts`
- Test: `tests/utils/contract-quick-create-validators.test.ts`

**Interfaces:**
- `normalizePlate(value: string): string`
- `contractVehicleInputSchema` `{ owner_name, plate_number, vehicle_type, note }`; `contractVehicleListSchema` (≤ 10, unique plates after normalization).
- `contractCreateSchema` adds `request_id: z.string().uuid()` (required), `occupants: z.array({ tenant_id: uuid, move_in_date?: string, billing_counted: boolean default true }).max(10).optional()` with unique `tenant_id` and not equal to `tenant_id`, `vehicles: contractVehicleListSchema.optional()`, `services: z.array({ catalog_id: uuid, amount: int ≥ 0, quantity: int ≥ 0, is_enabled: boolean, notes: string ≤ 200 | null }).optional()` with unique `catalog_id`. Keep `.strict()` and existing refine.

- [ ] **Step 1: Write failing tests**

```ts
// tests/utils/contract-quick-create-validators.test.ts
import { describe, expect, it } from 'vitest'
import { contractVehicleListSchema, normalizePlate } from '~/utils/validators/contract-vehicles'
import { contractCreateSchema } from '~/utils/validators/contracts'

const U = (n: number) => `7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6${n}`
const base = {
  request_id: U(0), room_id: U(1), tenant_id: U(2), start_date: '2026-12-01', end_date: '2027-11-30',
  monthly_rent: 3_000_000, handover_electricity_reading: 1, handover_water_reading: 1,
}

describe('vehicles', () => {
  it('normalizes plates', () => {
    expect(normalizePlate('  59x1  123.45 ')).toBe('59X1 123.45')
  })

  it('rejects duplicate plates after normalization', () => {
    const r = contractVehicleListSchema.safeParse([
      { owner_name: 'A', plate_number: '59x1 12345' }, { owner_name: 'B', plate_number: '59X1  12345' },
    ])
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.path).toEqual([1, 'plate_number'])
  })

  it('caps at 10', () => {
    const list = Array.from({ length: 11 }, (_, i) => ({ owner_name: 'A', plate_number: `P${i}` }))
    expect(contractVehicleListSchema.safeParse(list).success).toBe(false)
  })
})

describe('contractCreateSchema (PR4a)', () => {
  it('requires request_id', () => {
    const { request_id: _omit, ...rest } = base
    expect(contractCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects roommate equal to primary tenant', () => {
    expect(contractCreateSchema.safeParse({ ...base, occupants: [{ tenant_id: U(2) }] }).success).toBe(false)
  })

  it('rejects duplicate roommates and duplicate service catalog ids', () => {
    expect(contractCreateSchema.safeParse({ ...base, occupants: [{ tenant_id: U(3) }, { tenant_id: U(3) }] }).success).toBe(false)
    const svc = { catalog_id: U(4), amount: 100000, quantity: 1, is_enabled: true, notes: null }
    expect(contractCreateSchema.safeParse({ ...base, services: [svc, svc] }).success).toBe(false)
  })

  it('accepts a full payload', () => {
    expect(contractCreateSchema.safeParse({
      ...base,
      occupants: [{ tenant_id: U(3), move_in_date: '2026-12-01', billing_counted: true }],
      vehicles: [{ owner_name: 'A', plate_number: '59X1 12345', vehicle_type: 'Xe máy', note: null }],
      services: [{ catalog_id: U(4), amount: 100000, quantity: 1, is_enabled: true, notes: null }],
    }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// app/utils/validators/contract-vehicles.ts
import { z } from 'zod'

export const CONTRACT_VEHICLE_MAX = 10

export function normalizePlate(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const contractVehicleInputSchema = z.object({
  owner_name: z.string().trim().min(1, 'Tên chủ xe không được trống').max(100, 'Tên chủ xe quá dài'),
  plate_number: z.string().transform(normalizePlate).pipe(z.string().min(1, 'Biển số không được trống').max(20, 'Biển số quá dài')),
  vehicle_type: z.preprocess(blankToNull, z.string().trim().max(50, 'Loại xe quá dài').nullable().default(null)),
  note: z.preprocess(blankToNull, z.string().trim().max(200, 'Ghi chú quá dài').nullable().default(null)),
})

export const contractVehicleListSchema = z.array(contractVehicleInputSchema)
  .max(CONTRACT_VEHICLE_MAX, `Tối đa ${CONTRACT_VEHICLE_MAX} xe`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      if (seen.has(item.plate_number)) {
        ctx.addIssue({ code: 'custom', path: [index, 'plate_number'], message: `Biển số ${item.plate_number} bị trùng` })
      }
      seen.add(item.plate_number)
    })
  })

export type ContractVehicleInput = z.infer<typeof contractVehicleInputSchema>
```

In `contracts.ts`, add to the create object (before `.strict()`):

```ts
  request_id: z.string().uuid('Mã yêu cầu không hợp lệ'),
  occupants: z.array(z.object({
    tenant_id: z.string().uuid('Khách không hợp lệ'),
    move_in_date: z.string().min(1).optional(),
    billing_counted: z.boolean().default(true),
  })).max(10, 'Tối đa 10 người ở cùng').optional(),
  vehicles: contractVehicleListSchema.optional(),
  services: z.array(z.object({
    catalog_id: z.string().uuid(),
    amount: z.number().int().min(0, 'Đơn giá không được âm'),
    quantity: z.number().int().min(0, 'Số lượng không được âm'),
    is_enabled: z.boolean(),
    notes: z.string().max(200, 'Ghi chú quá dài').nullable(),
  })).optional(),
```

and chain an extra `.superRefine` after the existing `.refine`:

```ts
.superRefine((data, ctx) => {
  const ids = new Set<string>()
  data.occupants?.forEach((o, i) => {
    if (o.tenant_id === data.tenant_id) ctx.addIssue({ code: 'custom', path: ['occupants', i, 'tenant_id'], message: 'Người ở cùng trùng với khách đứng tên' })
    if (ids.has(o.tenant_id)) ctx.addIssue({ code: 'custom', path: ['occupants', i, 'tenant_id'], message: 'Người ở cùng bị trùng' })
    ids.add(o.tenant_id)
  })
  const cat = new Set<string>()
  data.services?.forEach((s, i) => {
    if (cat.has(s.catalog_id)) ctx.addIssue({ code: 'custom', path: ['services', i, 'catalog_id'], message: 'Dịch vụ bị trùng' })
    cat.add(s.catalog_id)
  })
})
```

`request_id` being required changes existing callers: update every `submitCreate`/`contractCreateSchema` test fixture to include `request_id` (grep `contractCreateSchema` and `handover_electricity_reading:` in `tests/`).

- [ ] **Step 4: Run tests** (new + all contract tests) → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/validators/contract-vehicles.ts app/utils/validators/contracts.ts tests
git commit -m "feat(contracts): validators for atomic create with vehicles"
```

---

### Task 3: Repository + service `create` via `create_contract_full`; vehicles API

**Files:**
- Modify: `server/repositories/contracts/index.ts` (replace `createWithHandover` usage with `createFull`)
- Create: `server/repositories/contract-vehicles.ts`
- Modify: `server/services/contracts/index.ts` (`create`, add `getVehicles`, `saveVehicles`)
- Create: `server/api/contracts/[id]/vehicles.get.ts`, `vehicles.put.ts`
- Modify: `app/utils/constants/audit.ts` (`CONTRACT_VEHICLES_UPDATED: 'contract.vehicles.updated'`)
- Create: `app/types/contract-vehicles.ts`, `app/utils/mappers/contract-vehicles.ts`
- Test: extend `tests/server/contracts.api.test.ts`; create `tests/server/contracts/contract-vehicles.api.test.ts`

**Interfaces:**
- `ContractRepository.createFull(event, payload: { contract: Record<string, unknown>; inventory: InventoryItemInput[]; occupants: …; vehicles: ContractVehicleInput[]; services: … | null }, opts: { actorId: string; requestId: string }): Promise<{ contract: ContractWithDetails; replayed: boolean }>`
- `ContractVehicleRepository.list(event, contractId)`, `.replace(event, contractId, items)`
- `ContractVehicle` DTO `{ id, ownerName, plateNumber, vehicleType, note, sortOrder }`
- Error mapping table:

| RPC message | HTTP | Message |
| --- | --- | --- |
| `CONTRACT_CREATE_REQUEST_CONFLICT` | 409 | Yêu cầu tạo hợp đồng bị trùng với một thao tác khác. Vui lòng tải lại trang. |
| `CONTRACT_OCCUPANT_LIMIT` | 409 | Số người ở cùng vượt quá số người ở của hợp đồng. |
| `CONTRACT_OCCUPANT_PRIMARY` | 422 | Người ở cùng trùng với khách đứng tên. |
| `CONTRACT_OCCUPANT_BUSY` | 409 | Có người ở cùng đang ở theo hợp đồng khác. |
| `CONTRACT_SERVICE_INVALID` | 422 | Dịch vụ không thuộc tòa nhà này. |
| `CONTRACT_VEHICLE_DUPLICATE` | 409 | Biển số xe bị trùng. |

- [ ] **Step 1: Write failing tests** (extend `contracts.api.test.ts`; add `createFull: vi.fn()` to `contractRepoMocks`, remove reliance on `createWithHandover` and `contractServicesMocks.cloneFromBuilding` in create tests):

```ts
it('creates everything through createFull with request id and audits', async () => {
  contractRepoMocks.createFull.mockResolvedValue({ contract: buildContract({ id: 'c-1' }), replayed: false })
  await handler(makeEvent({ body: { ...validCreateBody, occupants: [{ tenant_id: OTHER_TENANT }], vehicles: [{ owner_name: 'A', plate_number: '59x1 12345' }] } }))
  const [, payload, opts] = contractRepoMocks.createFull.mock.calls[0]!
  expect(opts).toEqual({ actorId: expect.any(String), requestId: validCreateBody.request_id })
  expect(payload.vehicles[0].plate_number).toBe('59X1 12345')
  expect(payload.services).toBeNull()
  expect(contractServicesMocks.cloneFromBuilding).not.toHaveBeenCalled()
  expect(roomRepoMocks.update).not.toHaveBeenCalled()
})

it('does not audit on replay', async () => {
  contractRepoMocks.createFull.mockResolvedValue({ contract: buildContract({ id: 'c-1' }), replayed: true })
  await handler(makeEvent({ body: validCreateBody }))
  expect(auditAppendSpy).not.toHaveBeenCalled()
})
```

(Use the file's existing names for the body fixture, contract builder and audit spy; add `request_id` to `validCreateBody`.)

```ts
// tests/server/contracts/contract-vehicles.api.test.ts — covers GET/PUT vehicles:
// - manager with contracts.update in scope can PUT; without contracts.update → 403
// - PUT normalizes plates and rejects duplicates with 422
// - audit metadata { count }
```

Write these three cases fully following the pattern of `tests/server/inventory/inventory-api.test.ts` (PR2).

Add an error-mapping unit test for `throwContractCreateError` covering every row in the table above.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

Repository `createFull`:

```ts
  async createFull(
    event: H3Event,
    payload: {
      contract: Record<string, unknown>
      inventory: InventoryItemInput[]
      occupants: { tenant_id: string; move_in_date?: string; billing_counted: boolean }[]
      vehicles: ContractVehicleInput[]
      services: ContractCreateInput['services'] | null
    },
    opts: { actorId: string; requestId: string },
  ): Promise<{ contract: ContractWithDetails; replayed: boolean }> {
    const { data, error } = await serverSupabaseClient(event).rpc('create_contract_full' as never, {
      p_contract: payload.contract,
      p_inventory: payload.inventory,
      p_occupants: payload.occupants,
      p_vehicles: payload.vehicles,
      p_services: payload.services,
      p_actor_id: opts.actorId,
      p_request_id: opts.requestId,
    } as never)
    if (error) {
      throwContractCreateError(error)
      throwDbError(error, 'contracts.createFull')
    }
    const result = data as unknown as { contract_id: string; replayed: boolean }
    const contract = await this.findByIdentifier(event, result.contract_id)
    if (!contract) throwInternal(new Error('Contract missing after create_contract_full'), 'contracts.createFull.reread')
    return { contract, replayed: result.replayed }
  },
```

`throwContractCreateError(error)` maps the table above (exported from the same file; returns silently for unknown messages). Keep the legacy `P0001` (`end_date must be after start_date`) mapping to 409 as `createWithHandover` did.

Service `create`: keep checks through `resolvedRent`; add friendly roommate pre-checks reusing `ContractRepository.findActiveByTenantId` and `ContractOccupantRepository.findActiveOccupancyByTenant` for each roommate (throw the same messages as `ContractOccupantService.add`); compute `inventory` as in PR2; build `contract` json (`{ ...fields, monthly_rent: resolvedRent, building_id, handover_reading_date: input.handover_reading_date || input.start_date, recorded_by: user.id }`); call `createFull`; then if not replayed:

```ts
    const correlationId = randomUUID()
    if (contract.status === 'active') {
      await AuditService.append(event, user, {
        building_id: room.buildingId, action: AUDIT_ACTIONS.ROOM_UPDATED, entity_type: 'room', entity_id: room.id,
        correlation_id: correlationId, before_data: room, after_data: { ...room, status: 'occupied' },
      })
    }
    await AuditService.append(event, user, {
      building_id: contract.buildingId, action: AUDIT_ACTIONS.CONTRACT_CREATED, entity_type: 'contract',
      entity_id: contract.id, correlation_id: correlationId, after_data: contract,
    })
    for (const occupant of input.occupants ?? []) {
      await AuditService.append(event, user, {
        building_id: contract.buildingId, action: AUDIT_ACTIONS.CONTRACT_OCCUPANT_ADDED, entity_type: 'contract_occupant',
        entity_id: null, correlation_id: correlationId, metadata: { contract_id: contract.id, tenant_id: occupant.tenant_id },
      })
    }
    if (input.vehicles?.length) {
      await AuditService.append(event, user, {
        building_id: contract.buildingId, action: AUDIT_ACTIONS.CONTRACT_VEHICLES_UPDATED, entity_type: 'contract',
        entity_id: contract.id, correlation_id: correlationId, metadata: { count: input.vehicles.length },
      })
    }
```

Remove the post-RPC `cloneFromBuilding` and `RoomRepository.update` calls. Keep `createWithHandover` in the repository only if other callers exist (`grep -rn createWithHandover server`); otherwise delete it.

Vehicles repository/service/routes: mirror PR2 room inventory (`list`, `replace` delete-then-insert ordered by `sort_order`; service checks `contracts.read`/`contracts.update` + `assertBuildingScope(contract.buildingId)`; routes validate `{ items: contractVehicleListSchema }`).

- [ ] **Step 4: Run tests** → PASS (all contract suites). Regenerate api inventory.

- [ ] **Step 5: Commit**

```bash
git add server app/utils/constants/audit.ts app/types/contract-vehicles.ts app/utils/mappers/contract-vehicles.ts tests docs/api-inventory.md
git commit -m "feat(contracts): atomic create via create_contract_full; vehicles API"
```

---

### Task 4: Defaults prefill from building contract profile

**Files:**
- Create: `app/utils/contracts/prefill-defaults.ts`
- Modify: `app/components/contracts/ContractForm.vue`
- Test: `tests/utils/contract-prefill-defaults.test.ts`

**Interfaces:**
- ```ts
  export interface ContractDefaults { termMonths: number | null; depositMonths: number | null }
  export function computeEndDate(startDate: string, termMonths: number): string   // YYYY-MM-DD, start + N months − 1 day
  export function computeDeposit(monthlyRent: number, depositMonths: number): number // round to nearest 1,000
  export function applyContractDefaults(
    form: { start_date: string; end_date: string; monthly_rent: string; deposit: string },
    defaults: ContractDefaults,
    touched: Set<string>,
  ): Partial<{ end_date: string; deposit: string }>
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/contract-prefill-defaults.test.ts
import { describe, expect, it } from 'vitest'
import { applyContractDefaults, computeDeposit, computeEndDate } from '~/utils/contracts/prefill-defaults'

describe('contract defaults', () => {
  it('end date = start + N months - 1 day, month-end safe', () => {
    expect(computeEndDate('2026-12-01', 12)).toBe('2027-11-30')
    expect(computeEndDate('2027-01-31', 1)).toBe('2027-02-27')
  })

  it('deposit rounds to thousand', () => {
    expect(computeDeposit(3_333_333, 1.5)).toBe(5_000_000)
  })

  it('does not override touched fields', () => {
    const form = { start_date: '2026-12-01', end_date: '2027-06-30', monthly_rent: '3000000', deposit: '' }
    expect(applyContractDefaults(form, { termMonths: 12, depositMonths: 1 }, new Set(['end_date']))).toEqual({ deposit: '3000000' })
  })

  it('skips when defaults or inputs missing', () => {
    const form = { start_date: '', end_date: '', monthly_rent: '', deposit: '' }
    expect(applyContractDefaults(form, { termMonths: 12, depositMonths: 1 }, new Set())).toEqual({})
    expect(applyContractDefaults({ ...form, start_date: '2026-12-01' }, { termMonths: null, depositMonths: null }, new Set())).toEqual({})
  })
})
```

`computeEndDate('2027-01-31', 1)`: start + 1 month clamps to `2027-02-28`, minus one day → `2027-02-27`. Implement with dayjs `add(n, 'month').subtract(1, 'day')` (dayjs clamps month-end).

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** the helpers with `dayjs`; in `ContractForm.vue`, after a room is selected, fetch `GET /api/buildings/{room.buildingId}/contract-profile` (lazy, cached per building id) and on changes of `start_date`, `monthly_rent`, or room call `applyContractDefaults(modelValue, defaults, touched)` and emit the partial update. `touched` is the existing `touched` set in the component (fields the user blurred/edited). Show a small hint under end date/deposit: "Theo mặc định của tòa: {N} tháng" / "{M} tháng tiền thuê".

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/contracts/prefill-defaults.ts app/components/contracts/ContractForm.vue tests/utils/contract-prefill-defaults.test.ts
git commit -m "feat(contracts): prefill end date and deposit from building defaults"
```

---

### Task 5: Wizard — 4 steps, skippable step 3, confirm, done screen (UI polish gate)

**Files:**
- Modify: `app/pages/dashboard/contracts/create.vue`
- Modify: `app/components/contracts/ContractWizardSteps.vue` (default steps)
- Modify: `app/composables/contracts/useContractForm.ts` (`submitCreate` returns `{ contract, replayed }`, stable `requestId`, wizard draft adds `vehicles`, `services`)
- Create: `app/components/contracts/ContractVehiclesEditor.vue`
- Create: `app/components/contracts/ContractCreateConfirm.vue`
- Create or modify: `app/components/contracts/ContractServicesEditor.vue` (local-mode list editor; reuse `ContractServicesTab` if it can run without API)
- Test: `tests/composables/useContractForm-create.test.ts`, `tests/components/contracts/ContractVehiclesEditor.test.ts`, `tests/components/contracts/ContractCreateConfirm.test.ts`, `tests/pages/contract-create-wizard.spec.ts`

**Interfaces:**
- `ContractWizardSteps` default steps: `[{1,'Hợp đồng'},{2,'Bàn giao'},{3,'Bổ sung'},{4,'Xác nhận'}]`.
- `useContractForm.submitCreate(input: Omit<ContractCreateInput, 'request_id'>): Promise<{ contract: ContractWithDetails; replayed: boolean } | null>`; exposes `requestId`.
- `ContractCreateConfirm` props `{ form: ContractFormData; occupants: PendingOccupant[]; vehicles: ContractVehicleInput[]; services: ServiceDraft[]; roomLabel: string; tenantName: string }` emits `edit: [step: number]`; computes warnings: `1 + occupants.length > occupant_count` → "Số người ở cùng vượt quá số người ở."; vehicles count ≠ total quantity of enabled `per_vehicle` services → "Số xe đăng ký ({a}) khác số lượng dịch vụ gửi xe ({b})."

- [ ] **Step 1: UI polish workflow** — `frontend-design` + Hallmark on wizard steps, optional-step affordance ("Bỏ qua"), confirm summary, done screen, vehicle editor (mobile cards). Record decisions in `docs/changes/contract-quick-create/verification.md`.

- [ ] **Step 2: Write failing tests**

```ts
// tests/composables/useContractForm-create.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear() })

const input = {
  room_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e61', tenant_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e62',
  start_date: '2026-12-01', end_date: '2027-11-30', monthly_rent: 3_000_000,
  handover_electricity_reading: 1, handover_water_reading: 1,
} as never

describe('useContractForm.submitCreate', () => {
  it('sends a stable request_id across retries and returns replayed', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { id: 'c-1' }, meta: { replayed: true } })
    const { useContractForm } = await import('~/composables/contracts/useContractForm')
    const f = useContractForm({ draftKey: { mode: 'create' } })
    expect(await f.submitCreate(input)).toBeNull()
    const res = await f.submitCreate(input)
    expect(fetchMock.mock.calls[0]![1].body.request_id).toBe(fetchMock.mock.calls[1]![1].body.request_id)
    expect(res).toEqual({ contract: { id: 'c-1' }, replayed: true })
  })
})
```

```ts
// tests/components/contracts/ContractCreateConfirm.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContractCreateConfirm from '~/components/contracts/ContractCreateConfirm.vue'

describe('ContractCreateConfirm', () => {
  it('warns on occupant overflow and vehicle/service mismatch', () => {
    const w = mount(ContractCreateConfirm, { props: {
      form: { occupant_count: '1', start_date: '2026-12-01', end_date: '2027-11-30', monthly_rent: '3000000', deposit: '3000000' } as never,
      occupants: [{ tenant_id: 't', tenantName: 'B', move_in_date: '2026-12-01', billing_counted: true }],
      vehicles: [{ owner_name: 'A', plate_number: '59X1', vehicle_type: null, note: null }, { owner_name: 'B', plate_number: '59X2', vehicle_type: null, note: null }],
      services: [{ catalog_id: 'c', name: 'Gửi xe máy', pricingType: 'per_vehicle', amount: 100000, quantity: 1, is_enabled: true, notes: null }],
      roomLabel: 'Phòng P101', tenantName: 'A',
    } })
    expect(w.text()).toContain('Số người ở cùng vượt quá số người ở.')
    expect(w.text()).toContain('Số xe đăng ký (2) khác số lượng dịch vụ gửi xe (1).')
  })

  it('emits edit with step number', async () => {
    const w = mount(ContractCreateConfirm, { props: { form: { occupant_count: '2' } as never, occupants: [], vehicles: [], services: [], roomLabel: 'P', tenantName: 'A' } })
    await w.find('[data-test="confirm-edit-3"]').trigger('click')
    expect(w.emitted('edit')![0]).toEqual([3])
  })
})
```

```ts
// tests/components/contracts/ContractVehiclesEditor.test.ts — add/remove rows, shows duplicate plate error from contractVehicleListSchema, emits normalized plates on blur.
```

Write the vehicles editor test fully in the style of `InventoryItemsEditor.test.ts` (PR2).

```ts
// tests/pages/contract-create-wizard.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/contracts/create.vue'), 'utf8')

describe('contract create wizard', () => {
  it('has 4 steps with optional step 3 and confirm', () => {
    expect(page).toContain('Bỏ qua')
    expect(page).toContain('<ContractCreateConfirm')
    expect(page).toContain('<ContractVehiclesEditor')
  })

  it('submits everything in one request (no per-occupant POST)', () => {
    expect(page).not.toContain('Promise.allSettled')
    expect(page).not.toMatch(/\/occupants`,\s*\{\s*method: 'POST'/)
    expect(page).toContain('occupants:')
    expect(page).toContain('vehicles:')
    expect(page).toContain('services:')
  })

  it('shows a done screen with view and export actions', () => {
    expect(page).toContain('Đã tạo hợp đồng')
    expect(page).toContain('Xem hợp đồng')
  })
})
```

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement**
  - `useContractForm`: `const requestId = crypto.randomUUID()` per instance; `submitCreate` adds `request_id`, validates with `contractCreateSchema`, returns `{ contract: response.data, replayed: response.meta?.replayed ?? false }`; `WizardDraftRefs` gains `vehicles?: Ref<unknown[]>` and `services?: Ref<unknown[]>`. `index.post.ts` returns `meta: { replayed }` and status 200 on replay, 201 otherwise.
  - `create.vue`:
    - Step 1: `ContractForm` (fields without handover block; add prop `section: 'terms' | 'handover'` to `ContractForm` or split the handover/inventory blocks into `ContractHandoverForm.vue` — choose the smaller diff after reading the component).
    - Step 2: handover readings + inventory (PR2 block).
    - Step 3: roommates (`ContractOccupantForm`), `ContractVehiclesEditor`, services editor prefilled from `GET /api/buildings/{buildingId}/services` (active only, `amount = default_amount`, `quantity = 1`); buttons "Quay lại", "Bỏ qua" (→ step 4, keeps whatever was entered), "Tiếp".
    - Step 4: `ContractCreateConfirm` + "Tạo hợp đồng" → `submitCreate({ ...toPayload(formData), inventory, occupants: pendingOccupants.map(({ tenant_id, move_in_date, billing_counted }) => ({ tenant_id, move_in_date, billing_counted })), vehicles, services: servicesTouched ? services : undefined })`. Send `services` only when the user changed anything in step 3 so the server falls back to building defaults otherwise.
    - Done screen: "Đã tạo hợp đồng {contractCode}" + "Xem hợp đồng" (`contractPath`) + "Xuất hợp đồng (DOCX)" rendered only when `authStore.can('contract-documents.issue')` (capability added in PR4b; button hidden until then).
    - Remove step-3 `ContractServicesTab` remote editing and the per-occupant `Promise.allSettled` block.
  - Contract detail: add `'vehicles'` to `sectionIds` after `'occupants'`, nav link "Xe", section with `ContractVehiclesEditor` bound to `GET/PUT /api/contracts/{id}/vehicles` (editable with `contracts.update`).

- [ ] **Step 5: Run tests** → PASS (new + existing contract page/composable tests; update draft tests for new wizard keys).

- [ ] **Step 6: Visual QA** (ask before starting a local runtime): full wizard, skip step 3, confirm warnings, error per 409 type, retry after offline, done screen, contract detail vehicles, mobile. Record in `verification.md`.

- [ ] **Step 7: Commit**

```bash
git add app tests docs/changes/contract-quick-create/verification.md server/api/contracts/index.post.ts
git commit -m "feat(contracts): 4-step skippable wizard with atomic submit"
```

---

### Task 6: Full verification and docs

- [ ] **Step 1:** `npm run typecheck && npm test && npm run lint && npm run knowledge:check`.
- [ ] **Step 2:** Complete `docs/changes/contract-quick-create/verification.md` (frontmatter `type: Change Verification`, sections: Local, UI decisions, Visual QA, Cloud gates — migration applied after PR2, verification script output, types regenerated + casts removed, app deployed after migration, smoke: create contract with 1 roommate + 1 vehicle on staging).
- [ ] **Step 3:** Update `index.md` status → `implementation-review`.
- [ ] **Step 4: Commit** `git add docs/changes/contract-quick-create && git commit -m "docs(changes): PR4a verification evidence"`.
- [ ] **Step 5: Cloud gate (human-run)** — apply migration, run verification, regenerate types, deploy, smoke, update evidence; on acceptance update `contracts-api`, `contracts-ui`, `contracts-client`, `contracts-database`, `contract-occupants-api` capabilities and archive.
