---
type: Change Implementation Plan
title: "room-setup-inventory-lite-implementation-plan"
status: draft
change_state: implementing
tags: [superpowers, change, rooms, inventory, contracts, v2]
---

# Room Setup & Inventory Lite (V2 PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Floor-based room generation (create building + add to existing building), per-room inventory seeded from a building template, and a handover inventory captured with each new contract (editable later via PR4a, locked after DOCX issuance by PR4b).

**Architecture:** Three service-role-only tables (`building_inventory_templates`, `room_inventory_items`, `contract_inventory_items`). New wrapper RPCs (`create_rooms_batch_idempotent`, `create_contract_with_handover_and_inventory`) and `apply_inventory_template` compose existing functions inside one transaction without altering production RPCs. A pure room-number generator extends PR0's `useQuickRoomPreview`. Shared inventory components serve template, room, contract-create, contract-detail and checkout surfaces.

**Tech Stack:** Nuxt 3, Vue 3, Zod, Vitest, Supabase (PostgREST RPC), PL/pgSQL.

**Spec:** [design.md](./design.md)

**Prerequisite:** PR0 ([atomic-building-room-setup](../../history/2026-11-11-atomic-building-room-setup/implementation-plan.md)) merged — this plan uses `create_rooms_batch`, `useQuickRoomPreview`, `QUICK_ROOM_MAX`, `quickRoomSchema`, `throwBuildingSetupError`.

## Global Constraints

- Flow: page/component → composable → server API → service → repository → Supabase.
- Validators in `app/utils/validators/**` (client + server); DTOs `app/types/**`; mappers `app/utils/mappers/**`.
- Do not modify `create_contract_with_handover` or `create_rooms_batch`; only add wrappers.
- New tables: RLS on, no policies, `revoke all … from public, anon, authenticated`, grant to `service_role`.
- New functions: `security invoker`, `set search_path = ''`, revoke from `public, anon, authenticated`, grant to `service_role`.
- Inventory item: name 1–100, quantity 1–999, condition `good | used | damaged`, unit_value integer ≥ 0 or null, note ≤ 200; max 50 items per list; names unique case-insensitively per list.
- Generator: floors 1–100, rooms/floor 1–99, total ≤ 200 (`QUICK_ROOM_MAX`).
- Do not hand-edit `database.types.ts`; cast at repository boundary until regenerated.
- Vietnamese copy with full diacritics.
- UI: reuse design system/primitives; `frontend-design` + Hallmark per `.agents/skills/zeno-house/references/ui-polish-workflow.md`; new tokens/primitives only after evaluation + approval.
- Cloud migration apply and type regeneration are separate gates.

## Review Focus

1. **Apply template to a room from another building** (crafted request) — must be rejected with no partial writes. Pinned in Task 1 (SQL `INVENTORY_ROOM_SCOPE`) and Task 4 (service).
2. **Contract created from a room with no inventory** — contract creation must still succeed with an empty handover list. Pinned in Task 7.
3. **Renewed contract** — handover list must come from the original contract in the chain, not be empty. Pinned in Task 7.
4. **Generator re-run on a building that already has some rooms** — existing numbers flagged and excluded; payload never contains them. Pinned in Task 3.
5. **Two template items differing only by case (`Giường` / `giường`)** — validator rejects before the DB unique index fires a raw 500. Pinned in Task 2.

---

## Preflight implementation decisions (2026-11-12)

- UI direction was explicitly approved by the user: floor-group preview, editable desktop tables/mobile cards, copied building template, collapsible handover reference; preserve existing theme, typography and primitives.
- Use the atomic replacement option explicitly offered in Task 4: add `replace_inventory_template(p_building_id uuid, p_items jsonb)` and `replace_room_inventory(p_room_id uuid, p_items jsonb)` returning their respective table rows. Their delete/insert steps run in one transaction; a failed insert must preserve the previous list. Task 4 repositories call these RPCs, never separate REST delete/insert requests.
- All inventory writes take the same per-building advisory transaction lock, including template replacement, room replacement and template application. Validate room membership under row locks before applying; reject malformed mode/room arrays and lists outside their limits without partial writes.
- Enforce the 50-item invariant after merge as well as for submitted lists. A merge that would exceed 50 raises a stable validation error (`INVENTORY_ITEMS_LIMIT`) and rolls back, rather than truncating or creating an invalid room list.
- Validate wrapper inventory array shape, item bounds, integer quantities/values and case-insensitive duplicate names before persistence; use `jsonb_array_elements(... ) with ordinality` rather than the ambiguous typed `jsonb_to_recordset` alias sample. Validation helpers, if added, receive the same function security/grant restrictions as the public wrappers. Match monetary bounds to `numeric(12,0)`.
- Contract handover ancestry queries must filter every hop to the authorized building and handle cycles/invalid traversal explicitly; an initial scope check alone must not expose inventory from another building through a malformed chain.
- The pure generator validates prefix length (≤10), nonnegative safe-integer start/name-floor values and safe sequence arithmetic. Use a dedicated `invalid_input` error for these invalid configurations, in addition to the four planned generation errors, with a static Vietnamese explanation in the shared generator UI. Existing-room comparison uses the same normalized slug key as persistence, including case/punctuation variants.
- Existing production RPCs remain unchanged, and cloud SQL execution/type regeneration remain human-run gates. Generate the increasing migration filename through the installed CLI; adapt the sample filename in tests/evidence.

---

### Task 1: Migration — tables, guards, RPCs

**Files:**
- Create: `supabase/migrations/20261112005547_inventory_lite.sql`
- Create: `supabase/verification/inventory_lite.sql`
- Test: `tests/config/inventory-lite-migration.test.ts`

**Interfaces:**
- Produces SQL:
  - Tables per design §4.1–4.3.
  - `public.apply_inventory_template(p_building_id uuid, p_room_ids uuid[], p_mode text) returns jsonb` — `{ "<room_id>": added_count }`; errors `INVENTORY_MODE_INVALID` (22023), `INVENTORY_ROOM_SCOPE` (42501).
  - `public.create_rooms_batch_idempotent(p_building_id uuid, p_rooms jsonb, p_apply_inventory boolean, p_actor_id uuid, p_request_id uuid) returns jsonb` — `{ rooms: rooms row[], replayed: boolean }`; errors as PR0 (`ROOM_BATCH_*`, `BUILDING_SETUP_REQUEST_CONFLICT`, `BUILDING_SETUP_REQUEST_REQUIRED`).
  - `public.create_contract_with_handover_and_inventory(<17 params of create_contract_with_handover in the same order and types>, p_inventory jsonb) returns setof public.contracts`.

- [x] **Step 1: Write the failing static test**

```ts
// tests/config/inventory-lite-migration.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261112005547_inventory_lite.sql'), 'utf8')

describe('inventory lite migration', () => {
  it.each(['building_inventory_templates', 'room_inventory_items', 'contract_inventory_items'])('locks %s to service_role', (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security;`)
    expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated;`)
  })

  it('does not redefine existing production RPCs', () => {
    expect(sql).not.toMatch(/function public\.create_contract_with_handover\(/)
    expect(sql).not.toMatch(/function public\.create_rooms_batch\(/)
  })

  it('does not add an update-block trigger (PR4b owns the post-issuance lock)', () => {
    expect(sql).not.toContain('before update on public.contract_inventory_items')
  })

  it('restricts new functions to service_role', () => {
    for (const fn of ['apply_inventory_template', 'create_rooms_batch_idempotent', 'create_contract_with_handover_and_inventory']) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`))
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`))
    }
  })
})
```

- [x] **Step 2: Run to verify failure** — `npx vitest run tests/config/inventory-lite-migration.test.ts` → FAIL (ENOENT).

- [x] **Step 3: Write the migration**

```sql
-- =============================================================================
-- Inventory lite (V2 PR2)
-- =============================================================================
-- Building inventory templates, room inventory, contract handover inventory,
-- plus wrapper RPCs. Existing RPCs are NOT modified.
-- Requires PR0 migration (create_rooms_batch).
--
-- Data impact: ADDITIVE ONLY.
-- Execution model: apply in Supabase Dashboard SQL Editor, then regenerate types.
-- =============================================================================

-- ---------- tables ----------
create table if not exists public.building_inventory_templates (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity integer not null default 1 check (quantity between 1 and 999),
  condition text not null default 'good' check (condition in ('good', 'used', 'damaged')),
  unit_value numeric(12,0) check (unit_value is null or unit_value >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists building_inventory_templates_name_uq
  on public.building_inventory_templates (building_id, lower(name));

create table if not exists public.room_inventory_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity integer not null default 1 check (quantity between 1 and 999),
  condition text not null default 'good' check (condition in ('good', 'used', 'damaged')),
  unit_value numeric(12,0) check (unit_value is null or unit_value >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists room_inventory_items_name_uq
  on public.room_inventory_items (room_id, lower(name));

create table if not exists public.contract_inventory_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  quantity integer not null check (quantity between 1 and 999),
  condition text not null check (condition in ('good', 'used', 'damaged')),
  unit_value numeric(12,0) check (unit_value is null or unit_value >= 0),
  note text check (note is null or length(note) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contract_inventory_items_contract_idx on public.contract_inventory_items (contract_id);

drop trigger if exists building_inventory_templates_set_updated_at on public.building_inventory_templates;
create trigger building_inventory_templates_set_updated_at
  before update on public.building_inventory_templates
  for each row execute function public.set_updated_at();

drop trigger if exists room_inventory_items_set_updated_at on public.room_inventory_items;
create trigger room_inventory_items_set_updated_at
  before update on public.room_inventory_items
  for each row execute function public.set_updated_at();

alter table public.building_inventory_templates enable row level security;
alter table public.room_inventory_items enable row level security;
alter table public.contract_inventory_items enable row level security;
revoke all on table public.building_inventory_templates from public, anon, authenticated;
revoke all on table public.room_inventory_items from public, anon, authenticated;
revoke all on table public.contract_inventory_items from public, anon, authenticated;
grant select, insert, update, delete on table public.building_inventory_templates to service_role;
grant select, insert, update, delete on table public.room_inventory_items to service_role;
grant select, insert, update, delete on table public.contract_inventory_items to service_role;

-- ---------- apply_inventory_template ----------
create or replace function public.apply_inventory_template(
  p_building_id uuid,
  p_room_ids uuid[],
  p_mode text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room uuid;
  v_added integer;
  v_result jsonb := '{}'::jsonb;
begin
  if p_mode not in ('merge', 'replace') then
    raise exception 'INVENTORY_MODE_INVALID' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_room_ids) as rid
    where not exists (select 1 from public.rooms r where r.id = rid and r.building_id = p_building_id)
  ) then
    raise exception 'INVENTORY_ROOM_SCOPE' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_building_id::text, 0));

  foreach v_room in array p_room_ids loop
    if p_mode = 'replace' then
      delete from public.room_inventory_items where room_id = v_room;
    end if;
    insert into public.room_inventory_items (room_id, name, quantity, condition, unit_value, note, sort_order)
    select v_room, t.name, t.quantity, t.condition, t.unit_value, t.note, t.sort_order
    from public.building_inventory_templates t
    where t.building_id = p_building_id
      and not exists (
        select 1 from public.room_inventory_items i
        where i.room_id = v_room and lower(i.name) = lower(t.name)
      );
    get diagnostics v_added = row_count;
    v_result := v_result || jsonb_build_object(v_room::text, v_added);
  end loop;

  return v_result;
end;
$$;
revoke all on function public.apply_inventory_template(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.apply_inventory_template(uuid, uuid[], text) to service_role;

-- ---------- create_rooms_batch_idempotent ----------
create or replace function public.create_rooms_batch_idempotent(
  p_building_id uuid,
  p_rooms jsonb,
  p_apply_inventory boolean,
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
  v_rooms jsonb;
  v_ids uuid[];
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'BUILDING_SETUP_REQUEST_REQUIRED' using errcode = '22023';
  end if;
  v_key := 'rooms.batch:' || p_request_id::text;
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.building_id is distinct from p_building_id then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb)
    into v_rooms
    from public.rooms r
    where r.id = any (array(select jsonb_array_elements_text(v_op.intent_data->'room_ids')::uuid));
    return jsonb_build_object('rooms', v_rooms, 'replayed', true);
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb), array_agg(r.id)
  into v_rooms, v_ids
  from public.create_rooms_batch(p_building_id, p_rooms) r;

  if p_apply_inventory then
    perform public.apply_inventory_template(p_building_id, v_ids, 'merge');
  end if;

  insert into public.audit_operations (
    idempotency_key, actor_id, building_id, action, entity_type, entity_id, intent_data, status, completed_at
  ) values (
    v_key, p_actor_id, p_building_id, 'rooms.batch_create', 'building', p_building_id,
    jsonb_build_object('room_ids', to_jsonb(v_ids), 'apply_inventory', p_apply_inventory), 'completed', now()
  );

  return jsonb_build_object('rooms', v_rooms, 'replayed', false);
end;
$$;
revoke all on function public.create_rooms_batch_idempotent(uuid, jsonb, boolean, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_rooms_batch_idempotent(uuid, jsonb, boolean, uuid, uuid) to service_role;

-- ---------- create_contract_with_handover_and_inventory ----------
create or replace function public.create_contract_with_handover_and_inventory(
  p_room_id uuid,
  p_tenant_id uuid,
  p_building_id uuid,
  p_start_date date,
  p_end_date date,
  p_monthly_rent numeric,
  p_deposit numeric,
  p_payment_due_day smallint,
  p_occupant_count integer,
  p_discount_amount numeric,
  p_surcharge_amount numeric,
  p_status text,
  p_notes text,
  p_handover_electricity_reading numeric,
  p_handover_water_reading numeric,
  p_handover_reading_date date,
  p_recorded_by uuid,
  p_inventory jsonb
) returns setof public.contracts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_contract public.contracts%rowtype;
begin
  select * into v_contract from public.create_contract_with_handover(
    p_room_id, p_tenant_id, p_building_id, p_start_date, p_end_date, p_monthly_rent, p_deposit,
    p_payment_due_day, p_occupant_count, p_discount_amount, p_surcharge_amount, p_status, p_notes,
    p_handover_electricity_reading, p_handover_water_reading, p_handover_reading_date, p_recorded_by
  );

  if p_inventory is not null and jsonb_typeof(p_inventory) = 'array' and jsonb_array_length(p_inventory) > 0 then
    if jsonb_array_length(p_inventory) > 50 then
      raise exception 'CONTRACT_INVENTORY_INVALID' using errcode = '22023';
    end if;
    insert into public.contract_inventory_items (contract_id, name, quantity, condition, unit_value, note, sort_order)
    select v_contract.id, i.name, i.quantity, i.condition, i.unit_value, i.note, (i.ord - 1)::integer
    from jsonb_to_recordset(p_inventory) with ordinality
      as i(name text, quantity integer, condition text, unit_value numeric, note text, ord bigint);
  end if;

  return next v_contract;
end;
$$;
revoke all on function public.create_contract_with_handover_and_inventory(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer, numeric, numeric, text, text, numeric, numeric, date, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.create_contract_with_handover_and_inventory(
  uuid, uuid, uuid, date, date, numeric, numeric, smallint, integer, numeric, numeric, text, text, numeric, numeric, date, uuid, jsonb
) to service_role;
```

Note: `jsonb_to_recordset(...) with ordinality` requires the ordinality column alias last; if Postgres rejects the alias list form, use `select … from jsonb_array_elements(p_inventory) with ordinality as e(item, ord)` and read fields via `e.item->>'name'` etc. Verify in the cloud SQL Editor during Task 1 Step 5.

Note: the static test regex for `revoke`/`grant` uses `\([^)]*\)`; the multi-line argument list for the contract wrapper contains no `)` so it matches.

- [x] **Step 4: Write the verification script**

```sql
-- Verification for inventory lite (V2 PR2). Run as service_role; rolled back.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_building uuid;
  v_other_building uuid;
  v_room uuid;
  v_other_room uuid;
  v_tenant uuid := (select id from public.tenants order by created_at limit 1);
  v_res jsonb;
  v_contract public.contracts%rowtype;
  v_failed boolean;
  v_req uuid := gen_random_uuid();
begin
  if v_actor is null or v_tenant is null then raise exception 'VERIFY: need a user and a tenant'; end if;

  select (public.create_building_with_rooms(
    jsonb_build_object('slug', 'pr2-verify-' || substr(gen_random_uuid()::text,1,8), 'code', 'pr2v' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
      'name', 'PR2 verify', 'address', '1 Verify', 'status', 'active', 'electricity_pricing_type', 'per_kwh',
      'water_pricing_type', 'per_m3', 'grace_period_days', 0),
    '[]'::jsonb, null, v_actor, gen_random_uuid())->'building'->>'id')::uuid into v_building;
  select (public.create_building_with_rooms(
    jsonb_build_object('slug', 'pr2-verify-o-' || substr(gen_random_uuid()::text,1,8), 'code', 'pr2o' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
      'name', 'PR2 other', 'address', '2 Verify', 'status', 'active', 'electricity_pricing_type', 'per_kwh',
      'water_pricing_type', 'per_m3', 'grace_period_days', 0),
    jsonb_build_array(jsonb_build_object('room_number','O1','slug','o1','floor',1,'monthly_rent',1,'area',null)),
    null, v_actor, gen_random_uuid())->'building'->>'id')::uuid into v_other_building;
  select id into v_other_room from public.rooms where building_id = v_other_building limit 1;

  insert into public.building_inventory_templates (building_id, name, quantity, unit_value)
  values (v_building, 'Giường', 1, 2000000), (v_building, 'Máy lạnh', 1, 6000000);

  -- 1. Batch with inventory + replay.
  v_res := public.create_rooms_batch_idempotent(v_building, jsonb_build_array(
    jsonb_build_object('room_number','101','slug','101','floor',1,'monthly_rent',3000000,'area',null)), true, v_actor, v_req);
  v_room := (v_res->'rooms'->0->>'id')::uuid;
  if (select count(*) from public.room_inventory_items where room_id = v_room) <> 2 then
    raise exception 'VERIFY 1 failed: template not applied';
  end if;
  v_res := public.create_rooms_batch_idempotent(v_building, '[]'::jsonb, true, v_actor, v_req);
  if not (v_res->>'replayed')::boolean or (v_res->'rooms'->0->>'id')::uuid <> v_room then
    raise exception 'VERIFY 1b failed: replay';
  end if;

  -- 2. merge does not duplicate (case-insensitive).
  insert into public.room_inventory_items (room_id, name) values (v_room, 'tủ');
  perform public.apply_inventory_template(v_building, array[v_room], 'merge');
  if (select count(*) from public.room_inventory_items where room_id = v_room) <> 3 then
    raise exception 'VERIFY 2 failed: merge duplicated or dropped';
  end if;

  -- 3. Cross-building room rejected.
  v_failed := false;
  begin
    perform public.apply_inventory_template(v_building, array[v_other_room], 'merge');
  exception when others then v_failed := sqlerrm = 'INVENTORY_ROOM_SCOPE';
  end;
  if not v_failed then raise exception 'VERIFY 3 failed: cross-building apply accepted'; end if;

  -- 4. Contract wrapper writes inventory atomically.
  select * into v_contract from public.create_contract_with_handover_and_inventory(
    v_room, v_tenant, v_building, current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'active', null,
    100, 10, current_date, v_actor,
    jsonb_build_array(jsonb_build_object('name','Giường','quantity',1,'condition','good','unit_value',2000000,'note',null)));
  if (select count(*) from public.contract_inventory_items where contract_id = v_contract.id) <> 1 then
    raise exception 'VERIFY 4 failed: handover not written';
  end if;

  -- 6. Handover reading failure rolls back contract + inventory (duplicate handover on same room/period).
  v_failed := false;
  begin
    perform public.create_contract_with_handover_and_inventory(
      v_room, v_tenant, v_building, current_date, current_date + 365, 3000000, 0, 5::smallint, 1, 0, 0, 'terminated', null,
      100, 10, current_date, v_actor,
      jsonb_build_array(jsonb_build_object('name','X','quantity',1,'condition','good','unit_value',null,'note',null)));
  exception when others then v_failed := true;
  end;
  if not v_failed or exists (select 1 from public.contract_inventory_items where name = 'X') then
    raise exception 'VERIFY 6 failed: partial write on failure';
  end if;

  raise notice 'inventory lite verification passed';
end $$;

select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('apply_inventory_template', 'create_rooms_batch_idempotent', 'create_contract_with_handover_and_inventory');
-- Expected: false, false, true for each.

rollback;
```

If check 6 does not fail (no unique constraint on handover per room/period), replace it with a call passing `p_end_date <= p_start_date` (the wrapped function raises `P0001`) and assert no `contract_inventory_items` row with `name = 'X'` exists.

- [x] **Step 5: Run static test** → PASS.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20261112005547_inventory_lite.sql supabase/verification/inventory_lite.sql tests/config/inventory-lite-migration.test.ts
git commit -m "feat(db): inventory tables and wrapper RPCs"
```

---

### Task 2: Inventory types, mapper, validators

**Files:**
- Create: `app/types/inventory.ts`
- Create: `app/utils/mappers/inventory.ts`
- Create: `app/utils/validators/inventory.ts`
- Test: `tests/utils/inventory-validators.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // app/types/inventory.ts
  export type InventoryCondition = 'good' | 'used' | 'damaged'
  export interface InventoryItem { id: string; name: string; quantity: number; condition: InventoryCondition; unitValue: number | null; note: string | null; sortOrder: number }
  export interface HandoverInventory { sourceContractId: string | null; sourceContractCode: string | null; items: InventoryItem[] }
  export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> // { good: 'Tốt', used: 'Đã qua sử dụng', damaged: 'Hư hỏng' }
  ```
  ```ts
  // mapper
  export interface InventoryRow { id: string; name: string; quantity: number; condition: string; unit_value: number | string | null; note: string | null; sort_order: number }
  export function mapInventoryItem(row: InventoryRow): InventoryItem
  export function inventoryTotalValue(items: Pick<InventoryItem, 'quantity' | 'unitValue'>[]): number
  ```
  ```ts
  // validators
  export const INVENTORY_MAX_ITEMS = 50
  export const inventoryItemInputSchema   // { name, quantity, condition, unit_value, note } snake_case
  export const inventoryListSchema        // z.array(item).max(50) + case-insensitive duplicate name check
  export const inventoryApplySchema       // { room_ids: uuid[] 1..200, mode: 'merge' | 'replace' }
  export const roomBatchCreateSchema      // { request_id: uuid, rooms: quickRoomSchema[] 1..200 (dup by slug), apply_inventory: boolean default false }
  export type InventoryItemInput, InventoryApplyInput, RoomBatchCreateInput
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/inventory-validators.test.ts
import { describe, expect, it } from 'vitest'
import { inventoryApplySchema, inventoryListSchema, roomBatchCreateSchema } from '~/utils/validators/inventory'
import { inventoryTotalValue } from '~/utils/mappers/inventory'

const item = (name: string, extra: Record<string, unknown> = {}) => ({ name, quantity: 1, condition: 'good', unit_value: null, note: null, ...extra })

describe('inventoryListSchema', () => {
  it('accepts a normal list with defaults', () => {
    const r = inventoryListSchema.safeParse([{ name: 'Giường' }])
    expect(r.success).toBe(true)
    expect(r.data![0]).toMatchObject({ quantity: 1, condition: 'good', unit_value: null, note: null })
  })

  it('rejects case-insensitive duplicate names at the duplicate index', () => {
    const r = inventoryListSchema.safeParse([item('Giường'), item('Tủ'), item('giường')])
    expect(r.success).toBe(false)
    expect(r.error!.issues.map(i => i.path.join('.'))).toContain('2.name')
  })

  it.each([
    [{ name: '' }], [{ name: 'x'.repeat(101) }], [{ name: 'A', quantity: 0 }], [{ name: 'A', quantity: 1000 }],
    [{ name: 'A', condition: 'new' }], [{ name: 'A', unit_value: -1 }], [{ name: 'A', unit_value: 1.5 }],
    [{ name: 'A', note: 'x'.repeat(201) }],
  ])('rejects %j', (bad) => {
    expect(inventoryListSchema.safeParse([bad]).success).toBe(false)
  })

  it('rejects more than 50 items', () => {
    expect(inventoryListSchema.safeParse(Array.from({ length: 51 }, (_, i) => item(`M${i}`))).success).toBe(false)
  })
})

describe('inventoryApplySchema', () => {
  it('requires 1..200 uuids and a valid mode', () => {
    expect(inventoryApplySchema.safeParse({ room_ids: [], mode: 'merge' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: ['7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'], mode: 'wipe' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: ['7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'], mode: 'replace' }).success).toBe(true)
  })
})

describe('roomBatchCreateSchema', () => {
  it('requires request_id and rejects slug duplicates', () => {
    const rooms = [{ room_number: 'P101', floor: 1, monthly_rent: 1, area: null }, { room_number: 'p101', floor: 1, monthly_rent: 1, area: null }]
    expect(roomBatchCreateSchema.safeParse({ rooms }).success).toBe(false)
    const r = roomBatchCreateSchema.safeParse({ request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f', rooms })
    expect(r.success).toBe(false)
  })
})

describe('inventoryTotalValue', () => {
  it('sums quantity * unit value, skipping nulls', () => {
    expect(inventoryTotalValue([{ quantity: 2, unitValue: 1000 }, { quantity: 1, unitValue: null }])).toBe(2000)
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// app/types/inventory.ts
export type InventoryCondition = 'good' | 'used' | 'damaged'

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  condition: InventoryCondition
  unitValue: number | null
  note: string | null
  sortOrder: number
}

export interface HandoverInventory {
  sourceContractId: string | null
  sourceContractCode: string | null
  items: InventoryItem[]
}

export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  good: 'Tốt',
  used: 'Đã qua sử dụng',
  damaged: 'Hư hỏng',
}
```

```ts
// app/utils/mappers/inventory.ts
import type { InventoryCondition, InventoryItem } from '~/types/inventory'

export interface InventoryRow {
  id: string
  name: string
  quantity: number
  condition: string
  unit_value: number | string | null
  note: string | null
  sort_order: number
}

export function mapInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    condition: row.condition as InventoryCondition,
    unitValue: row.unit_value === null ? null : Number(row.unit_value),
    note: row.note,
    sortOrder: row.sort_order,
  }
}

export function inventoryTotalValue(items: Pick<InventoryItem, 'quantity' | 'unitValue'>[]): number {
  return items.reduce((sum, item) => sum + (item.unitValue ?? 0) * item.quantity, 0)
}
```

```ts
// app/utils/validators/inventory.ts
import { z } from 'zod'
import { slugifyName } from '~/utils/format/slug'
import { QUICK_ROOM_MAX, quickRoomSchema } from './buildings'

export const INVENTORY_MAX_ITEMS = 50

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

export const inventoryItemInputSchema = z.object({
  name: z.string().trim().min(1, 'Tên không được trống').max(100, 'Tên quá dài'),
  quantity: z.number().int('Số lượng phải là số nguyên').min(1, 'Số lượng tối thiểu 1').max(999, 'Số lượng tối đa 999').default(1),
  condition: z.enum(['good', 'used', 'damaged']).default('good'),
  unit_value: z.preprocess(blankToNull, z.number().int('Đơn giá phải là số nguyên').min(0, 'Đơn giá không được âm').nullable().default(null)),
  note: z.preprocess(blankToNull, z.string().trim().max(200, 'Ghi chú quá dài').nullable().default(null)),
})

export const inventoryListSchema = z.array(inventoryItemInputSchema)
  .max(INVENTORY_MAX_ITEMS, `Tối đa ${INVENTORY_MAX_ITEMS} món`)
  .superRefine((items, ctx) => {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      const key = item.name.trim().toLocaleLowerCase('vi')
      if (seen.has(key)) {
        ctx.addIssue({ code: 'custom', path: [index, 'name'], message: `"${item.name}" bị trùng` })
      }
      seen.add(key)
    })
  })

export const inventoryApplySchema = z.object({
  room_ids: z.array(z.string().uuid('Phòng không hợp lệ')).min(1, 'Chọn ít nhất 1 phòng').max(200, 'Tối đa 200 phòng'),
  mode: z.enum(['merge', 'replace']),
})

export const roomBatchCreateSchema = z.object({
  request_id: z.string().uuid('Mã yêu cầu không hợp lệ'),
  rooms: z.array(quickRoomSchema).min(1, 'Chọn ít nhất 1 phòng').max(QUICK_ROOM_MAX, `Tối đa ${QUICK_ROOM_MAX} phòng mỗi lần`),
  apply_inventory: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()
  value.rooms.forEach((room, index) => {
    const key = slugifyName(room.room_number) || room.room_number.toLowerCase()
    if (seen.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['rooms', index, 'room_number'], message: `Mã phòng "${room.room_number}" bị trùng` })
    }
    seen.add(key)
  })
})

export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>
export type InventoryApplyInput = z.infer<typeof inventoryApplySchema>
export type RoomBatchCreateInput = z.infer<typeof roomBatchCreateSchema>
```

Postgres `lower()` and JS `toLocaleLowerCase('vi')` agree for Vietnamese letters with diacritics; the DB unique index is the final guard.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/types/inventory.ts app/utils/mappers/inventory.ts app/utils/validators/inventory.ts tests/utils/inventory-validators.test.ts
git commit -m "feat(inventory): types, mapper and validators"
```

---

### Task 3: Floor-based room generator

**Files:**
- Create: `app/utils/rooms/generate-room-numbers.ts`
- Modify: `app/composables/buildings/useQuickRoomPreview.ts` (from PR0)
- Test: `tests/utils/generate-room-numbers.test.ts`, extend `tests/composables/useQuickRoomPreview.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RoomGeneratorInput {
    floorFrom: number; floorTo: number; roomsPerFloor: number; prefix: string
    startSeq: number; includeFloor: boolean; nameFloorStart: number
  }
  export interface GeneratedRoom { roomNumber: string; floor: number }
  export type GeneratorError = 'floor_range' | 'rooms_per_floor' | 'seq_overflow' | 'too_many'
  export function generateRoomNumbers(input: RoomGeneratorInput): { rooms: GeneratedRoom[]; error: GeneratorError | null }
  ```
- `useQuickRoomPreview` changes (keeps PR0 API: `rows`, `setCell`, `resetCell`, `samePrice`, `defaultRent`, `defaultArea`, `duplicateRoomNumbers`, `serverDuplicates`, `markServerDuplicates`, `toPayload`):
  - Replace `prefix/start/count/defaultFloor` with `generator: Ref<RoomGeneratorInput>`, `generatorError: ComputedRef<GeneratorError | null>`.
  - Add `existingRoomNumbers: Ref<string[]>` (rows matching are flagged `existing: true` and excluded from `toPayload()`).
  - Add `removeRow(roomNumber)`, `addRow(roomNumber, floor)`; manual rows survive regeneration; removed generated rows stay removed until generator inputs change their set.
  - `PreviewRoom` gains `existing: boolean`, `manual: boolean`.

- [ ] **Step 1: Write failing generator tests**

```ts
// tests/utils/generate-room-numbers.test.ts
import { describe, expect, it } from 'vitest'
import { generateRoomNumbers } from '~/utils/rooms/generate-room-numbers'

const base = { floorFrom: 1, floorTo: 3, roomsPerFloor: 2, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
const numbers = (input: Partial<typeof base>) => generateRoomNumbers({ ...base, ...input }).rooms.map(r => `${r.floor}:${r.roomNumber}`)

describe('generateRoomNumbers', () => {
  it('embeds floor with 2-digit sequence', () => {
    expect(numbers({})).toEqual(['1:P101', '1:P102', '2:P201', '2:P202', '3:P301', '3:P302'])
  })

  it('separates name floor from stored floor (ground floor = 0xx)', () => {
    expect(numbers({ prefix: '', nameFloorStart: 0 })).toEqual(['1:001', '1:002', '2:101', '2:102', '3:201', '3:202'])
  })

  it('respects start sequence', () => {
    expect(numbers({ floorTo: 1, startSeq: 5 })).toEqual(['1:P105', '1:P106'])
  })

  it('without floor in name, sequence runs across floors with min 2 digits', () => {
    expect(numbers({ includeFloor: false, floorTo: 2, roomsPerFloor: 3 })).toEqual(['1:P01', '1:P02', '1:P03', '2:P04', '2:P05', '2:P06'])
    expect(numbers({ includeFloor: false, floorTo: 1, roomsPerFloor: 2, startSeq: 101 })).toEqual(['1:P101', '1:P102'])
  })

  it.each([
    [{ floorFrom: 3, floorTo: 1 }, 'floor_range'],
    [{ floorTo: 101 }, 'floor_range'],
    [{ roomsPerFloor: 100 }, 'rooms_per_floor'],
    [{ roomsPerFloor: 0 }, 'rooms_per_floor'],
    [{ startSeq: 95, roomsPerFloor: 10 }, 'seq_overflow'],
    [{ floorTo: 21, roomsPerFloor: 10 }, 'too_many'],
  ])('reports %j as %s', (input, error) => {
    const r = generateRoomNumbers({ ...base, ...input })
    expect(r.error).toBe(error)
    expect(r.rooms).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement the generator**

```ts
// app/utils/rooms/generate-room-numbers.ts
import { QUICK_ROOM_MAX } from '~/utils/validators/buildings'

export interface RoomGeneratorInput {
  floorFrom: number
  floorTo: number
  roomsPerFloor: number
  prefix: string
  startSeq: number
  includeFloor: boolean
  nameFloorStart: number
}

export interface GeneratedRoom {
  roomNumber: string
  floor: number
}

export type GeneratorError = 'floor_range' | 'rooms_per_floor' | 'seq_overflow' | 'too_many'

const fail = (error: GeneratorError) => ({ rooms: [] as GeneratedRoom[], error })

export function generateRoomNumbers(input: RoomGeneratorInput): { rooms: GeneratedRoom[]; error: GeneratorError | null } {
  const { floorFrom, floorTo, roomsPerFloor, prefix, startSeq, includeFloor, nameFloorStart } = input
  if (!Number.isInteger(floorFrom) || !Number.isInteger(floorTo) || floorFrom < 1 || floorTo > 100 || floorFrom > floorTo) {
    return fail('floor_range')
  }
  if (!Number.isInteger(roomsPerFloor) || roomsPerFloor < 1 || roomsPerFloor > 99) return fail('rooms_per_floor')
  if (includeFloor && startSeq + roomsPerFloor - 1 > 99) return fail('seq_overflow')
  const floors = floorTo - floorFrom + 1
  if (floors * roomsPerFloor > QUICK_ROOM_MAX) return fail('too_many')

  const rooms: GeneratedRoom[] = []
  let running = startSeq
  for (let f = 0; f < floors; f++) {
    const floor = floorFrom + f
    for (let i = 0; i < roomsPerFloor; i++) {
      const roomNumber = includeFloor
        ? `${prefix}${nameFloorStart + f}${String(startSeq + i).padStart(2, '0')}`
        : `${prefix}${String(running++).padStart(2, '0')}`
      rooms.push({ roomNumber, floor })
    }
  }
  return { rooms, error: null }
}
```

- [ ] **Step 4: Extend composable tests** (append to `tests/composables/useQuickRoomPreview.test.ts`; update the PR0 `setup()` helper to set `p.generator.value = { floorFrom: 1, floorTo: 1, roomsPerFloor: 3, prefix: 'P', startSeq: 101, includeFloor: false, nameFloorStart: 1 }` so PR0 expectations `P101…P103` still hold):

```ts
describe('useQuickRoomPreview (PR2)', () => {
  it('flags and excludes existing rooms', async () => {
    const p = await setup()
    p.existingRoomNumbers.value = ['P102']
    await nextTick()
    expect(p.rows.value.find(r => r.roomNumber === 'P102')!.existing).toBe(true)
    expect(p.toPayload().map(r => r.room_number)).toEqual(['P101', 'P103'])
  })

  it('removes and adds rows; manual rows survive regeneration', async () => {
    const p = await setup()
    p.removeRow('P103')
    p.addRow('P105A', 1)
    p.defaultRent.value = 4_000_000
    await nextTick()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P105A'])
    expect(p.rows.value.find(r => r.roomNumber === 'P105A')!.manual).toBe(true)
  })

  it('surfaces generator errors and clears rows', async () => {
    const p = await setup()
    p.generator.value = { ...p.generator.value, roomsPerFloor: 100 }
    await nextTick()
    expect(p.generatorError.value).toBe('rooms_per_floor')
    expect(p.rows.value.filter(r => !r.manual)).toEqual([])
  })

  it('assigns floors from the generator', async () => {
    const p = await setup()
    p.generator.value = { floorFrom: 2, floorTo: 3, roomsPerFloor: 1, prefix: 'A', startSeq: 1, includeFloor: true, nameFloorStart: 2 }
    await nextTick()
    expect(p.rows.value.map(r => [r.roomNumber, r.floor])).toEqual([['A201', 2], ['A301', 3]])
  })
})
```

- [ ] **Step 5: Run to verify failure, then implement composable changes**

Key changes inside `useQuickRoomPreview`:

```ts
const generator = ref<RoomGeneratorInput>({
  floorFrom: 1, floorTo: 1, roomsPerFloor: 3, prefix: 'P', startSeq: 1, includeFloor: false, nameFloorStart: 1,
})
const existingRoomNumbers = ref<string[]>([])
const removed = ref(new Set<string>())
const manualRows = ref<PreviewRoom[]>([])
const generated = computed(() => generateRoomNumbers(generator.value))
const generatorError = computed(() => generated.value.error)

function regenerate() {
  if (!enabled.value) { rows.value = []; return }
  const previous = new Map(rows.value.map(r => [r.roomNumber, r]))
  const existing = new Set(existingRoomNumbers.value)
  const base = { rent: defaultRent.value, area: defaultArea.value }
  const fromGenerator = generated.value.rooms
    .filter(g => !removed.value.has(g.roomNumber))
    .map((g) => {
      const old = previous.get(g.roomNumber)
      const row: PreviewRoom = { roomNumber: g.roomNumber, floor: g.floor, ...base, overridden: [], existing: existing.has(g.roomNumber), manual: false }
      for (const field of old?.overridden ?? []) {
        if (field === 'rent' && samePrice.value) continue
        ;(row[field] as number | null) = old![field]
        row.overridden.push(field)
      }
      return row
    })
  const manual = manualRows.value.map(r => ({ ...r, existing: existing.has(r.roomNumber) }))
  rows.value = [...fromGenerator, ...manual]
}

watch([enabled, generator], () => {
  serverDuplicates.value = []
  removed.value = new Set()
  regenerate()
}, { deep: true, immediate: true })
watch([defaultRent, defaultArea, samePrice, existingRoomNumbers], regenerate, { deep: true })

function removeRow(roomNumber: string) {
  manualRows.value = manualRows.value.filter(r => r.roomNumber !== roomNumber)
  removed.value.add(roomNumber)
  rows.value = rows.value.filter(r => r.roomNumber !== roomNumber)
}

function addRow(roomNumber: string, floor: number) {
  const row: PreviewRoom = { roomNumber, floor, rent: defaultRent.value, area: defaultArea.value, overridden: [], existing: false, manual: true }
  manualRows.value.push(row)
  regenerate()
}

function toPayload(): QuickRoomInput[] {
  return rows.value
    .filter(r => !r.existing)
    .map(r => ({ room_number: r.roomNumber, floor: r.floor, monthly_rent: r.rent, area: r.area }))
}
```

Remove PR0's `prefix`, `start`, `count`, `defaultFloor` refs and the `defaults().floor` usage (`floor` now comes from the generator; `PreviewField` keeps `'floor'` for manual edits). Keep `setCell`/`resetCell`; `resetCell(…, 'floor')` restores the generator's floor for that room (look it up in `generated.value.rooms`; for manual rows restore the floor given to `addRow`).

- [ ] **Step 6: Run tests** → PASS (generator + composable, including PR0 tests).

- [ ] **Step 7: Commit**

```bash
git add app/utils/rooms/generate-room-numbers.ts app/composables/buildings/useQuickRoomPreview.ts tests/utils/generate-room-numbers.test.ts tests/composables/useQuickRoomPreview.test.ts
git commit -m "feat(rooms): floor-based room number generator"
```

---

### Task 4: Inventory repository, service, capabilities, audit

**Files:**
- Create: `server/repositories/inventory.ts`
- Create: `server/services/inventory.ts`
- Modify: `app/utils/constants/audit.ts`
- Test: `tests/server/inventory/inventory-service.test.ts`

**Interfaces:**
- Consumes: Task 2 types/validators/mapper; `BuildingRepository.findByIdentifier`, `RoomRepository.findByIdentifier`/`findById`, `assertBuildingScope`, `AuditService.append`.
- Produces:
  ```ts
  InventoryRepository.listTemplate(event, buildingId): Promise<InventoryRow[]>
  InventoryRepository.replaceTemplate(event, buildingId, items: InventoryItemInput[]): Promise<InventoryRow[]>
  InventoryRepository.listRoom(event, roomId): Promise<InventoryRow[]>
  InventoryRepository.replaceRoom(event, roomId, items: InventoryItemInput[]): Promise<InventoryRow[]>
  InventoryRepository.applyTemplate(event, buildingId, roomIds: string[], mode: 'merge' | 'replace'): Promise<Record<string, number>>
  InventoryRepository.listContract(event, contractId): Promise<InventoryRow[]>

  InventoryService.getTemplate(event, user, buildingIdentifier): Promise<InventoryItem[]>
  InventoryService.saveTemplate(event, user, buildingIdentifier, items): Promise<InventoryItem[]>
  InventoryService.applyTemplate(event, user, buildingIdentifier, input: InventoryApplyInput): Promise<{ appliedRooms: number; addedItems: number }>
  InventoryService.getRoom(event, user, roomIdentifier): Promise<InventoryItem[]>
  InventoryService.saveRoom(event, user, roomIdentifier, items): Promise<InventoryItem[]>
  ```
  Audit constants:
  ```ts
  BUILDING_INVENTORY_TEMPLATE_UPDATED: 'building.inventory_template.updated',
  ROOM_INVENTORY_UPDATED: 'room.inventory.updated',
  ROOM_INVENTORY_TEMPLATE_APPLIED: 'room.inventory.template_applied',
  ```

- [ ] **Step 1: Write the failing service test**

```ts
// tests/server/inventory/inventory-service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const repo = vi.hoisted(() => ({
  listTemplate: vi.fn(), replaceTemplate: vi.fn(), listRoom: vi.fn(), replaceRoom: vi.fn(), applyTemplate: vi.fn(), listContract: vi.fn(),
}))
const findBuilding = vi.fn()
const findRoom = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/inventory', () => ({ InventoryRepository: repo }))
vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: findBuilding } }))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { findByIdentifier: findRoom } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const CAPS: Record<string, string[]> = {
  owner: ['rooms.read', 'rooms.update', 'buildings.update'],
  manager: ['rooms.read', 'rooms.update'],
}
const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never
const row = (id: string, name: string) => ({ id, name, quantity: 1, condition: 'good', unit_value: null, note: null, sort_order: 0 })

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (u: AuthUser, cap: string) => CAPS[String(u.app_metadata?.role)]?.includes(cap) ?? false)
  findBuilding.mockResolvedValue({ id: 'b-1' })
  findRoom.mockResolvedValue({ id: 'r-1', buildingId: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
})

describe('InventoryService', () => {
  it('manager cannot edit the template', async () => {
    const { InventoryService } = await import('../../../server/services/inventory')
    await expect(InventoryService.saveTemplate(ev(), manager, 'b-1', [])).rejects.toMatchObject({ statusCode: 403 })
    expect(repo.replaceTemplate).not.toHaveBeenCalled()
  })

  it('owner saves template and audits item_count', async () => {
    repo.replaceTemplate.mockResolvedValue([row('t-1', 'Giường'), row('t-2', 'Tủ')])
    const { InventoryService } = await import('../../../server/services/inventory')
    const items = await InventoryService.saveTemplate(ev(), owner, 'b-1', [{ name: 'Giường' }, { name: 'Tủ' }] as never)
    expect(items).toHaveLength(2)
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({ action: 'building.inventory_template.updated', metadata: { item_count: 2 } })
  })

  it('manager can edit room inventory and audit counts diff', async () => {
    repo.listRoom.mockResolvedValue([row('i-1', 'Giường'), row('i-2', 'Tủ')])
    repo.replaceRoom.mockResolvedValue([row('i-3', 'Giường'), row('i-4', 'Máy lạnh')])
    const { InventoryService } = await import('../../../server/services/inventory')
    await InventoryService.saveRoom(ev(), manager, 'r-1', [{ name: 'Giường', quantity: 2 }, { name: 'Máy lạnh' }] as never)
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({
      action: 'room.inventory.updated', entity_type: 'room', entity_id: 'r-1',
      metadata: { added: 1, removed: 1, changed: 1 },
    })
  })

  it('manager can apply template; scope-violation from DB maps to 403', async () => {
    repo.applyTemplate.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 403 }))
    const { InventoryService } = await import('../../../server/services/inventory')
    await expect(InventoryService.applyTemplate(ev(), manager, 'b-1', { room_ids: ['r-x'], mode: 'merge' }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('apply returns totals and audits mode/room_count', async () => {
    repo.applyTemplate.mockResolvedValue({ 'r-1': 2, 'r-2': 0 })
    const { InventoryService } = await import('../../../server/services/inventory')
    const res = await InventoryService.applyTemplate(ev(), manager, 'b-1', { room_ids: ['r-1', 'r-2'], mode: 'merge' })
    expect(res).toEqual({ appliedRooms: 2, addedItems: 2 })
    expect(appendAudit.mock.calls[0]![2]).toMatchObject({ action: 'room.inventory.template_applied', metadata: { mode: 'merge', room_count: 2 } })
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement repository**

```ts
// server/repositories/inventory.ts
import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryItemInput } from '~/utils/validators/inventory'

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const from = (event: H3Event, table: string) => db(event).from(table as never)
const COLUMNS = 'id, name, quantity, condition, unit_value, note, sort_order'

function toRows(items: InventoryItemInput[], key: 'building_id' | 'room_id', id: string) {
  return items.map((item, index) => ({ [key]: id, ...item, sort_order: index }))
}

function mapInventoryDbError(error: unknown, context: string): never {
  const message = String((error as { message?: string }).message ?? '')
  if (message === 'INVENTORY_ROOM_SCOPE') throwForbidden('Có phòng không thuộc tòa nhà này')
  if ((error as { code?: string }).code === '23505') throwConflict('Tên món nội thất bị trùng')
  throwDbError(error, context)
}

export const InventoryRepository = {
  async listTemplate(event: H3Event, buildingId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'building_inventory_templates').select(COLUMNS).eq('building_id', buildingId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listTemplate')
    return (data ?? []) as InventoryRow[]
  },

  async replaceTemplate(event: H3Event, buildingId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { error: delError } = await from(event, 'building_inventory_templates').delete().eq('building_id', buildingId)
    if (delError) throwDbError(delError, 'inventory.replaceTemplate.delete')
    if (items.length === 0) return []
    const { data, error } = await from(event, 'building_inventory_templates').insert(toRows(items, 'building_id', buildingId) as never).select(COLUMNS).order('sort_order')
    if (error) mapInventoryDbError(error, 'inventory.replaceTemplate.insert')
    return (data ?? []) as InventoryRow[]
  },

  async listRoom(event: H3Event, roomId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'room_inventory_items').select(COLUMNS).eq('room_id', roomId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listRoom')
    return (data ?? []) as InventoryRow[]
  },

  async replaceRoom(event: H3Event, roomId: string, items: InventoryItemInput[]): Promise<InventoryRow[]> {
    const { error: delError } = await from(event, 'room_inventory_items').delete().eq('room_id', roomId)
    if (delError) throwDbError(delError, 'inventory.replaceRoom.delete')
    if (items.length === 0) return []
    const { data, error } = await from(event, 'room_inventory_items').insert(toRows(items, 'room_id', roomId) as never).select(COLUMNS).order('sort_order')
    if (error) mapInventoryDbError(error, 'inventory.replaceRoom.insert')
    return (data ?? []) as InventoryRow[]
  },

  async applyTemplate(event: H3Event, buildingId: string, roomIds: string[], mode: 'merge' | 'replace'): Promise<Record<string, number>> {
    const { data, error } = await db(event).rpc('apply_inventory_template' as never, {
      p_building_id: buildingId, p_room_ids: roomIds, p_mode: mode,
    } as never)
    if (error) mapInventoryDbError(error, 'inventory.applyTemplate')
    return (data ?? {}) as Record<string, number>
  },

  async listContract(event: H3Event, contractId: string): Promise<InventoryRow[]> {
    const { data, error } = await from(event, 'contract_inventory_items').select(COLUMNS).eq('contract_id', contractId).order('sort_order')
    if (error) throwDbError(error, 'inventory.listContract')
    return (data ?? []) as InventoryRow[]
  },
}
```

`replaceTemplate`/`replaceRoom` are delete-then-insert without a transaction; a failed insert leaves the list empty. Mitigation: validation runs before the call (Task 5 route) and duplicate names are rejected client- and server-side, so insert failure is limited to infrastructure errors. If reviewers require atomicity, add `replace_room_inventory(p_room_id, p_items jsonb)` / `replace_inventory_template(...)` RPCs in Task 1's migration and call them here instead; tests are unchanged.

- [ ] **Step 4: Implement service**

```ts
// server/services/inventory.ts
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { InventoryItem } from '~/types/inventory'
import { mapInventoryItem, type InventoryRow } from '~/utils/mappers/inventory'
import type { InventoryApplyInput, InventoryItemInput } from '~/utils/validators/inventory'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../repositories/buildings'
import { RoomRepository } from '../repositories/rooms'
import { InventoryRepository } from '../repositories/inventory'
import { assertBuildingScope } from '../utils/scope'
import { AuditService } from './audit'

async function requireBuilding(event: H3Event, identifier: string) {
  const building = await BuildingRepository.findByIdentifier(event, identifier)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

async function requireRoom(event: H3Event, identifier: string) {
  const room = await RoomRepository.findByIdentifier(event, identifier)
  if (!room) throwNotFound('Không tìm thấy phòng')
  return room
}

function diff(before: InventoryRow[], after: InventoryItemInput[]) {
  const key = (name: string) => name.trim().toLocaleLowerCase('vi')
  const old = new Map(before.map(r => [key(r.name), r]))
  const next = new Map(after.map(i => [key(i.name), i]))
  let added = 0, removed = 0, changed = 0
  for (const [k, item] of next) {
    const prev = old.get(k)
    if (!prev) added++
    else if (prev.quantity !== item.quantity || prev.condition !== item.condition
      || (prev.unit_value === null ? null : Number(prev.unit_value)) !== item.unit_value || prev.note !== item.note) changed++
  }
  for (const k of old.keys()) if (!next.has(k)) removed++
  return { added, removed, changed }
}

export const InventoryService = {
  async getTemplate(event: H3Event, user: AuthUser, buildingIdentifier: string): Promise<InventoryItem[]> {
    requireCapability(user, 'rooms.read', 'Không có quyền xem nội thất')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    return (await InventoryRepository.listTemplate(event, building.id)).map(mapInventoryItem)
  },

  async saveTemplate(event: H3Event, user: AuthUser, buildingIdentifier: string, items: InventoryItemInput[]): Promise<InventoryItem[]> {
    requireCapability(user, 'buildings.update', 'Không có quyền sửa nội thất mẫu')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const rows = await InventoryRepository.replaceTemplate(event, building.id, items)
    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.BUILDING_INVENTORY_TEMPLATE_UPDATED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { item_count: rows.length },
    })
    return rows.map(mapInventoryItem)
  },

  async applyTemplate(event: H3Event, user: AuthUser, buildingIdentifier: string, input: InventoryApplyInput) {
    requireCapability(user, 'rooms.update', 'Không có quyền cập nhật phòng')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const result = await InventoryRepository.applyTemplate(event, building.id, input.room_ids, input.mode)
    const addedItems = Object.values(result).reduce((s, n) => s + n, 0)
    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.ROOM_INVENTORY_TEMPLATE_APPLIED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { mode: input.mode, room_count: input.room_ids.length, added_items: addedItems },
    })
    return { appliedRooms: input.room_ids.length, addedItems }
  },

  async getRoom(event: H3Event, user: AuthUser, roomIdentifier: string): Promise<InventoryItem[]> {
    requireCapability(user, 'rooms.read', 'Không có quyền xem nội thất')
    const room = await requireRoom(event, roomIdentifier)
    await assertBuildingScope(event, user, room.buildingId, 'read')
    return (await InventoryRepository.listRoom(event, room.id)).map(mapInventoryItem)
  },

  async saveRoom(event: H3Event, user: AuthUser, roomIdentifier: string, items: InventoryItemInput[]): Promise<InventoryItem[]> {
    requireCapability(user, 'rooms.update', 'Không có quyền cập nhật phòng')
    const room = await requireRoom(event, roomIdentifier)
    await assertBuildingScope(event, user, room.buildingId, 'write')
    const before = await InventoryRepository.listRoom(event, room.id)
    const rows = await InventoryRepository.replaceRoom(event, room.id, items)
    await AuditService.append(event, user, {
      building_id: room.buildingId,
      action: AUDIT_ACTIONS.ROOM_INVENTORY_UPDATED,
      entity_type: 'room',
      entity_id: room.id,
      metadata: diff(before, items),
    })
    return rows.map(mapInventoryItem)
  },
}
```

Add the three audit constants to `app/utils/constants/audit.ts` (near the `ROOM_*` and `BUILDING_*` groups). If an audit-display label map exists for actions (search `app/utils/audit*`), add Vietnamese labels: "Cập nhật nội thất mẫu", "Cập nhật nội thất phòng", "Áp dụng nội thất mẫu".

- [ ] **Step 5: Run tests** → PASS.

- [ ] **Step 6: Commit**

```bash
git add server/repositories/inventory.ts server/services/inventory.ts app/utils/constants/audit.ts tests/server/inventory/inventory-service.test.ts
git commit -m "feat(inventory): repository and service with scope checks"
```

---

### Task 5: Inventory API routes

**Files:**
- Create: `server/api/buildings/[id]/inventory-template/index.get.ts`, `index.put.ts`, `apply.post.ts`
- Create: `server/api/rooms/[id]/inventory.get.ts`, `inventory.put.ts`
- Test: `tests/server/inventory/inventory-api.test.ts`

**Interfaces:**
- `GET /api/buildings/[id]/inventory-template` → `{ data: InventoryItem[] }`
- `PUT /api/buildings/[id]/inventory-template` body `{ items: InventoryItemInput[] }` → `{ data: InventoryItem[] }`
- `POST /api/buildings/[id]/inventory-template/apply` body `InventoryApplyInput` → `{ data: { appliedRooms, addedItems } }`
- `GET /api/rooms/[id]/inventory` → `{ data: InventoryItem[] }`
- `PUT /api/rooms/[id]/inventory` body `{ items }` → `{ data: InventoryItem[] }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/inventory/inventory-api.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const svc = vi.hoisted(() => ({ getTemplate: vi.fn(), saveTemplate: vi.fn(), applyTemplate: vi.fn(), getRoom: vi.fn(), saveRoom: vi.fn() }))
const g = vi.hoisted(() => ({ requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn() }))

vi.mock('../../../server/services/inventory', () => ({ InventoryService: svc }))
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('requireAuth', g.requireAuth)
vi.stubGlobal('getRouterParam', g.getRouterParam)
vi.stubGlobal('readBody', g.readBody)
vi.stubGlobal('throwValidationError', (message: string, details?: unknown) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message, details } } }
})

beforeEach(() => {
  vi.clearAllMocks()
  g.requireAuth.mockResolvedValue({ id: 'o-1' })
  g.getRouterParam.mockReturnValue('x')
})

describe('inventory API', () => {
  it('PUT template validates and forwards parsed items', async () => {
    g.readBody.mockResolvedValue({ items: [{ name: 'Giường' }] })
    svc.saveTemplate.mockResolvedValue([])
    const { default: h } = await import('../../../server/api/buildings/[id]/inventory-template/index.put')
    await h({} as never)
    expect(svc.saveTemplate).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'x',
      [{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }])
  })

  it('PUT room rejects duplicate names with 422', async () => {
    g.readBody.mockResolvedValue({ items: [{ name: 'Tủ' }, { name: 'tủ' }] })
    const { default: h } = await import('../../../server/api/rooms/[id]/inventory.put')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 422 })
    expect(svc.saveRoom).not.toHaveBeenCalled()
  })

  it('POST apply validates mode', async () => {
    g.readBody.mockResolvedValue({ room_ids: ['7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'], mode: 'wipe' })
    const { default: h } = await import('../../../server/api/buildings/[id]/inventory-template/apply.post')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 422 })
  })

  it('GET room wraps data', async () => {
    svc.getRoom.mockResolvedValue([{ id: 'i-1' }])
    const { default: h } = await import('../../../server/api/rooms/[id]/inventory.get')
    await expect(h({} as never)).resolves.toEqual({ data: [{ id: 'i-1' }] })
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement routes** (pattern; repeat per file):

```ts
// server/api/buildings/[id]/inventory-template/index.put.ts
import { z } from 'zod'
import { inventoryListSchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../../services/inventory'

const bodySchema = z.object({ items: inventoryListSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách nội thất không hợp lệ', result.error.flatten())
  return { data: await InventoryService.saveTemplate(event, user, id, result.data.items) }
})
```

```ts
// server/api/buildings/[id]/inventory-template/index.get.ts
import { InventoryService } from '../../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await InventoryService.getTemplate(event, user, getRouterParam(event, 'id')!) }
})
```

```ts
// server/api/buildings/[id]/inventory-template/apply.post.ts
import { inventoryApplySchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = inventoryApplySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Yêu cầu áp dụng không hợp lệ', result.error.flatten())
  return { data: await InventoryService.applyTemplate(event, user, id, result.data) }
})
```

```ts
// server/api/rooms/[id]/inventory.get.ts
import { InventoryService } from '../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await InventoryService.getRoom(event, user, getRouterParam(event, 'id')!) }
})
```

```ts
// server/api/rooms/[id]/inventory.put.ts
import { z } from 'zod'
import { inventoryListSchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../services/inventory'

const bodySchema = z.object({ items: inventoryListSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách nội thất không hợp lệ', result.error.flatten())
  return { data: await InventoryService.saveRoom(event, user, id, result.data.items) }
})
```

Check that `server/api/rooms/[id].get.ts` and a new `server/api/rooms/[id]/inventory.get.ts` coexist under Nitro routing (they do: `[id].get.ts` and `[id]/…` are distinct). If the rooms API uses `[code]` instead of `[id]`, match the existing param name.

- [ ] **Step 4: Run tests** → PASS. Regenerate `docs/api-inventory.md` with `node scripts/generate-api-inventory.mjs`.

- [ ] **Step 5: Commit**

```bash
git add server/api/buildings/[id]/inventory-template server/api/rooms/[id] tests/server/inventory/inventory-api.test.ts docs/api-inventory.md
git commit -m "feat(api): inventory template and room inventory endpoints"
```

---

### Task 6: Batch rooms for an existing building

**Files:**
- Modify: `server/repositories/rooms/index.ts` (add `createBatch`)
- Modify: `server/services/rooms/index.ts` (add `createBatch`)
- Create: `server/api/buildings/[id]/rooms/batch.post.ts`
- Test: `tests/server/rooms-batch.api.test.ts`

**Interfaces:**
- Consumes: `roomBatchCreateSchema` (Task 2); `throwBuildingSetupError` (PR0); `mapRoom`.
- Produces:
  ```ts
  RoomRepository.createBatch(event, buildingId, rooms: QuickRoomInput[], opts: { applyInventory: boolean; actorId: string; requestId: string }): Promise<{ rooms: Room[]; replayed: boolean }>
  RoomService.createBatch(event, user, buildingIdentifier, input: RoomBatchCreateInput): Promise<{ rooms: Room[]; replayed: boolean }>
  ```
  `POST /api/buildings/[id]/rooms/batch` → `201 { data: Room[], meta: { room_count, replayed } }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/rooms-batch.api.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const roomRepo = vi.hoisted(() => ({ createBatch: vi.fn() }))
const buildingRepo = vi.hoisted(() => ({ findByIdentifier: vi.fn() }))
const assertBuildingScope = vi.hoisted(() => vi.fn())
const audit = vi.hoisted(() => ({ append: vi.fn(), appendBulk: vi.fn() }))
const g = vi.hoisted(() => ({ requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn() }))

vi.mock('../../server/repositories/rooms', () => ({ RoomRepository: roomRepo }))
vi.mock('../../server/repositories/buildings', () => ({ BuildingRepository: buildingRepo }))
vi.mock('../../server/utils/scope', () => ({ assertBuildingScope, getVisibleBuildingIds: vi.fn() }))
vi.mock('../../server/services/audit', () => ({ AuditService: audit }))
vi.stubGlobal('defineEventHandler', (h: unknown) => h)
vi.stubGlobal('requireAuth', g.requireAuth)
vi.stubGlobal('getRouterParam', g.getRouterParam)
vi.stubGlobal('readBody', g.readBody)
vi.stubGlobal('setResponseStatus', () => {})
vi.stubGlobal('throwValidationError', (message: string, details?: unknown) => {
  throw { statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message, details } } }
})

const REQ = '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'
const body = { request_id: REQ, apply_inventory: true, rooms: [{ room_number: 'P201', floor: 2, monthly_rent: 1, area: null }] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (u: AuthUser, cap: string) => (u.app_metadata?.role === 'owner' ? true : cap === 'rooms.read'))
  g.getRouterParam.mockReturnValue('zeno')
  buildingRepo.findByIdentifier.mockResolvedValue({ id: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
})

describe('POST /api/buildings/[id]/rooms/batch', () => {
  it('creates rooms with inventory and audits bulk', async () => {
    g.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
    g.readBody.mockResolvedValue(body)
    roomRepo.createBatch.mockResolvedValue({ rooms: [{ id: 'r-1', roomNumber: 'P201' }], replayed: false })
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    const res = await h({} as never) as { meta: { room_count: number; replayed: boolean } }
    expect(res.meta).toEqual({ room_count: 1, replayed: false })
    expect(roomRepo.createBatch).toHaveBeenCalledWith(expect.anything(), 'b-1', body.rooms, { applyInventory: true, actorId: 'o-1', requestId: REQ })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'b-1', 'write')
    expect(audit.appendBulk).toHaveBeenCalledTimes(1)
  })

  it('does not audit on replay', async () => {
    g.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
    g.readBody.mockResolvedValue(body)
    roomRepo.createBatch.mockResolvedValue({ rooms: [{ id: 'r-1' }], replayed: true })
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    await h({} as never)
    expect(audit.appendBulk).not.toHaveBeenCalled()
  })

  it('forbids managers', async () => {
    g.requireAuth.mockResolvedValue({ id: 'm-1', app_metadata: { role: 'manager' } })
    g.readBody.mockResolvedValue(body)
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('requires request_id', async () => {
    g.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
    g.readBody.mockResolvedValue({ ...body, request_id: undefined })
    const { default: h } = await import('../../server/api/buildings/[id]/rooms/batch.post')
    await expect(h({} as never)).rejects.toMatchObject({ statusCode: 422 })
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

Repository (append to `RoomRepository`):

```ts
  async createBatch(
    event: H3Event,
    buildingId: string,
    rooms: QuickRoomInput[],
    opts: { applyInventory: boolean; actorId: string; requestId: string },
  ): Promise<{ rooms: Room[]; replayed: boolean }> {
    // Authorization and scope checks are enforced in RoomService.
    const { data, error } = await serverSupabaseClient(event).rpc('create_rooms_batch_idempotent' as never, {
      p_building_id: buildingId,
      p_rooms: rooms.map(room => ({
        room_number: room.room_number,
        slug: slugifyName(room.room_number) || room.room_number.toLowerCase(),
        floor: room.floor,
        monthly_rent: room.monthly_rent,
        area: room.area,
      })),
      p_apply_inventory: opts.applyInventory,
      p_actor_id: opts.actorId,
      p_request_id: opts.requestId,
    } as never)
    if (error) {
      throwBuildingSetupError(error)
      throwDbError(error, 'rooms.createBatch')
    }
    const result = data as unknown as { rooms: Parameters<typeof mapRoom>[0][]; replayed: boolean }
    return { rooms: result.rooms.map(mapRoom), replayed: result.replayed }
  },
```

Import `throwBuildingSetupError` from `../buildings` (PR0 export) and `QuickRoomInput` from `~/utils/validators/buildings`.

Service (append to `RoomService`):

```ts
  async createBatch(event: H3Event, user: AuthUser, buildingIdentifier: string, input: RoomBatchCreateInput) {
    requireCapability(user, 'rooms.create', 'Không có quyền tạo phòng')
    const building = await BuildingRepository.findByIdentifier(event, buildingIdentifier)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, building.id, 'write')
    const result = await RoomRepository.createBatch(event, building.id, input.rooms, {
      applyInventory: input.apply_inventory,
      actorId: user.id,
      requestId: input.request_id,
    })
    if (!result.replayed && result.rooms.length > 0) {
      await AuditService.appendBulk(event, user, {
        building_id: building.id,
        entity_type: 'room',
        aggregate_action: 'room.bulk_create',
        items: result.rooms.map(room => ({ entity_id: room.id, action: AUDIT_ACTIONS.ROOM_CREATED, after_data: room })),
        succeeded: result.rooms.map(room => room.id),
        total: result.rooms.length,
        failed: 0,
      })
    }
    return result
  },
```

Route:

```ts
// server/api/buildings/[id]/rooms/batch.post.ts
import { roomBatchCreateSchema } from '~/utils/validators/inventory'
import { RoomService } from '../../../../services/rooms'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = roomBatchCreateSchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách phòng không hợp lệ', result.error.flatten())
  const { rooms, replayed } = await RoomService.createBatch(event, user, id, result.data)
  setResponseStatus(event, replayed ? 200 : 201)
  return { data: rooms, meta: { room_count: rooms.length, replayed } }
})
```

Check: `server/api/buildings/[id]/rooms/[room].get.ts` already exists; `batch.post.ts` is a static segment and takes precedence over `[room]` for POST. Confirm there is no `[room].post.ts`.

- [ ] **Step 4: Run tests** → PASS. Regenerate api inventory.

- [ ] **Step 5: Commit**

```bash
git add server/repositories/rooms/index.ts server/services/rooms/index.ts server/api/buildings/[id]/rooms/batch.post.ts tests/server/rooms-batch.api.test.ts docs/api-inventory.md
git commit -m "feat(rooms): idempotent batch room creation for existing buildings"
```

---

### Task 7: Contract handover inventory (create + read)

**Files:**
- Modify: `app/utils/validators/contracts.ts` (`contractCreateSchema` gains `inventory`)
- Modify: `server/services/contracts/index.ts` (`create`)
- Modify: `server/repositories/contracts/index.ts` (`createWithHandover`, add `findHandoverInventory`)
- Create: `server/api/contracts/[id]/handover-inventory.get.ts`
- Test: extend `tests/server/contracts.api.test.ts`; create `tests/server/contracts/handover-inventory.test.ts`

**Interfaces:**
- `contractCreateSchema` adds `inventory: inventoryListSchema.optional()` (keep `.strict()`).
- `ContractRepository.createWithHandover(event, input, recordedBy, inventory: InventoryItemInput[])` — always calls `create_contract_with_handover_and_inventory` with `p_inventory` (empty array allowed).
- `ContractRepository.findHandoverInventory(event, contractId): Promise<HandoverInventory>`
- `GET /api/contracts/[id]/handover-inventory` → `{ data: HandoverInventory }`

- [ ] **Step 1: Write failing tests**

Extend the create describe in `tests/server/contracts.api.test.ts` (add `inventoryRepoMocks = { listRoom: vi.fn() }` and `vi.mock('../../server/repositories/inventory', () => ({ InventoryRepository: inventoryRepoMocks }))`):

```ts
it('snapshots room inventory when client sends none', async () => {
  inventoryRepoMocks.listRoom.mockResolvedValue([
    { id: 'i-1', name: 'Giường', quantity: 1, condition: 'good', unit_value: '2000000', note: null, sort_order: 0 },
  ])
  // reuse the existing happy-path arrangement for create (room, conflicts, createWithHandover resolved)
  await handler(makeEvent({ body: validCreateBody }))
  expect(contractRepoMocks.createWithHandover).toHaveBeenCalledWith(
    expect.anything(), expect.anything(), expect.anything(),
    [{ name: 'Giường', quantity: 1, condition: 'good', unit_value: 2000000, note: null }],
  )
})

it('uses client inventory when provided', async () => {
  const inventory = [{ name: 'Tủ', quantity: 1, condition: 'used', unit_value: null, note: 'Trầy cửa' }]
  await handler(makeEvent({ body: { ...validCreateBody, inventory } }))
  expect(inventoryRepoMocks.listRoom).not.toHaveBeenCalled()
  expect(contractRepoMocks.createWithHandover.mock.calls[0]![3]).toEqual(inventory)
})

it('creates with empty handover when room has no inventory', async () => {
  inventoryRepoMocks.listRoom.mockResolvedValue([])
  await handler(makeEvent({ body: validCreateBody }))
  expect(contractRepoMocks.createWithHandover.mock.calls[0]![3]).toEqual([])
})
```

(`validCreateBody` / `handler` / arrangement: use the names the existing create tests already define.)

```ts
// tests/server/contracts/handover-inventory.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const from = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ from }) }))

function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'order']) c[m] = () => c
  c.maybeSingle = async () => result
  c.then = (resolve: (v: unknown) => void) => resolve(result)
  return c
}

beforeEach(() => vi.clearAllMocks())

describe('ContractRepository.findHandoverInventory', () => {
  it('walks previous_contract_id to the original contract', async () => {
    from.mockImplementation((table: string) => {
      if (table === 'contracts') {
        return chain({ data: null, error: null })
      }
      return chain({ data: [], error: null })
    })
    // Arrange: c-3 → c-2 → c-1 (c-1 has items). Implement mock per call order:
    const contractsCalls = [
      { data: { id: 'c-3', contract_code: 'hd-3', previous_contract_id: 'c-2' }, error: null },
      { data: { id: 'c-2', contract_code: 'hd-2', previous_contract_id: 'c-1' }, error: null },
      { data: { id: 'c-1', contract_code: 'hd-1', previous_contract_id: null }, error: null },
    ]
    const itemsCalls = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ id: 'i-1', name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null, sort_order: 0 }], error: null },
    ]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : itemsCalls.shift()))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-3')
    expect(res).toMatchObject({ sourceContractId: 'c-1', sourceContractCode: 'hd-1', items: [{ name: 'Giường' }] })
  })

  it('returns empty when no contract in the chain has items', async () => {
    const contractsCalls = [{ data: { id: 'c-1', contract_code: 'hd-1', previous_contract_id: null }, error: null }]
    from.mockImplementation((table: string) => chain(table === 'contracts' ? contractsCalls.shift() : { data: [], error: null }))
    const { ContractRepository } = await import('../../../server/repositories/contracts')
    const res = await ContractRepository.findHandoverInventory({ context: {} } as never, 'c-1')
    expect(res).toEqual({ sourceContractId: null, sourceContractCode: null, items: [] })
  })
})
```

If the contracts repository uses a different client accessor (e.g. `serverSupabaseClient` alias), mock that module path instead.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

Validator — in `contractCreateSchema` object add (before `.strict()`):

```ts
  inventory: inventoryListSchema.optional(),
```

with `import { inventoryListSchema } from './inventory'`.

Service — in `ContractService.create`, before `ContractRepository.createWithHandover(...)`:

```ts
    const inventory = input.inventory
      ?? (await InventoryRepository.listRoom(event, room.id)).map(row => ({
        name: row.name,
        quantity: row.quantity,
        condition: row.condition as InventoryItemInput['condition'],
        unit_value: row.unit_value === null ? null : Number(row.unit_value),
        note: row.note,
      }))
```

and pass `inventory` as the new 4th argument. Strip `inventory` from the object passed as `input` if `createWithHandover` spreads it anywhere (it doesn't today; it reads named fields).

Repository — in `createWithHandover`, add parameter `inventory: InventoryItemInput[]`, add `p_inventory: inventory` to `args`, and change the RPC name to `'create_contract_with_handover_and_inventory'` (cast `as never` for the name and args until types are regenerated). Keep the existing conflict mapping. Add:

```ts
  async findHandoverInventory(event: H3Event, contractId: string): Promise<HandoverInventory> {
    const client = serverSupabaseClient(event)
    let currentId: string | null = contractId
    for (let depth = 0; currentId && depth < 20; depth++) {
      const { data: contract, error } = await client
        .from('contracts')
        .select('id, contract_code, previous_contract_id')
        .eq('id', currentId)
        .maybeSingle()
      if (error) throwDbError(error, 'contracts.findHandoverInventory.contract')
      if (!contract) break
      const { data: items, error: itemsError } = await client
        .from('contract_inventory_items' as never)
        .select('id, name, quantity, condition, unit_value, note, sort_order')
        .eq('contract_id', contract.id)
        .order('sort_order')
      if (itemsError) throwDbError(itemsError, 'contracts.findHandoverInventory.items')
      if (items && (items as unknown[]).length > 0) {
        return {
          sourceContractId: contract.id,
          sourceContractCode: contract.contract_code,
          items: (items as InventoryRow[]).map(mapInventoryItem),
        }
      }
      currentId = contract.previous_contract_id
    }
    return { sourceContractId: null, sourceContractCode: null, items: [] }
  },
```

Service (append to `ContractService`):

```ts
  async getHandoverInventory(event: H3Event, user: AuthUser, identifier: string): Promise<HandoverInventory> {
    requireCapability(user, 'contracts.read', 'Không có quyền xem hợp đồng')
    const contract = await ContractRepository.findByIdentifier(event, identifier)
    if (!contract) throwNotFound('Không tìm thấy hợp đồng')
    await assertBuildingScope(event, user, contract.buildingId, 'read')
    return ContractRepository.findHandoverInventory(event, contract.id)
  },
```

Route:

```ts
// server/api/contracts/[id]/handover-inventory.get.ts
import { ContractService } from '../../../services/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await ContractService.getHandoverInventory(event, user, getRouterParam(event, 'id')!) }
})
```

Match the contracts route param name (`[id]` vs `[code]`) used by existing `server/api/contracts/**` files. Check `contract.buildingId` is the DTO field name (`ContractWithDetails`).

- [ ] **Step 4: Run tests** → PASS (including all existing contract tests). Regenerate api inventory.

- [ ] **Step 5: Commit**

```bash
git add app/utils/validators/contracts.ts server/services/contracts/index.ts server/repositories/contracts/index.ts server/api/contracts/[id]/handover-inventory.get.ts tests/server/contracts.api.test.ts tests/server/contracts/handover-inventory.test.ts docs/api-inventory.md
git commit -m "feat(contracts): capture and read handover inventory"
```

---

### Task 8: Shared UI components (UI polish gate)

**Files:**
- Create: `app/components/inventory/InventoryItemsEditor.vue`
- Create: `app/components/inventory/InventoryItemsList.vue`
- Create: `app/components/rooms/RoomBatchGenerator.vue`
- Test: `tests/components/inventory/InventoryItemsEditor.test.ts`, `tests/components/inventory/InventoryItemsList.test.ts`, `tests/components/rooms/RoomBatchGenerator.test.ts`

**Interfaces:**
- `InventoryItemsEditor` props `{ modelValue: InventoryItemInput[]; disabled?: boolean; errors?: Record<string, string> }`, emits `update:modelValue`. Rows: name (`UiInput`), quantity, condition (`UiSelect` with `INVENTORY_CONDITION_LABELS`), unit value (currency), note; add-row button; remove-row button per row; shows validator errors from `inventoryListSchema` (keyed `"{index}.name"`). Footer: total value via `inventoryTotalValue`.
- `InventoryItemsList` props `{ items: InventoryItem[]; emptyText?: string; sourceNote?: string | null }`.
- `RoomBatchGenerator` props `{ preview: ReturnType<typeof useQuickRoomPreview> }` — renders generator inputs bound to `preview.generator`, error message for `preview.generatorError`, preview grouped by floor with editable floor/rent/area (as PR0), "existing" badge rows (excluded), remove-row action, add-row form (room number + floor).

- [ ] **Step 1: UI polish workflow** — read `.agents/skills/zeno-house/references/ui-polish-workflow.md`; apply `frontend-design` + Hallmark; decide table vs card layout on mobile, density, error placement, generator field grouping, and copy. Record in `docs/changes/room-setup-inventory-lite/verification.md` → "UI decisions". New tokens/primitives: stop and ask.

- [ ] **Step 2: Write failing tests**

```ts
// tests/components/inventory/InventoryItemsEditor.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InventoryItemsEditor from '~/components/inventory/InventoryItemsEditor.vue'

const item = (name: string) => ({ name, quantity: 1, condition: 'good' as const, unit_value: 1000, note: null })

describe('InventoryItemsEditor', () => {
  it('adds and removes rows', async () => {
    const w = mount(InventoryItemsEditor, { props: { modelValue: [item('Giường')] } })
    await w.find('[data-test="inventory-add"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toHaveLength(2)
    await w.find('[data-test="inventory-remove-0"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toEqual([])
  })

  it('shows total value', () => {
    const w = mount(InventoryItemsEditor, { props: { modelValue: [item('A'), { ...item('B'), quantity: 2 }] } })
    expect(w.find('[data-test="inventory-total"]').text()).toContain('3.000')
  })

  it('shows error for a duplicate row', () => {
    const w = mount(InventoryItemsEditor, { props: { modelValue: [item('Tủ'), item('tủ')], errors: { '1.name': '"tủ" bị trùng' } } })
    expect(w.text()).toContain('"tủ" bị trùng')
  })
})
```

```ts
// tests/components/inventory/InventoryItemsList.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import InventoryItemsList from '~/components/inventory/InventoryItemsList.vue'

describe('InventoryItemsList', () => {
  it('renders empty text', () => {
    const w = mount(InventoryItemsList, { props: { items: [], emptyText: 'Không có dữ liệu bàn giao' } })
    expect(w.text()).toContain('Không có dữ liệu bàn giao')
  })

  it('renders source note and condition labels', () => {
    const w = mount(InventoryItemsList, {
      props: {
        items: [{ id: 'i', name: 'Tủ', quantity: 1, condition: 'used', unitValue: null, note: null, sortOrder: 0 }],
        sourceNote: 'Theo biên bản bàn giao của hợp đồng hd-1',
      },
    })
    expect(w.text()).toContain('Đã qua sử dụng')
    expect(w.text()).toContain('hd-1')
  })
})
```

```ts
// tests/components/rooms/RoomBatchGenerator.test.ts
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import RoomBatchGenerator from '~/components/rooms/RoomBatchGenerator.vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

describe('RoomBatchGenerator', () => {
  it('groups preview by floor and marks existing rooms', async () => {
    const preview = useQuickRoomPreview()
    preview.enabled.value = true
    preview.generator.value = { floorFrom: 1, floorTo: 2, roomsPerFloor: 2, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
    preview.existingRoomNumbers.value = ['P101']
    await nextTick()
    const w = mount(RoomBatchGenerator, { props: { preview } })
    expect(w.findAll('[data-test="floor-group"]')).toHaveLength(2)
    expect(w.find('[data-test="room-row-P101"]').text()).toContain('Đã có')
  })

  it('shows generator error copy', async () => {
    const preview = useQuickRoomPreview()
    preview.enabled.value = true
    preview.generator.value = { floorFrom: 1, floorTo: 1, roomsPerFloor: 100, prefix: 'P', startSeq: 1, includeFloor: true, nameFloorStart: 1 }
    await nextTick()
    const w = mount(RoomBatchGenerator, { props: { preview } })
    expect(w.text()).toContain('Tối đa 99 phòng mỗi tầng')
  })
})
```

Error copy map (put in the component): `floor_range` → "Khoảng tầng không hợp lệ (1–100, từ tầng ≤ đến tầng).", `rooms_per_floor` → "Tối đa 99 phòng mỗi tầng.", `seq_overflow` → "Số thứ tự vượt quá 99 khi gắn số tầng. Giảm số phòng hoặc số bắt đầu.", `too_many` → "Tối đa 200 phòng mỗi lần tạo."

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement** the three components following Step 1 decisions and the interfaces above; reuse `UiTable`, `UiInput density="compact"`, `UiSelect`, `UiButton`, `UiBadge`, `UiAlert`, `UiCheckbox`. Use existing icon components (`IconPlus`, etc.) — no inline `<svg>`. `data-test` hooks: `inventory-add`, `inventory-remove-{index}`, `inventory-total`, `floor-group`, `room-row-{roomNumber}`.

- [ ] **Step 5: Run tests** → PASS.

- [ ] **Step 6: Commit**

```bash
git add app/components/inventory app/components/rooms/RoomBatchGenerator.vue tests/components/inventory tests/components/rooms/RoomBatchGenerator.test.ts docs/changes/room-setup-inventory-lite/verification.md
git commit -m "feat(ui): inventory editor/list and room batch generator components"
```

---

### Task 9: Building-side pages — create, batch, settings template

**Files:**
- Modify: `app/pages/dashboard/buildings/create.vue`
- Create: `app/pages/dashboard/buildings/[id]/rooms/batch.vue`
- Create: `app/composables/rooms/useRoomBatchCreate.ts`
- Create: `app/composables/inventory/useInventoryTemplate.ts`
- Create: `app/components/inventory/InventoryApplyModal.vue`
- Modify: `app/pages/dashboard/buildings/[id]/settings.vue`
- Modify: `app/pages/dashboard/buildings/[id]/index.vue`, `app/pages/dashboard/rooms/index.vue` (entry buttons)
- Test: `tests/composables/useRoomBatchCreate.test.ts`, `tests/composables/useInventoryTemplate.test.ts`, `tests/pages/building-inventory-pages.spec.ts`

**Interfaces:**
- `useRoomBatchCreate(buildingIdentifier)` → `{ submit(input: { rooms, apply_inventory }): Promise<boolean>; loading; apiError; duplicateRoomNumbers; requestId }` — stable `request_id` per instance, same error handling as PR0 `useBuildingForm.submitCreate`, navigates to `/dashboard/rooms?building_id=<id>` on success.
- `useInventoryTemplate(buildingIdentifier)` → `{ items, loading, saving, error, save(items), apply(input) }` via `GET/PUT …/inventory-template` and `POST …/apply`.

- [ ] **Step 1: Write failing composable tests**

```ts
// tests/composables/useRoomBatchCreate.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('navigateTo', vi.fn(async () => {}))
vi.stubGlobal('clearNuxtData', vi.fn())

beforeEach(() => vi.clearAllMocks())

describe('useRoomBatchCreate', () => {
  const rooms = [{ room_number: 'P201', floor: 2, monthly_rent: 1, area: null }]

  it('posts with a stable request_id across retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: [], meta: { room_count: 1, replayed: true } })
    const { useRoomBatchCreate } = await import('~/composables/rooms/useRoomBatchCreate')
    const { submit } = useRoomBatchCreate('zeno')
    await submit({ rooms, apply_inventory: true })
    await submit({ rooms, apply_inventory: true })
    const [u1, o1] = fetchMock.mock.calls[0]!
    const [, o2] = fetchMock.mock.calls[1]!
    expect(u1).toBe('/api/buildings/zeno/rooms/batch')
    expect(o1.body.request_id).toBe(o2.body.request_id)
  })

  it('exposes duplicates from 409', async () => {
    fetchMock.mockRejectedValue({ statusCode: 409, data: { error: { message: 'Các mã phòng đã tồn tại: P201', details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P201'] } } } })
    const { useRoomBatchCreate } = await import('~/composables/rooms/useRoomBatchCreate')
    const { submit, duplicateRoomNumbers } = useRoomBatchCreate('zeno')
    expect(await submit({ rooms, apply_inventory: false })).toBe(false)
    expect(duplicateRoomNumbers.value).toEqual(['P201'])
  })
})
```

```ts
// tests/composables/useInventoryTemplate.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => vi.clearAllMocks())

describe('useInventoryTemplate', () => {
  it('saves items via PUT and applies via POST', async () => {
    fetchMock.mockResolvedValueOnce({ data: [{ id: 't-1', name: 'Giường' }] })
      .mockResolvedValueOnce({ data: { appliedRooms: 2, addedItems: 3 } })
    const { useInventoryTemplate } = await import('~/composables/inventory/useInventoryTemplate')
    const t = useInventoryTemplate('zeno', { initial: [] })
    await t.save([{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }])
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/buildings/zeno/inventory-template')
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'PUT', body: { items: [{ name: 'Giường' }] } })
    expect(t.items.value).toHaveLength(1)
    const res = await t.apply({ room_ids: ['r-1', 'r-2'], mode: 'merge' })
    expect(res).toEqual({ appliedRooms: 2, addedItems: 3 })
  })
})
```

- [ ] **Step 2: Run to verify failure; implement composables** following `useBuildingForm` (PR0) and `useBuildingContractProfile` (PR1) patterns (`apiFetch`, `getApiErrorMessage`, `getApiErrorDetails`).

- [ ] **Step 3: Write failing page source test**

```ts
// tests/pages/building-inventory-pages.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('building inventory pages', () => {
  it('create page uses the floor generator', () => {
    const page = read('app/pages/dashboard/buildings/create.vue')
    expect(page).toContain('<RoomBatchGenerator')
    expect(page).not.toContain('label="Số lượng phòng"')
  })

  it('batch page loads existing rooms and offers template inventory', () => {
    const page = read('app/pages/dashboard/buildings/[id]/rooms/batch.vue')
    expect(page).toContain('existingRoomNumbers')
    expect(page).toContain('Áp dụng nội thất mẫu')
    expect(page).toContain('useRoomBatchCreate(')
  })

  it('settings page has the inventory template section with apply modal', () => {
    const page = read('app/pages/dashboard/buildings/[id]/settings.vue')
    expect(page).toContain(`id: 'inventory-template'`)
    expect(page).toContain('<InventoryItemsEditor')
    expect(page).toContain('<InventoryApplyModal')
  })
})
```

- [ ] **Step 4: Implement pages**
  - `create.vue`: replace PR0's generator inputs and table with `<RoomBatchGenerator :preview="preview" />`; keep the `enabled` checkbox and submit flow from PR0 unchanged (`preview.toPayload()`).
  - `buildings/[id]/rooms/batch.vue`: fetch building; fetch rooms via `useFetch('/api/rooms', { query: { building_id, limit: 200 } })` and set `preview.existingRoomNumbers`; if the building has > 200 rooms, page through until done. `preview.enabled = true` on mount. Template inventory count from `GET …/inventory-template`; checkbox "Áp dụng nội thất mẫu ({n} món)" disabled with a link to `settings#inventory-template` when `n === 0`. Submit via `useRoomBatchCreate`; watch `duplicateRoomNumbers` → `preview.markServerDuplicates`. Guard with `authStore.can('rooms.create')`.
  - Entry points: "Thêm phòng hàng loạt" item in the rooms list `UiDropdownMenu` (only when a building filter is active; link to `buildings/<id>/rooms/batch`) and a secondary button on the building detail header actions.
  - `settings.vue`: new nav item `{ id: 'inventory-template', label: 'Nội thất mẫu', description: 'Danh sách nội thất áp dụng nhanh cho phòng', badge: `${templateItems.length} món`, visible: authStore.can('rooms.read') }` and a section with `InventoryItemsEditor` (disabled unless `authStore.can('buildings.update')`), save button, and "Áp dụng cho phòng…" opening `InventoryApplyModal`.
  - `InventoryApplyModal.vue`: room multi-select grouped by floor (data from `/api/rooms?building_id=`), select-all, mode radio ("Thêm món còn thiếu" default / "Thay toàn bộ"); choosing "Thay toàn bộ" shows a `UiConfirmModal` step; emits `apply` with `InventoryApplyInput`; shows result toast "Đã thêm {addedItems} món cho {appliedRooms} phòng."

- [ ] **Step 5: Run tests** → PASS. Visual QA (ask before starting a local runtime): create page multi-floor, batch page with existing rooms + template, settings template edit + apply merge/replace, mobile. Record in `verification.md`.

- [ ] **Step 6: Commit**

```bash
git add app/pages/dashboard/buildings app/pages/dashboard/rooms/index.vue app/composables/rooms app/composables/inventory app/components/inventory/InventoryApplyModal.vue tests/composables/useRoomBatchCreate.test.ts tests/composables/useInventoryTemplate.test.ts tests/pages/building-inventory-pages.spec.ts docs/changes/room-setup-inventory-lite/verification.md
git commit -m "feat(ui): floor generator pages and building inventory template"
```

---

### Task 10: Room and contract surfaces — room inventory, contract create, contract detail, checkout

**Files:**
- Create: `app/composables/inventory/useRoomInventory.ts`
- Modify: `app/pages/dashboard/rooms/[code]/index.vue`
- Modify: `app/components/contracts/ContractForm.vue`, `app/pages/dashboard/contracts/create.vue`
- Create: `app/components/contracts/ContractHandoverSection.vue`
- Modify: `app/pages/dashboard/contracts/[code]/index.vue`
- Modify: `app/components/contracts/ContractCheckoutSection.vue`
- Test: `tests/composables/useRoomInventory.test.ts`, `tests/components/contracts/ContractHandoverSection.test.ts`, `tests/pages/room-contract-inventory.spec.ts`

**Interfaces:**
- `useRoomInventory(roomIdentifier)` → `{ items, loading, saving, error, save(items), applyTemplate() }` (`applyTemplate` posts to the building apply endpoint with `room_ids: [room.id], mode: 'merge'`, then refreshes).
- `ContractFormData` gains `inventory: InventoryItemInput[]`; `ContractForm` loads `GET /api/rooms/{room_id}/inventory` when `room_id` changes and sets `inventory` (only if the user has not edited it for that room).
- `ContractHandoverSection` props `{ contractId: string }`; fetches `/api/contracts/{id}/handover-inventory`; renders `InventoryItemsList` with `sourceNote` when `sourceContractId !== contractId`.

- [ ] **Step 1: Write failing tests**

```ts
// tests/composables/useRoomInventory.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
beforeEach(() => vi.clearAllMocks())

describe('useRoomInventory', () => {
  it('saves via PUT /api/rooms/{id}/inventory', async () => {
    fetchMock.mockResolvedValue({ data: [{ id: 'i-1', name: 'Giường' }] })
    const { useRoomInventory } = await import('~/composables/inventory/useRoomInventory')
    const r = useRoomInventory('p101', { roomId: 'r-1', buildingId: 'b-1', initial: [] })
    await r.save([{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }])
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/rooms/p101/inventory')
    expect(r.items.value).toHaveLength(1)
  })

  it('applyTemplate merges for this room only', async () => {
    fetchMock.mockResolvedValueOnce({ data: { appliedRooms: 1, addedItems: 2 } }).mockResolvedValueOnce({ data: [] })
    const { useRoomInventory } = await import('~/composables/inventory/useRoomInventory')
    const r = useRoomInventory('p101', { roomId: 'r-1', buildingId: 'b-1', initial: [] })
    await r.applyTemplate()
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/buildings/b-1/inventory-template/apply')
    expect(fetchMock.mock.calls[0]![1].body).toEqual({ room_ids: ['r-1'], mode: 'merge' })
  })
})
```

```ts
// tests/components/contracts/ContractHandoverSection.test.ts
import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

describe('ContractHandoverSection', () => {
  it('notes when items come from the original contract', async () => {
    fetchMock.mockResolvedValue({ data: { sourceContractId: 'c-1', sourceContractCode: 'hd-1', items: [{ id: 'i', name: 'Tủ', quantity: 1, condition: 'good', unitValue: null, note: null, sortOrder: 0 }] } })
    const { default: C } = await import('~/components/contracts/ContractHandoverSection.vue')
    const w = mount(C, { props: { contractId: 'c-3' } })
    await flushPromises()
    expect(w.text()).toContain('Theo biên bản bàn giao của hợp đồng hd-1')
  })

  it('shows empty state', async () => {
    fetchMock.mockResolvedValue({ data: { sourceContractId: null, sourceContractCode: null, items: [] } })
    const { default: C } = await import('~/components/contracts/ContractHandoverSection.vue')
    const w = mount(C, { props: { contractId: 'c-1' } })
    await flushPromises()
    expect(w.text()).toContain('Không có dữ liệu bàn giao')
  })
})
```

If the component uses `useFetch`, mock it the way existing contract component tests do instead of `$fetch`.

```ts
// tests/pages/room-contract-inventory.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('room and contract inventory surfaces', () => {
  it('room detail has an inventory section', () => {
    const page = read('app/pages/dashboard/rooms/[code]/index.vue')
    expect(page).toContain('<InventoryItemsEditor')
    expect(page).toContain('Áp dụng mẫu tòa')
  })

  it('contract form shows handover inventory and create page sends it', () => {
    expect(read('app/components/contracts/ContractForm.vue')).toContain('Nội thất bàn giao')
    expect(read('app/pages/dashboard/contracts/create.vue')).toContain('inventory: data.inventory')
  })

  it('contract detail and checkout show handover list', () => {
    expect(read('app/pages/dashboard/contracts/[code]/index.vue')).toContain('<ContractHandoverSection')
    expect(read('app/pages/dashboard/contracts/[code]/index.vue')).toContain(`'handover'`)
    expect(read('app/components/contracts/ContractCheckoutSection.vue')).toContain('Nội thất đã bàn giao')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**
  - `useRoomInventory` per interface.
  - Room detail: section after `RoomDetailHero` titled "Nội thất" with `InventoryItemsEditor` (editable when `authStore.can('rooms.update')`), save button, "Áp dụng mẫu tòa" (`UiButton variant="secondary"`), total value line.
  - `ContractForm.vue`: add `inventory: InventoryItemInput[]` to `ContractFormData`; in `selectRoom`, after updating `room_id`, fetch room inventory (`apiFetch(\`/api/rooms/${roomId}/inventory\`)`) and set `inventory` mapped to input shape; render a collapsible `UiFormSection` titled "Nội thất bàn giao ({n} món)" after the handover readings block, containing `InventoryItemsEditor` (or a muted line "Phòng chưa khai báo nội thất." when empty). Initialize `inventory: []` wherever `ContractFormData` defaults are created (create page + draft restore; drafts saved before this change must load with `inventory: []`).
  - `contracts/create.vue` `createContract`: add `inventory: data.inventory` to the `submitCreate` payload.
  - Contract detail: add `'handover'` to `sectionIds` after `'services'` and render `<ContractHandoverSection :contract-id="contract.id" />` with `id="handover"`.
  - `ContractCheckoutSection.vue`: add a collapsible read-only panel "Nội thất đã bàn giao" using `ContractHandoverSection` (or `InventoryItemsList` fed by the same fetch) near the settlement/deduction inputs; no change to calculations.

- [ ] **Step 4: Run tests** → PASS, plus existing `tests/**/contract*` suites (draft restore must not break).

- [ ] **Step 5: Visual QA** (ask before starting a local runtime): room inventory edit/apply, contract create with/without room inventory, contract detail for a renewed contract, checkout panel, mobile. Record in `verification.md`.

- [ ] **Step 6: Commit**

```bash
git add app/composables/inventory/useRoomInventory.ts app/pages/dashboard/rooms app/components/contracts app/pages/dashboard/contracts tests/composables/useRoomInventory.test.ts tests/components/contracts/ContractHandoverSection.test.ts tests/pages/room-contract-inventory.spec.ts docs/changes/room-setup-inventory-lite/verification.md
git commit -m "feat(ui): room inventory, contract handover and checkout reference"
```

---

### Task 11: Full verification and docs

**Files:**
- Modify: `docs/changes/room-setup-inventory-lite/verification.md`, `index.md`

- [ ] **Step 1: Run** `npm run typecheck && npm test && npm run lint && npm run knowledge:check`; fix and record.

- [ ] **Step 2: Complete `verification.md`**

```markdown
---
type: Change Verification
title: "room-setup-inventory-lite-verification"
status: draft
change_state: verification-pending
tags: [change, verification, rooms, inventory]
---

# Room setup & inventory lite — verification

## Local (source)
- [ ] typecheck / test / lint / knowledge:check — <date, result>

## UI decisions
- <from Task 8 Step 1>

## Visual QA
- [ ] Create building multi-floor generator — desktop + mobile
- [ ] Batch page with existing rooms and template
- [ ] Settings template edit; apply merge / replace (confirm)
- [ ] Room inventory edit / apply template
- [ ] Contract create with and without room inventory
- [ ] Contract detail (renewed contract shows source note)
- [ ] Checkout reference panel

## Cloud gates (order matters)
- [ ] PR0 migration present on target env
- [ ] `20261112005547_inventory_lite.sql` applied — <env, date>
- [ ] `supabase/verification/inventory_lite.sql` passed — <output>
- [ ] Types regenerated; `as never` casts removed — <commit>
- [ ] App deployed after migration — <date>
- [ ] Smoke: create contract on a room with inventory; handover list visible
```

- [ ] **Step 3: Update `index.md`** status → `implementation-review`; link plan and verification.

- [ ] **Step 4: Commit**

```bash
git add docs/changes/room-setup-inventory-lite
git commit -m "docs(changes): record PR2 verification evidence"
```

- [ ] **Step 5: Cloud gate (human-run)** — apply migration (after PR0), run verification script, regenerate types, remove casts, re-run typecheck, deploy app, smoke test, update `verification.md`. On acceptance: create `docs/capabilities/room-inventory.md`; update `rooms-api`, `rooms-ui`, `contracts-api`, `buildings-ui`; archive.
