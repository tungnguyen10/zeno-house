---
type: Change Implementation Plan
title: "atomic-building-room-setup-implementation-plan"
status: draft
change_state: plan-review
tags: [superpowers, change, buildings, rooms, migration, v2]
---

# Atomic Building + Room Setup (V2 PR0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Building and its quick-setup Rooms in one atomic, idempotent database transaction, with a preview that keeps per-room edits and supports floor/area.

**Architecture:** Two `SECURITY INVOKER` Postgres functions (`create_rooms_batch` shared core + `create_building_with_rooms` wrapper with `audit_operations` idempotency) called from `BuildingRepository.createWithRooms`. `BuildingService.create` keeps capability checks and writes audit after commit. Client sends one `POST /api/buildings` with `rooms[]` + `request_id`; preview state moves to a testable `useQuickRoomPreview` composable.

**Tech Stack:** Nuxt 3, Vue 3, Zod, Vitest, Supabase (PostgREST RPC), PL/pgSQL.

**Spec:** [design.md](./design.md)

## Global Constraints

- Flow: page/component → composable → server API → service → repository → Supabase. No Supabase table queries from browser code.
- Zod validators live in `app/utils/validators/**` and are used on both client and server.
- Do not hand-edit `app/types/database.types.ts`; regenerate after the migration is applied.
- RPCs: `security invoker`, `set search_path = ''`, `revoke all … from public, anon, authenticated`, `grant execute … to service_role`.
- Batch size: 1–200 rooms. Room `floor`: integer 1–100. `room_number`: 1–20 chars.
- Idempotency key format: `building.create:<request_id>`; replay only when `actor_id` matches.
- Vietnamese copy must have full diacritics; otherwise use English.
- UI: reuse existing design system and primitives; run `frontend-design` + Hallmark per `.agents/skills/zeno-house/references/ui-polish-workflow.md`. New tokens/primitives only after explicit evaluation (problem, option, affected surfaces, benefit, cost) and approval.
- Cloud migration apply and type regeneration are separate gates; never claim them from static tests.
- No inline `<svg>` in templates; icons via `app/assets/icons/` + nuxt-svgo.

## Review Focus

1. **Network drop after commit, then retry** — user must land on the already-created Building, not a duplicate. Pinned in Task 4 (replay test) and Task 7 (stable `request_id` test).
2. **Same `request_id` from a different actor** — must return a generic `409` and no Building data. Pinned in Task 3 (error mapping) and Task 2 verification script.
3. **Editing generator inputs after manual edits** — manual rent/area/floor for rooms still in range must survive. Pinned in Task 6.
4. **Room numbers that differ only by case/accents but share a slug** (e.g. `P101` vs `p101`) — must be reported as duplicates, not a raw 500. Pinned in Task 1 (validator uses slug) and Task 2 SQL.
5. **Building slug race** — two buildings with the same name created concurrently must both succeed with distinct slugs. Pinned in Task 3 (retry test).

---

### Task 1: Validators for building + quick rooms

**Files:**
- Modify: `app/utils/validators/buildings.ts`
- Test: `tests/utils/building-create-with-rooms-validator.test.ts` (create)

**Interfaces:**
- Produces:
  - `quickRoomSchema: z.ZodObject<{ room_number, floor, monthly_rent, area }>`
  - `buildingCreateWithRoomsSchema` (= building fields + `request_id?: string(uuid)` + `rooms?: QuickRoomInput[]` max 200, duplicate check by `slugifyName(room_number)`)
  - `type QuickRoomInput = z.infer<typeof quickRoomSchema>`
  - `type BuildingCreateWithRoomsInput = z.infer<typeof buildingCreateWithRoomsSchema>`
  - `QUICK_ROOM_MAX = 200`

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/building-create-with-rooms-validator.test.ts
import { describe, expect, it } from 'vitest'
import { buildingCreateWithRoomsSchema, QUICK_ROOM_MAX } from '~/utils/validators/buildings'

const base = { name: 'Tòa A', address: '123 Lê Lợi, Quận 1' }
const room = (n: string, extra: Record<string, unknown> = {}) => ({
  room_number: n, floor: 1, monthly_rent: 3_000_000, area: null, ...extra,
})

describe('buildingCreateWithRoomsSchema', () => {
  it('accepts a building without rooms', () => {
    expect(buildingCreateWithRoomsSchema.safeParse(base).success).toBe(true)
  })

  it('accepts rooms with a uuid request_id', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({
      ...base,
      request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f',
      rooms: [room('P101'), room('P102', { floor: 2, area: 20 })],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid request_id', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({ ...base, request_id: 'abc' })
    expect(r.success).toBe(false)
  })

  it('rejects floor outside 1..100', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({ ...base, rooms: [room('P1', { floor: 0 })] })
    expect(r.success).toBe(false)
    const r2 = buildingCreateWithRoomsSchema.safeParse({ ...base, rooms: [room('P1', { floor: 101 })] })
    expect(r2.success).toBe(false)
  })

  it(`rejects more than ${QUICK_ROOM_MAX} rooms`, () => {
    const rooms = Array.from({ length: QUICK_ROOM_MAX + 1 }, (_, i) => room(`P${i + 1}`))
    expect(buildingCreateWithRoomsSchema.safeParse({ ...base, rooms }).success).toBe(false)
  })

  it('reports duplicates (including same slug) at the duplicated index', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({
      ...base,
      rooms: [room('P101'), room('P102'), room('p101')],
    })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map(i => i.path.join('.'))
    expect(paths).toContain('rooms.2.room_number')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/building-create-with-rooms-validator.test.ts`
Expected: FAIL — `buildingCreateWithRoomsSchema` is not exported.

- [ ] **Step 3: Implement**

In `app/utils/validators/buildings.ts`, add the import at the top and the schemas after `buildingCreateSchema`:

```ts
import { slugifyName } from '~/utils/format/slug'
```

```ts
export const QUICK_ROOM_MAX = 200

export const quickRoomSchema = z.object({
  room_number: z.string().trim().min(1, 'Số phòng không được trống').max(20, 'Số phòng quá dài'),
  floor: z.number().int().min(1, 'Tầng phải >= 1').max(100, 'Tầng phải <= 100'),
  monthly_rent: z.number().min(0, 'Giá thuê không được âm'),
  area: z.number().positive('Diện tích phải > 0').nullable(),
})

export const buildingCreateWithRoomsSchema = buildingBaseSchema
  .extend({
    request_id: z.string().uuid('Mã yêu cầu không hợp lệ').optional(),
    rooms: z.array(quickRoomSchema).max(QUICK_ROOM_MAX, `Tối đa ${QUICK_ROOM_MAX} phòng mỗi lần`).optional(),
  })
  .superRefine(validateOperationalStartPair)
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.rooms?.forEach((room, index) => {
      const key = slugifyName(room.room_number) || room.room_number.toLowerCase()
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rooms', index, 'room_number'],
          message: `Mã phòng "${room.room_number}" bị trùng`,
        })
      }
      seen.add(key)
    })
  })

export type QuickRoomInput = z.infer<typeof quickRoomSchema>
export type BuildingCreateWithRoomsInput = z.infer<typeof buildingCreateWithRoomsSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/building-create-with-rooms-validator.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/utils/validators/buildings.ts tests/utils/building-create-with-rooms-validator.test.ts
git commit -m "feat(buildings): add create-with-rooms validator"
```

---

### Task 2: Migration — `create_rooms_batch` + `create_building_with_rooms`

**Files:**
- Create: `supabase/migrations/20261111090000_create_building_with_rooms.sql`
- Create: `supabase/verification/create_building_with_rooms.sql`
- Test: `tests/config/create-building-with-rooms-migration.test.ts` (static contract checks)

**Interfaces:**
- Produces (SQL):
  - `public.create_rooms_batch(p_building_id uuid, p_rooms jsonb) returns setof public.rooms`
    - `p_rooms` elements: `{ room_number text, slug text, floor int, monthly_rent numeric, area numeric|null }`
    - Errors: `ROOM_BATCH_INVALID` (22023), `BUILDING_NOT_FOUND` (P0002), `ROOM_BATCH_DUPLICATE` (23505, `DETAIL` = JSON array of room numbers)
  - `public.create_building_with_rooms(p_building jsonb, p_rooms jsonb, p_assign_owner uuid, p_actor_id uuid, p_request_id uuid) returns jsonb`
    - Returns `{ building: buildings row, rooms: rooms row[], replayed: boolean }`
    - Errors: `BUILDING_SETUP_REQUEST_REQUIRED` (22023), `BUILDING_SETUP_REQUEST_CONFLICT` (23505), plus `create_rooms_batch` errors, plus raw 23505 on `buildings_slug_uq` / `buildings_code_uq`

- [ ] **Step 1: Write the failing static test**

```ts
// tests/config/create-building-with-rooms-migration.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111090000_create_building_with_rooms.sql'), 'utf8')

describe('create_building_with_rooms migration', () => {
  it('defines both functions as security invoker with empty search_path', () => {
    expect(sql).toMatch(/function public\.create_rooms_batch\([\s\S]*?security invoker[\s\S]*?set search_path = ''/)
    expect(sql).toMatch(/function public\.create_building_with_rooms\([\s\S]*?security invoker[\s\S]*?set search_path = ''/)
  })

  it('restricts execution to service_role', () => {
    expect(sql).toContain('revoke all on function public.create_rooms_batch(uuid, jsonb) from public, anon, authenticated;')
    expect(sql).toContain('grant execute on function public.create_rooms_batch(uuid, jsonb) to service_role;')
    expect(sql).toContain('revoke all on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) from public, anon, authenticated;')
    expect(sql).toContain('grant execute on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) to service_role;')
  })

  it('uses namespaced idempotency key and actor check', () => {
    expect(sql).toContain(`'building.create:' || p_request_id::text`)
    expect(sql).toContain('v_op.actor_id is distinct from p_actor_id')
  })

  it('serializes per building and per request', () => {
    expect(sql).toContain(`pg_advisory_xact_lock(hashtextextended('rooms_batch:' || p_building_id::text, 0))`)
    expect(sql).toContain('pg_advisory_xact_lock(hashtextextended(v_key, 0))')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/create-building-with-rooms-migration.test.ts`
Expected: FAIL — ENOENT for the migration file.

- [ ] **Step 3: Write the migration**

```sql
-- =============================================================================
-- Atomic Building + bulk Room creation (V2 PR0)
-- =============================================================================
-- Adds create_rooms_batch (shared core, reused by PR2) and
-- create_building_with_rooms (Building + owner assignment + rooms +
-- idempotency marker in one transaction).
--
-- Data impact: ADDITIVE ONLY. No tables, columns, indexes or policies change.
-- Execution model: apply manually in the Supabase Dashboard SQL Editor, then
-- regenerate database types:
--   npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--     --schema public > app/types/database.types.ts
-- Idempotency: CREATE OR REPLACE makes re-runs safe.
-- =============================================================================

create or replace function public.create_rooms_batch(
  p_building_id uuid,
  p_rooms jsonb
) returns setof public.rooms
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_building_code text;
  v_count integer;
  v_dups jsonb;
begin
  if p_rooms is null or jsonb_typeof(p_rooms) <> 'array' then
    raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_rooms);
  if v_count < 1 or v_count > 200 then
    raise exception 'ROOM_BATCH_INVALID' using errcode = '22023';
  end if;

  select code into v_building_code from public.buildings where id = p_building_id;
  if v_building_code is null then
    raise exception 'BUILDING_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('rooms_batch:' || p_building_id::text, 0));

  with input as (
    select r.room_number, r.slug
    from jsonb_to_recordset(p_rooms) as r(room_number text, slug text)
  )
  select coalesce(jsonb_agg(distinct d.room_number order by d.room_number), '[]'::jsonb)
  into v_dups
  from (
    select i.room_number
    from input i
    where (select count(*) from input j where j.room_number = i.room_number or j.slug = i.slug) > 1
       or exists (
         select 1 from public.rooms r
         where r.building_id = p_building_id
           and (r.room_number = i.room_number or r.slug = i.slug)
       )
  ) d;

  if jsonb_array_length(v_dups) > 0 then
    raise exception 'ROOM_BATCH_DUPLICATE' using errcode = '23505', detail = v_dups::text;
  end if;

  return query
  insert into public.rooms (building_id, room_number, slug, code, floor, status, monthly_rent, area)
  select p_building_id, r.room_number, r.slug, v_building_code || '-' || r.slug,
         r.floor, 'available', r.monthly_rent, r.area
  from jsonb_to_recordset(p_rooms) as r(room_number text, slug text, floor integer, monthly_rent numeric, area numeric)
  returning *;
end;
$$;

revoke all on function public.create_rooms_batch(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_rooms_batch(uuid, jsonb) to service_role;

create or replace function public.create_building_with_rooms(
  p_building jsonb,
  p_rooms jsonb,
  p_assign_owner uuid,
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
  v_building public.buildings%rowtype;
  v_rooms jsonb := '[]'::jsonb;
begin
  if p_request_id is null or p_actor_id is null then
    raise exception 'BUILDING_SETUP_REQUEST_REQUIRED' using errcode = '22023';
  end if;

  v_key := 'building.create:' || p_request_id::text;
  -- Concurrent retries with the same key wait here, then replay.
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select * into v_op from public.audit_operations where idempotency_key = v_key;
  if found then
    if v_op.actor_id is distinct from p_actor_id or v_op.entity_id is null then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select * into v_building from public.buildings where id = v_op.entity_id;
    if not found then
      raise exception 'BUILDING_SETUP_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb)
    into v_rooms
    from public.rooms r where r.building_id = v_building.id;
    return jsonb_build_object('building', to_jsonb(v_building), 'rooms', v_rooms, 'replayed', true);
  end if;

  insert into public.buildings (
    slug, code, name, address, description, status,
    owner_name, owner_phone, owner_email, created_by, owner_user_id,
    electricity_pricing_type, default_electricity_rate,
    water_pricing_type, default_water_rate,
    meter_reading_day, billing_generation_day, payment_due_day, grace_period_days,
    operational_start_year, operational_start_month
  )
  select
    b.slug, b.code, b.name, b.address, b.description, b.status,
    b.owner_name, b.owner_phone, b.owner_email, b.created_by, b.owner_user_id,
    b.electricity_pricing_type, b.default_electricity_rate,
    b.water_pricing_type, b.default_water_rate,
    b.meter_reading_day, b.billing_generation_day, b.payment_due_day, b.grace_period_days,
    b.operational_start_year, b.operational_start_month
  from jsonb_populate_record(null::public.buildings, p_building) b
  returning * into v_building;

  if p_assign_owner is not null then
    insert into public.user_building_assignments (user_id, building_id, can_delete_master_data, created_by)
    values (p_assign_owner, v_building.id, false, p_actor_id);
  end if;

  if p_rooms is not null and jsonb_typeof(p_rooms) = 'array' and jsonb_array_length(p_rooms) > 0 then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.room_number), '[]'::jsonb)
    into v_rooms
    from public.create_rooms_batch(v_building.id, p_rooms) r;
  end if;

  -- Completed marker only; the outbox reconciler claims pending/executing rows.
  insert into public.audit_operations (
    idempotency_key, actor_id, building_id, action, entity_type, entity_id,
    intent_data, status, completed_at
  ) values (
    v_key, p_actor_id, v_building.id, 'building.create', 'building', v_building.id,
    jsonb_build_object('room_count', jsonb_array_length(v_rooms)), 'completed', now()
  );

  return jsonb_build_object('building', to_jsonb(v_building), 'rooms', v_rooms, 'replayed', false);
end;
$$;

revoke all on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_building_with_rooms(jsonb, jsonb, uuid, uuid, uuid) to service_role;
```

- [ ] **Step 4: Write the cloud verification script**

`supabase/verification/create_building_with_rooms.sql` — runs entirely inside `begin; … rollback;`, raises on failure, follows `atomic_contract_renewal.sql` style:

```sql
-- Verification for create_building_with_rooms (V2 PR0). Run in SQL Editor as service_role.
-- Everything is rolled back; no data is kept.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_req uuid := gen_random_uuid();
  v_res jsonb;
  v_res2 jsonb;
  v_building_id uuid;
  v_count_before integer;
  v_failed boolean;
  v_building jsonb := jsonb_build_object(
    'slug', 'pr0-verify-' || substr(gen_random_uuid()::text, 1, 8),
    'code', 'pr0v' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6),
    'name', 'PR0 verify', 'address', '123 Verify Street', 'status', 'active',
    'electricity_pricing_type', 'per_kwh', 'water_pricing_type', 'per_m3', 'grace_period_days', 0,
    'created_by', null, 'owner_user_id', null
  );
begin
  if v_actor is null then raise exception 'VERIFY: need at least one auth.users row'; end if;

  -- 1. Happy path with 2 rooms on 2 floors.
  v_res := public.create_building_with_rooms(v_building, jsonb_build_array(
    jsonb_build_object('room_number', 'P101', 'slug', 'p101', 'floor', 1, 'monthly_rent', 3000000, 'area', null),
    jsonb_build_object('room_number', 'P201', 'slug', 'p201', 'floor', 2, 'monthly_rent', 3500000, 'area', 22)
  ), null, v_actor, v_req);
  v_building_id := (v_res->'building'->>'id')::uuid;
  if jsonb_array_length(v_res->'rooms') <> 2 or (v_res->>'replayed')::boolean then
    raise exception 'VERIFY 1 failed: %', v_res;
  end if;
  if (select code from public.rooms where building_id = v_building_id and room_number = 'P101')
     <> (v_building->>'code') || '-p101' then
    raise exception 'VERIFY 1 failed: room code composition';
  end if;

  -- 2. Replay with same actor returns same building, no new rows.
  select count(*) into v_count_before from public.buildings;
  v_res2 := public.create_building_with_rooms(v_building, '[]'::jsonb, null, v_actor, v_req);
  if (v_res2->'building'->>'id')::uuid <> v_building_id or not (v_res2->>'replayed')::boolean
     or (select count(*) from public.buildings) <> v_count_before then
    raise exception 'VERIFY 2 failed: %', v_res2;
  end if;

  -- 3. Same request id, different actor -> conflict, no data.
  v_failed := false;
  begin
    perform public.create_building_with_rooms(v_building, '[]'::jsonb, null, gen_random_uuid(), v_req);
  exception when others then
    v_failed := sqlerrm = 'BUILDING_SETUP_REQUEST_CONFLICT';
  end;
  if not v_failed then raise exception 'VERIFY 3 failed: foreign actor replay not rejected'; end if;

  -- 4. Duplicate room rolls back the whole call (no orphan building).
  select count(*) into v_count_before from public.buildings;
  v_failed := false;
  begin
    perform public.create_building_with_rooms(
      v_building || jsonb_build_object('slug', 'pr0-verify-dup', 'code', 'pr0vdup'),
      jsonb_build_array(
        jsonb_build_object('room_number', 'A1', 'slug', 'a1', 'floor', 1, 'monthly_rent', 1, 'area', null),
        jsonb_build_object('room_number', 'a1', 'slug', 'a1', 'floor', 1, 'monthly_rent', 1, 'area', null)
      ), null, v_actor, gen_random_uuid());
  exception when others then
    v_failed := sqlerrm = 'ROOM_BATCH_DUPLICATE';
  end;
  if not v_failed or (select count(*) from public.buildings) <> v_count_before then
    raise exception 'VERIFY 4 failed: duplicate batch not rolled back';
  end if;

  -- 5. Batch into existing building rejects existing room number.
  v_failed := false;
  begin
    perform public.create_rooms_batch(v_building_id, jsonb_build_array(
      jsonb_build_object('room_number', 'P101', 'slug', 'p101', 'floor', 1, 'monthly_rent', 1, 'area', null)));
  exception when others then
    v_failed := sqlerrm = 'ROOM_BATCH_DUPLICATE';
  end;
  if not v_failed then raise exception 'VERIFY 5 failed: existing room not detected'; end if;

  raise notice 'create_building_with_rooms verification passed';
end $$;

-- 6. Grants.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('create_rooms_batch', 'create_building_with_rooms');
-- Expected: anon_exec = false, auth_exec = false, service_exec = true for both rows.

rollback;
```

Concurrency (two sessions, same building) is checked manually during the cloud gate: open two SQL Editor tabs, run `begin; select public.create_rooms_batch('<id>', '[{"room_number":"X1","slug":"x1","floor":1,"monthly_rent":1,"area":null}]');` in both without committing; the second must block until the first ends, then fail with `ROOM_BATCH_DUPLICATE` if the first committed.

- [ ] **Step 5: Run static test**

Run: `npx vitest run tests/config/create-building-with-rooms-migration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261111090000_create_building_with_rooms.sql supabase/verification/create_building_with_rooms.sql tests/config/create-building-with-rooms-migration.test.ts
git commit -m "feat(db): add atomic create_building_with_rooms RPC"
```

---

### Task 3: Repository `createWithRooms` + error mapping

**Files:**
- Modify: `server/repositories/buildings/index.ts`
- Test: `tests/server/buildings/create-with-rooms-repository.test.ts` (create)

**Interfaces:**
- Consumes: `QuickRoomInput`, `BuildingCreateInput` (Task 1); SQL functions (Task 2).
- Produces:
  ```ts
  export interface BuildingSetupResult { building: Building; rooms: Room[]; replayed: boolean }
  BuildingRepository.createWithRooms(
    event: H3Event,
    input: BuildingCreateInput,
    rooms: QuickRoomInput[],
    opts: { actorId: string; ownerUserId: string | null; requestId: string },
  ): Promise<BuildingSetupResult>
  export function throwBuildingSetupError(error: unknown): void // throws mapped error or returns if unknown
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/buildings/create-with-rooms-repository.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc, from }) }))

function slugLookupReturnsEmpty() {
  // Covers buildUniqueSlug/Code (.limit) and attachServiceSummaries (.in).
  const chain = {
    select: () => chain, eq: () => chain, neq: () => chain,
    limit: async () => ({ data: [], error: null }),
    in: async () => ({ data: [], error: null }),
  }
  from.mockReturnValue(chain)
}

const buildingRow = {
  id: 'b-1', slug: 'toa-a', code: 'toaa', name: 'Tòa A', address: '123 Lê Lợi', description: null,
  status: 'active', owner_name: null, owner_phone: null, owner_email: null,
  electricity_pricing_type: 'per_kwh', default_electricity_rate: null, water_pricing_type: 'per_m3',
  default_water_rate: null, meter_reading_day: null, billing_generation_day: null, payment_due_day: null,
  grace_period_days: 0, created_by: 'u-1', owner_user_id: null,
  created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}

const input = { name: 'Tòa A', address: '123 Lê Lợi', status: 'active', electricity_pricing_type: 'per_kwh', water_pricing_type: 'per_m3', grace_period_days: 0 } as never
const opts = { actorId: 'u-1', ownerUserId: null, requestId: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' }

beforeEach(() => {
  vi.clearAllMocks()
  slugLookupReturnsEmpty()
})

describe('BuildingRepository.createWithRooms', () => {
  it('sends slugged rooms and provenance to the RPC', async () => {
    rpc.mockResolvedValue({ data: { building: buildingRow, rooms: [], replayed: false }, error: null })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await BuildingRepository.createWithRooms({ context: {} } as never, input, [
      { room_number: 'P 101', floor: 1, monthly_rent: 1, area: null },
    ], opts)

    expect(rpc).toHaveBeenCalledWith('create_building_with_rooms', expect.objectContaining({
      p_actor_id: 'u-1',
      p_assign_owner: null,
      p_request_id: opts.requestId,
      p_rooms: [{ room_number: 'P 101', slug: 'p-101', floor: 1, monthly_rent: 1, area: null }],
      p_building: expect.objectContaining({ slug: 'toa-a', created_by: 'u-1', owner_user_id: null }),
    }))
  })

  it('retries with a fresh slug when building slug/code collides', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "buildings_slug_uq"' } })
      .mockResolvedValueOnce({ data: { building: buildingRow, rooms: [], replayed: false }, error: null })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    const result = await BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(result.building.id).toBe('b-1')
  })

  it('gives up after 3 slug collisions', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'violates unique constraint "buildings_code_uq"' } })
    const { BuildingRepository } = await import('../../../server/repositories/buildings')

    await expect(BuildingRepository.createWithRooms({ context: {} } as never, input, [], opts)).rejects.toMatchObject({ statusCode: 409 })
    expect(rpc).toHaveBeenCalledTimes(3)
  })
})

describe('throwBuildingSetupError', () => {
  it('maps ROOM_BATCH_DUPLICATE to 409 with duplicate_room_numbers', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    try {
      throwBuildingSetupError({ code: '23505', message: 'ROOM_BATCH_DUPLICATE', details: '["P101","P102"]' })
      throw new Error('expected throw')
    }
    catch (e) {
      expect(e).toMatchObject({
        statusCode: 409,
        data: { error: { details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P101', 'P102'] } } },
      })
    }
  })

  it('maps foreign request replay to a generic 409 without data', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    try {
      throwBuildingSetupError({ code: '23505', message: 'BUILDING_SETUP_REQUEST_CONFLICT' })
      throw new Error('expected throw')
    }
    catch (e) {
      expect(e).toMatchObject({ statusCode: 409, data: { error: { details: { reason: 'BUILDING_SETUP_REQUEST_CONFLICT' } } } })
    }
  })

  it('returns without throwing for unknown errors', async () => {
    const { throwBuildingSetupError } = await import('../../../server/repositories/buildings')
    expect(() => throwBuildingSetupError({ code: 'XX000', message: 'boom' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/buildings/create-with-rooms-repository.test.ts`
Expected: FAIL — `createWithRooms` is not a function.

- [ ] **Step 3: Implement**

In `server/repositories/buildings/index.ts`:

1. Extend imports:

```ts
import type { Room } from '~/types/rooms'
import type { BuildingCreateInput, BuildingUpdateInput, QuickRoomInput } from '~/utils/validators/buildings'
import { mapRoom } from '~/utils/mappers/rooms'
```

2. Extract the insert payload builder used by `insert` (keep `insert` behavior identical, call this helper from it):

```ts
function buildInsertPayload(
  input: BuildingCreateInput,
  slug: string,
  code: string,
  provenance: { created_by?: string | null; owner_user_id?: string | null },
) {
  return {
    slug,
    code,
    name: input.name,
    address: input.address,
    description: input.description ?? null,
    status: input.status ?? 'active',
    owner_name: input.owner_name ?? null,
    owner_phone: input.owner_phone ?? null,
    owner_email: input.owner_email ?? null,
    created_by: provenance.created_by ?? null,
    owner_user_id: provenance.owner_user_id ?? null,
    electricity_pricing_type: input.electricity_pricing_type ?? 'per_kwh',
    default_electricity_rate: input.default_electricity_rate ?? null,
    water_pricing_type: input.water_pricing_type ?? 'per_m3',
    default_water_rate: input.default_water_rate ?? null,
    meter_reading_day: input.meter_reading_day ?? null,
    billing_generation_day: input.billing_generation_day ?? null,
    payment_due_day: input.payment_due_day ?? null,
    grace_period_days: input.grace_period_days ?? 0,
    operational_start_year: input.operational_start_year ?? null,
    operational_start_month: input.operational_start_month ?? null,
  }
}
```

In `insert`, replace the inline `insertPayload` object with `const insertPayload = buildInsertPayload(input, slug, code, provenance)`.

3. Add the error mapper and result type above `export const BuildingRepository`:

```ts
export interface BuildingSetupResult {
  building: Building
  rooms: Room[]
  replayed: boolean
}

const BUILDING_IDENTITY_CONFLICT = /buildings_(slug|code)_uq/
const MAX_IDENTITY_ATTEMPTS = 3

function parseDuplicateRooms(details: unknown): string[] {
  if (typeof details !== 'string') return []
  try {
    const parsed = JSON.parse(details) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  }
  catch {
    return []
  }
}

export function throwBuildingSetupError(error: unknown): void {
  if (!error || typeof error !== 'object' || !('message' in error)) return
  const message = String(error.message)
  if (message === 'ROOM_BATCH_DUPLICATE') {
    const rooms = parseDuplicateRooms('details' in error ? error.details : undefined)
    throwConflict(
      rooms.length ? `Các mã phòng đã tồn tại: ${rooms.join(', ')}` : 'Mã phòng bị trùng',
      { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: rooms },
    )
  }
  if (message === 'BUILDING_SETUP_REQUEST_CONFLICT') {
    throwConflict(
      'Yêu cầu tạo tòa nhà bị trùng với một thao tác khác. Vui lòng tải lại trang và thử lại.',
      { reason: 'BUILDING_SETUP_REQUEST_CONFLICT' },
    )
  }
  if (message === 'ROOM_BATCH_INVALID') {
    throwValidationError('Danh sách phòng không hợp lệ')
  }
}
```

4. Add the method inside `BuildingRepository`:

```ts
  async createWithRooms(
    event: H3Event,
    input: BuildingCreateInput,
    rooms: QuickRoomInput[],
    opts: { actorId: string; ownerUserId: string | null; requestId: string },
  ): Promise<BuildingSetupResult> {
    // Authorization is enforced in BuildingService; the RPC is service_role only.
    const client = serverSupabaseClient(event)
    const roomPayload = rooms.map(room => ({
      room_number: room.room_number,
      slug: slugifyName(room.room_number) || room.room_number.toLowerCase(),
      floor: room.floor,
      monthly_rent: room.monthly_rent,
      area: room.area,
    }))

    for (let attempt = 1; attempt <= MAX_IDENTITY_ATTEMPTS; attempt++) {
      const slug = await buildUniqueSlug(event, input.slug ?? input.name)
      const code = await buildUniqueCode(event, slug)
      const { data, error } = await client.rpc('create_building_with_rooms' as never, {
        p_building: buildInsertPayload(input, slug, code, {
          created_by: opts.actorId,
          owner_user_id: opts.ownerUserId,
        }),
        p_rooms: roomPayload,
        p_assign_owner: opts.ownerUserId,
        p_actor_id: opts.actorId,
        p_request_id: opts.requestId,
      } as never)

      if (error) {
        const isIdentityRace = (error as { code?: string }).code === '23505'
          && BUILDING_IDENTITY_CONFLICT.test(String((error as { message?: string }).message))
        if (isIdentityRace && attempt < MAX_IDENTITY_ATTEMPTS) continue
        if (isIdentityRace) throwConflict('Không thể tạo mã tòa nhà duy nhất, vui lòng thử lại')
        throwBuildingSetupError(error)
        throwDbError(error, 'buildings.createWithRooms')
      }

      const result = data as unknown as { building: BuildingRow; rooms: Parameters<typeof mapRoom>[0][]; replayed: boolean }
      const [building] = await attachServiceSummaries(event, [
        mapBuilding({ ...result.building, rooms: [{ count: result.rooms.length }] } as BuildingRow),
      ])
      return { building: building!, rooms: result.rooms.map(mapRoom), replayed: result.replayed }
    }
    throwConflict('Không thể tạo mã tòa nhà duy nhất, vui lòng thử lại')
  },
```

Note: `throwConflict`, `throwValidationError`, `throwDbError` are Nitro auto-imports from `server/utils/errors.ts` (already used in this file). If `mapBuilding` reads `rooms` count differently, check `app/utils/mappers/buildings.ts` and pass the shape it expects.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/buildings/create-with-rooms-repository.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add server/repositories/buildings/index.ts tests/server/buildings/create-with-rooms-repository.test.ts
git commit -m "feat(buildings): add createWithRooms repository call"
```

---

### Task 4: Service + API route + audit

**Files:**
- Modify: `server/services/buildings/index.ts` (`create`)
- Modify: `server/api/buildings/index.post.ts`
- Modify: `tests/server/buildings/owner-service.test.ts` (replace the 3 `BuildingService.create ownership workflow` tests)
- Modify: `tests/server/buildings.api.test.ts` (`POST /api/buildings` block + `CAPS`)

**Interfaces:**
- Consumes: `BuildingRepository.createWithRooms`, `BuildingSetupResult` (Task 3); `buildingCreateWithRoomsSchema`, `BuildingCreateWithRoomsInput` (Task 1).
- Produces:
  - `BuildingService.create(event, user, input: BuildingCreateWithRoomsInput): Promise<{ building: Building; roomCount: number }>`
  - `POST /api/buildings` → `201 { data: Building, meta: { room_count: number } }`

- [ ] **Step 1: Write failing service tests**

Replace the `describe('BuildingService.create ownership workflow', …)` block in `tests/server/buildings/owner-service.test.ts`, and add `createWithRooms: vi.fn()` to `buildingRepo`:

```ts
describe('BuildingService.create (atomic)', () => {
  const room = (id: string, n: string) => ({ id, roomNumber: n, buildingId: 'new-1' })

  beforeEach(() => {
    vi.clearAllMocks()
    bulkRepo.resolveSnapshots.mockResolvedValue(new Map())
  })

  it('passes owner as assignee and audits building, assignment and rooms', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({
      building: building({ id: 'new-1' }), rooms: [room('r-1', 'P101'), room('r-2', 'P102')], replayed: false,
    })
    const { BuildingService } = await import('../../../server/services/buildings')

    const res = await BuildingService.create(event(), user('owner'), {
      name: 'X', address: 'Y', request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f',
      rooms: [{ room_number: 'P101', floor: 1, monthly_rent: 1, area: null }, { room_number: 'P102', floor: 1, monthly_rent: 1, area: null }],
    } as never)

    expect(res.roomCount).toBe(2)
    expect(buildingRepo.createWithRooms).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'X' }),
      expect.arrayContaining([expect.objectContaining({ room_number: 'P101' })]),
      { actorId: 'owner-1', ownerUserId: 'owner-1', requestId: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f' },
    )
    expect(buildingRepo.createWithRooms.mock.calls[0]![1]).not.toHaveProperty('rooms')
    expect(buildingRepo.createWithRooms.mock.calls[0]![1]).not.toHaveProperty('request_id')
    expect(assignmentRepo.insert).not.toHaveBeenCalled()
    const actions = auditService.append.mock.calls.map(c => c[2].action)
    expect(actions).toEqual(expect.arrayContaining(['building.created', 'user.assignment_added']))
    expect(auditService.appendBulk).toHaveBeenCalledTimes(1)
    expect(auditService.appendBulk.mock.calls[0]![2]).toMatchObject({
      building_id: 'new-1', entity_type: 'room', aggregate_action: 'room.bulk_create',
      succeeded: ['r-1', 'r-2'], total: 2, failed: 0,
    })
  })

  it('does not assign admins and generates a request id when absent', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({ building: building({ id: 'new-2' }), rooms: [], replayed: false })
    const { BuildingService } = await import('../../../server/services/buildings')

    await BuildingService.create(event(), user('admin'), { name: 'X', address: 'Y' } as never)

    const opts = buildingRepo.createWithRooms.mock.calls[0]![3]
    expect(opts.ownerUserId).toBeNull()
    expect(opts.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(auditService.appendBulk).not.toHaveBeenCalled()
  })

  it('skips all audit on replay', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({ building: building({ id: 'new-3' }), rooms: [room('r-1', 'P101')], replayed: true })
    const { BuildingService } = await import('../../../server/services/buildings')

    const res = await BuildingService.create(event(), user('owner'), { name: 'X', address: 'Y', rooms: [] } as never)

    expect(res.building.id).toBe('new-3')
    expect(auditService.append).not.toHaveBeenCalled()
    expect(auditService.appendBulk).not.toHaveBeenCalled()
  })

  it('resets the per-request building scope cache', async () => {
    buildingRepo.createWithRooms.mockResolvedValue({ building: building({ id: 'new-4' }), rooms: [], replayed: false })
    const { BuildingService } = await import('../../../server/services/buildings')
    const ev = { context: { __buildingScope: ['old'] } } as never

    await BuildingService.create(ev, user('owner'), { name: 'X', address: 'Y' } as never)
    expect((ev as { context: Record<string, unknown> }).context.__buildingScope).toBeUndefined()
  })
})
```

If the room DTO field names differ (`roomNumber`/`buildingId`), align the `room()` factory with `app/types/rooms.ts`.

- [ ] **Step 2: Write failing API tests**

In `tests/server/buildings.api.test.ts`:
- Add `createWithRooms: vi.fn()` to `repoMocks`.
- Extend `CAPS`: add `'rooms.create'` to `admin` and `owner`.
- Replace the `POST /api/buildings` describe block:

```ts
describe('POST /api/buildings', () => {
  const ok = (b: Building, rooms: unknown[] = []) => ({ building: b, rooms, replayed: false })

  it('creates a building and returns 201 envelope with room_count', async () => {
    asAdmin()
    repoMocks.createWithRooms.mockResolvedValue(ok(buildBuilding({ id: 'new-1' })))
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const event = makeEvent({ body: { name: 'Toa moi', address: '99 Le Loi' } })
    const res = await handler(event) as { data: Building; meta: { room_count: number } }

    expect(res.data.id).toBe('new-1')
    expect(res.meta).toEqual({ room_count: 0 })
    expect((event as MockEvent).context.statusCode).toBe(201)
  })

  it('creates rooms in the same call', async () => {
    asAdmin()
    repoMocks.createWithRooms.mockResolvedValue(ok(buildBuilding({ id: 'new-2' }), [{ id: 'r-1' }, { id: 'r-2' }]))
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const res = await handler(makeEvent({ body: {
      name: 'Toa moi', address: '99 Le Loi',
      request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f',
      rooms: [
        { room_number: 'P101', floor: 1, monthly_rent: 3000000, area: null },
        { room_number: 'P201', floor: 2, monthly_rent: 3500000, area: 20 },
      ],
    } })) as { meta: { room_count: number } }

    expect(res.meta.room_count).toBe(2)
    expect(repoMocks.insert).not.toHaveBeenCalled()
  })

  it('rejects duplicate room numbers with 422 before touching the DB', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: {
      name: 'Toa moi', address: '99 Le Loi',
      rooms: [
        { room_number: 'P101', floor: 1, monthly_rent: 1, area: null },
        { room_number: 'P101', floor: 1, monthly_rent: 1, area: null },
      ],
    } }))))
    expect(err.statusCode).toBe(422)
    expect(repoMocks.createWithRooms).not.toHaveBeenCalled()
  })

  it('rejects invalid payload with 422', async () => {
    asAdmin()
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { name: 'a' } }))))
    expect(err.statusCode).toBe(422)
    expect(err.data?.error?.code).toBe('VALIDATION_ERROR')
  })

  it('forbids managers from creating', async () => {
    asManager()
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { name: 'Toa moi', address: '99 Le Loi' } }))))
    expect(err.statusCode).toBe(403)
    expect(repoMocks.createWithRooms).not.toHaveBeenCalled()
  })

  it('surfaces repository 409 for duplicate rooms', async () => {
    asAdmin()
    repoMocks.createWithRooms.mockRejectedValue(Object.assign(new Error('conflict'), {
      statusCode: 409,
      data: { error: { code: 'CONFLICT', details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P101'] } } },
    }))
    const { default: handler } = await import('../../server/api/buildings/index.post')

    const err = await expectError(Promise.resolve(handler(makeEvent({ body: {
      name: 'Toa moi', address: '99 Le Loi',
      rooms: [{ room_number: 'P101', floor: 1, monthly_rent: 1, area: null }],
    } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.details).toMatchObject({ duplicate_room_numbers: ['P101'] })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/server/buildings/owner-service.test.ts tests/server/buildings.api.test.ts`
Expected: FAIL — `createWithRooms` not called / `meta` undefined.

- [ ] **Step 4: Implement service**

Replace `BuildingService.create` in `server/services/buildings/index.ts` (and update imports: add `BuildingCreateWithRoomsInput`, remove now-unused `AssignmentRepository` import only if nothing else in the file uses it):

```ts
  async create(
    event: H3Event,
    user: AuthUser,
    input: BuildingCreateWithRoomsInput,
  ): Promise<{ building: Building; roomCount: number }> {
    requireCapability(user, 'buildings.create', 'Không có quyền tạo tòa nhà')
    const { rooms = [], request_id: requestId, ...buildingInput } = input
    if (rooms.length > 0) requireCapability(user, 'rooms.create', 'Không có quyền tạo phòng')

    const owner = isOwner(user)
    // Owner-created buildings are assigned to the owner inside the same transaction.
    const result = await BuildingRepository.createWithRooms(event, buildingInput, rooms, {
      actorId: user.id,
      ownerUserId: owner ? user.id : null,
      requestId: requestId ?? randomUUID(),
    })
    event.context.__buildingScope = undefined

    if (!result.replayed) {
      const buildingId = result.building.id
      if (owner) {
        await AuditService.append(event, user, {
          building_id: buildingId,
          action: AUDIT_ACTIONS.USER_ASSIGNMENT_ADDED,
          entity_type: 'user',
          entity_id: user.id,
          metadata: { building_id: buildingId, self_assigned: true },
        })
      }
      await AuditService.append(event, user, {
        building_id: buildingId,
        action: AUDIT_ACTIONS.BUILDING_CREATED,
        entity_type: 'building',
        entity_id: buildingId,
        after_data: result.building,
        metadata: { room_count: result.rooms.length, request_id: requestId ?? null },
      })
      if (result.rooms.length > 0) {
        await AuditService.appendBulk(event, user, {
          building_id: buildingId,
          entity_type: 'room',
          aggregate_action: 'room.bulk_create',
          items: result.rooms.map(room => ({ entity_id: room.id, action: AUDIT_ACTIONS.ROOM_CREATED, after_data: room })),
          succeeded: result.rooms.map(room => room.id),
          total: result.rooms.length,
          failed: 0,
        })
      }
    }
    return { building: result.building, roomCount: result.rooms.length }
  },
```

`randomUUID` is already imported from `node:crypto` in this file. If `AuditAppendOptions` does not accept `metadata` together with `after_data`, check `server/services/audit.ts` — it does (both are optional fields).

- [ ] **Step 5: Implement route**

`server/api/buildings/index.post.ts`:

```ts
import { BuildingService } from '../../services/buildings'
import { buildingCreateWithRoomsSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, buildingCreateWithRoomsSchema)

  const { building, roomCount } = await BuildingService.create(event, user, input)

  setResponseStatus(event, 201)
  return { data: building, meta: { room_count: roomCount } }
})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/server/buildings/owner-service.test.ts tests/server/buildings.api.test.ts`
Expected: PASS.

- [ ] **Step 7: Regenerate API inventory if the repo tracks it**

Run: `node scripts/generate-api-inventory.mjs` and include `docs/api-inventory.md` in the commit if it changed.

- [ ] **Step 8: Commit**

```bash
git add server/services/buildings/index.ts server/api/buildings/index.post.ts tests/server/buildings/owner-service.test.ts tests/server/buildings.api.test.ts docs/api-inventory.md
git commit -m "feat(buildings): create building and rooms atomically"
```

---

### Task 5: Remove the obsolete compensating delete path

**Files:**
- Modify: `server/services/buildings/index.ts` (imports only)
- Test: `npx vitest run tests/server/buildings`

**Interfaces:** none.

- [ ] **Step 1: Check remaining usage**

Run: `grep -n "AssignmentRepository\|BuildingRepository.insert" server/services/buildings/index.ts`
Expected: `AssignmentRepository` no longer referenced in `create`. If it is unused anywhere in the file, delete its import. Keep `BuildingRepository.insert` (still a valid repository method; do not delete code other callers may use — run `grep -rn "BuildingRepository.insert" server` and only remove if zero callers remain).

- [ ] **Step 2: Run lint + tests for buildings**

Run: `npx eslint server/services/buildings server/repositories/buildings && npx vitest run tests/server/buildings tests/server/buildings.api.test.ts`
Expected: no lint errors; PASS.

- [ ] **Step 3: Commit (only if something changed)**

```bash
git add server/services/buildings/index.ts server/repositories/buildings/index.ts
git commit -m "refactor(buildings): drop unused compensating-delete imports"
```

---

### Task 6: `useQuickRoomPreview` composable

**Files:**
- Create: `app/composables/buildings/useQuickRoomPreview.ts`
- Test: `tests/composables/useQuickRoomPreview.test.ts`

**Interfaces:**
- Consumes: `QuickRoomInput`, `QUICK_ROOM_MAX` (Task 1).
- Produces:
  ```ts
  export type PreviewField = 'floor' | 'rent' | 'area'
  export interface PreviewRoom { roomNumber: string; floor: number; rent: number; area: number | null; overridden: PreviewField[] }
  export function useQuickRoomPreview(): {
    enabled: Ref<boolean>
    prefix: Ref<string>
    start: Ref<number>
    count: Ref<number>          // clamped 1..QUICK_ROOM_MAX
    defaultRent: Ref<number>
    defaultArea: Ref<number | null>
    defaultFloor: Ref<number>
    samePrice: Ref<boolean>
    rows: Ref<PreviewRoom[]>
    duplicateRoomNumbers: ComputedRef<string[]>
    setCell(roomNumber: string, field: PreviewField, value: number | null): void
    resetCell(roomNumber: string, field: PreviewField): void
    markServerDuplicates(roomNumbers: string[]): void
    serverDuplicates: Ref<string[]>
    toPayload(): QuickRoomInput[]
  }
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/composables/useQuickRoomPreview.test.ts
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useQuickRoomPreview } from '~/composables/buildings/useQuickRoomPreview'

async function setup() {
  const p = useQuickRoomPreview()
  p.enabled.value = true
  p.prefix.value = 'P'
  p.start.value = 101
  p.count.value = 3
  p.defaultRent.value = 3_000_000
  await nextTick()
  return p
}

describe('useQuickRoomPreview', () => {
  it('generates rows from generator inputs', async () => {
    const p = await setup()
    expect(p.rows.value.map(r => r.roomNumber)).toEqual(['P101', 'P102', 'P103'])
    expect(p.rows.value.every(r => r.floor === 1 && r.rent === 3_000_000 && r.area === null)).toBe(true)
  })

  it('keeps manual edits when generator inputs change', async () => {
    const p = await setup()
    p.samePrice.value = false
    p.setCell('P102', 'rent', 4_000_000)
    p.setCell('P102', 'area', 25)
    p.setCell('P102', 'floor', 2)
    p.defaultRent.value = 3_200_000
    p.count.value = 4
    await nextTick()
    const r = p.rows.value.find(x => x.roomNumber === 'P102')!
    expect(r).toMatchObject({ rent: 4_000_000, area: 25, floor: 2 })
    expect(p.rows.value.find(x => x.roomNumber === 'P101')!.rent).toBe(3_200_000)
    expect(p.rows.value).toHaveLength(4)
  })

  it('drops edits for rooms that leave the range', async () => {
    const p = await setup()
    p.setCell('P103', 'area', 30)
    p.count.value = 2
    await nextTick()
    p.count.value = 3
    await nextTick()
    expect(p.rows.value.find(x => x.roomNumber === 'P103')!.area).toBeNull()
  })

  it('samePrice resets manual rent overrides', async () => {
    const p = await setup()
    p.samePrice.value = false
    p.setCell('P101', 'rent', 5_000_000)
    p.samePrice.value = true
    await nextTick()
    expect(p.rows.value.every(r => r.rent === 3_000_000)).toBe(true)
    expect(p.rows.value[0]!.overridden).not.toContain('rent')
  })

  it('resetCell restores the default', async () => {
    const p = await setup()
    p.setCell('P101', 'floor', 3)
    p.resetCell('P101', 'floor')
    expect(p.rows.value[0]).toMatchObject({ floor: 1 })
    expect(p.rows.value[0]!.overridden).not.toContain('floor')
  })

  it('clamps count to 1..200', async () => {
    const p = await setup()
    p.count.value = 500
    await nextTick()
    expect(p.rows.value).toHaveLength(200)
    p.count.value = 0
    await nextTick()
    expect(p.rows.value).toHaveLength(1)
  })

  it('reports local duplicates by slug and builds payload', async () => {
    const p = await setup()
    p.prefix.value = ''
    p.start.value = 1
    p.count.value = 2
    await nextTick()
    expect(p.duplicateRoomNumbers.value).toEqual([])
    expect(p.toPayload()).toEqual([
      { room_number: '1', floor: 1, monthly_rent: 3_000_000, area: null },
      { room_number: '2', floor: 1, monthly_rent: 3_000_000, area: null },
    ])
  })

  it('tracks server duplicates until generator changes', async () => {
    const p = await setup()
    p.markServerDuplicates(['P101'])
    expect(p.serverDuplicates.value).toEqual(['P101'])
    p.prefix.value = 'A'
    await nextTick()
    expect(p.serverDuplicates.value).toEqual([])
  })

  it('returns empty rows when disabled', async () => {
    const p = await setup()
    p.enabled.value = false
    await nextTick()
    expect(p.rows.value).toEqual([])
    expect(p.toPayload()).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/composables/useQuickRoomPreview.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// app/composables/buildings/useQuickRoomPreview.ts
import { computed, ref, watch } from 'vue'
import { slugifyName } from '~/utils/format/slug'
import { QUICK_ROOM_MAX, type QuickRoomInput } from '~/utils/validators/buildings'

export type PreviewField = 'floor' | 'rent' | 'area'

export interface PreviewRoom {
  roomNumber: string
  floor: number
  rent: number
  area: number | null
  overridden: PreviewField[]
}

export function useQuickRoomPreview() {
  const enabled = ref(false)
  const prefix = ref('P')
  const start = ref(101)
  const count = ref(3)
  const defaultRent = ref(0)
  const defaultArea = ref<number | null>(null)
  const defaultFloor = ref(1)
  const samePrice = ref(true)
  const rows = ref<PreviewRoom[]>([])
  const serverDuplicates = ref<string[]>([])

  function defaults(): Pick<PreviewRoom, PreviewField> {
    return { floor: defaultFloor.value, rent: defaultRent.value, area: defaultArea.value }
  }

  function regenerate() {
    if (!enabled.value) {
      rows.value = []
      return
    }
    const size = Math.min(QUICK_ROOM_MAX, Math.max(1, Math.trunc(count.value) || 1))
    if (size !== count.value) count.value = size
    const previous = new Map(rows.value.map(r => [r.roomNumber, r]))
    const base = defaults()
    rows.value = Array.from({ length: size }, (_, i) => {
      const roomNumber = `${prefix.value}${start.value + i}`
      const old = previous.get(roomNumber)
      const row: PreviewRoom = { roomNumber, ...base, overridden: [] }
      if (old) {
        for (const field of old.overridden) {
          if (field === 'rent' && samePrice.value) continue
          ;(row[field] as number | null) = old[field]
          row.overridden.push(field)
        }
      }
      return row
    })
  }

  watch([enabled, prefix, start, count], () => {
    serverDuplicates.value = []
    regenerate()
  }, { immediate: true })
  watch([defaultRent, defaultArea, defaultFloor, samePrice], regenerate)

  function setCell(roomNumber: string, field: PreviewField, value: number | null) {
    const row = rows.value.find(r => r.roomNumber === roomNumber)
    if (!row) return
    ;(row[field] as number | null) = value
    if (!row.overridden.includes(field)) row.overridden.push(field)
  }

  function resetCell(roomNumber: string, field: PreviewField) {
    const row = rows.value.find(r => r.roomNumber === roomNumber)
    if (!row) return
    ;(row[field] as number | null) = defaults()[field]
    row.overridden = row.overridden.filter(f => f !== field)
  }

  const duplicateRoomNumbers = computed(() => {
    const seen = new Map<string, string>()
    const dups = new Set<string>()
    for (const r of rows.value) {
      const key = slugifyName(r.roomNumber) || r.roomNumber.toLowerCase()
      if (seen.has(key)) dups.add(r.roomNumber)
      else seen.set(key, r.roomNumber)
    }
    return [...dups]
  })

  function markServerDuplicates(roomNumbers: string[]) {
    serverDuplicates.value = roomNumbers
  }

  function toPayload(): QuickRoomInput[] {
    return rows.value.map(r => ({ room_number: r.roomNumber, floor: r.floor, monthly_rent: r.rent, area: r.area }))
  }

  return {
    enabled, prefix, start, count, defaultRent, defaultArea, defaultFloor, samePrice,
    rows, duplicateRoomNumbers, serverDuplicates,
    setCell, resetCell, markServerDuplicates, toPayload,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/composables/useQuickRoomPreview.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/buildings/useQuickRoomPreview.ts tests/composables/useQuickRoomPreview.test.ts
git commit -m "feat(buildings): add quick room preview composable"
```

---

### Task 7: `useBuildingForm.submitCreate` — single request, stable request id, error states

**Files:**
- Modify: `app/composables/buildings/useBuildingForm.ts`
- Modify: `tests/composables/buildings.test.ts`

**Interfaces:**
- Consumes: `buildingCreateWithRoomsSchema`, `BuildingCreateWithRoomsInput` (Task 1); `getApiErrorDetails` from `~/utils/api-error`.
- Produces:
  - `submitCreate(input: Omit<BuildingCreateWithRoomsInput, 'request_id'>): Promise<void>`
  - `duplicateRoomNumbers: Ref<string[]>` (from server 409)
  - `requestId: string` (stable per composable instance)

- [ ] **Step 1: Write failing tests**

Append to `tests/composables/buildings.test.ts` (inside the file, new describe):

```ts
describe('useBuildingForm.submitCreate (atomic)', () => {
  const body = {
    name: 'Tòa mới', address: '123 Lê Lợi', status: 'active' as const,
    electricity_pricing_type: 'per_kwh' as const, water_pricing_type: 'per_m3' as const, grace_period_days: 0,
    rooms: [{ room_number: 'P101', floor: 1, monthly_rent: 1, area: null }],
  }

  it('sends one request with rooms and a uuid request_id', async () => {
    fetchMock.mockResolvedValue({ data: { id: 'b-1' }, meta: { room_count: 1 } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const { submitCreate } = useBuildingForm({ draftKey: { mode: 'create' } })

    await submitCreate(body)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/buildings')
    expect(opts.body.rooms).toHaveLength(1)
    expect(opts.body.request_id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('reuses the same request_id across retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { id: 'b-1' } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const { submitCreate } = useBuildingForm({ draftKey: { mode: 'create' } })

    await submitCreate(body)
    await submitCreate(body)

    expect(fetchMock.mock.calls[0]![1].body.request_id).toBe(fetchMock.mock.calls[1]![1].body.request_id)
  })

  it('shows the nothing-saved message on generic failure', async () => {
    fetchMock.mockRejectedValue(new Error('network'))
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const { submitCreate, apiError } = useBuildingForm({ draftKey: { mode: 'create' } })

    await submitCreate(body)
    expect(apiError.value).toBe('Chưa có dữ liệu nào được lưu. Bạn có thể bấm lại để thử.')
  })

  it('exposes duplicate room numbers from a 409', async () => {
    fetchMock.mockRejectedValue({
      statusCode: 409,
      data: { error: { code: 'CONFLICT', message: 'Các mã phòng đã tồn tại: P101', details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P101'] } } },
    })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const { submitCreate, duplicateRoomNumbers, apiError } = useBuildingForm({ draftKey: { mode: 'create' } })

    await submitCreate(body)
    expect(duplicateRoomNumbers.value).toEqual(['P101'])
    expect(apiError.value).toBe('Các mã phòng đã tồn tại: P101')
  })
})
```

If `apiFetch` wraps `$fetch` and rethrows a normalized error, adjust the rejected shape to whatever `getApiErrorDetails` reads (see `app/utils/api-error.ts`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/composables/buildings.test.ts`
Expected: FAIL — `request_id` undefined / `duplicateRoomNumbers` undefined.

- [ ] **Step 3: Implement**

In `app/composables/buildings/useBuildingForm.ts`:

- Remove `QuickRoom` and `CreateInput` types.
- Update imports:

```ts
import { buildingCreateWithRoomsSchema, buildingUpdateSchema } from '~/utils/validators/buildings'
import type { BuildingCreateWithRoomsInput, BuildingUpdateInput } from '~/utils/validators/buildings'
import { getApiErrorDetails } from '~/utils/api-error'
```

- Inside `useBuildingForm`, after `useFormState()`:

```ts
  // One id per form session so a retry after a lost response replays instead of duplicating.
  const requestId = crypto.randomUUID()
  const duplicateRoomNumbers = ref<string[]>([])
```

- Replace `submitCreate`:

```ts
  async function submitCreate(input: Omit<BuildingCreateWithRoomsInput, 'request_id'>) {
    clearErrors()
    duplicateRoomNumbers.value = []

    const payload = { ...input, rooms: input.rooms?.length ? input.rooms : undefined, request_id: requestId }
    const result = buildingCreateWithRoomsSchema.safeParse(payload)
    if (!result.success) {
      applyZodErrors(result.error)
      return
    }

    isLoading.value = true
    try {
      await apiFetch<ApiSuccess<Building>>('/api/buildings', { method: 'POST', body: result.data })
      clearDraft()
      clearNuxtData()
      await navigateTo('/dashboard/buildings')
    }
    catch (e: unknown) {
      const details = getApiErrorDetails<{ reason?: string; duplicate_room_numbers?: string[] }>(e)
      applyApiError(e)
      if (details?.reason === 'ROOM_BATCH_DUPLICATE') {
        duplicateRoomNumbers.value = details.duplicate_room_numbers ?? []
      }
      else if (!details?.reason) {
        apiError.value = 'Chưa có dữ liệu nào được lưu. Bạn có thể bấm lại để thử.'
      }
    }
    finally {
      isLoading.value = false
    }
  }
```

- Add `duplicateRoomNumbers` and `requestId` to the returned object.

Note: `422` validation errors from the server carry field errors through `applyApiError`; they have no `reason`, so the generic message replaces `apiError` only — field errors in `errors` stay intact. If that hides a useful server message, restrict the generic message to errors without `statusCode` or with `statusCode >= 500` (check the shape `apiFetch` throws).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/composables/buildings.test.ts`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add app/composables/buildings/useBuildingForm.ts tests/composables/buildings.test.ts
git commit -m "feat(buildings): submit building and rooms in one idempotent request"
```

---

### Task 8: `create.vue` — preview table with floor/area, override markers, error states (UI polish gate)

**Files:**
- Modify: `app/pages/dashboard/buildings/create.vue`
- Test: `tests/pages/buildings-create-quick-rooms.spec.ts` (create)

**Interfaces:**
- Consumes: `useQuickRoomPreview` (Task 6); `useBuildingForm` with `duplicateRoomNumbers` (Task 7).

- [ ] **Step 1: Run the UI polish workflow (no code yet)**

Read `.agents/skills/zeno-house/references/ui-polish-workflow.md`, then apply `frontend-design` (hierarchy, density, copy) and Hallmark (affected states: empty, default, edited cell, local duplicate, server duplicate, generic error, loading, mobile). Record decisions in `docs/changes/atomic-building-room-setup/verification.md` under "UI decisions". Use existing primitives only (`UiTable`, `UiInput density="compact"`, `UiAlert`, `UiCheckbox`, `UiButton`); if a new token/primitive seems necessary, stop and ask with problem/option/affected surfaces/benefit/cost.

- [ ] **Step 2: Write the failing source test**

```ts
// tests/pages/buildings-create-quick-rooms.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')

describe('building create quick rooms', () => {
  it('uses the preview composable instead of a computed preview', () => {
    expect(page).toContain('useQuickRoomPreview()')
    expect(page).not.toContain('const previewRooms = computed')
    expect(page).not.toContain('updatePreviewRent')
  })

  it('exposes floor and area columns as editable cells', () => {
    expect(page).toContain(`key: 'floor'`)
    expect(page).toContain('#cell-floor')
    expect(page).toContain(`setCell(row.roomNumber, 'area'`)
    expect(page).toContain(`setCell(row.roomNumber, 'floor'`)
  })

  it('offers a default floor input and caps room count', () => {
    expect(page).toContain('label="Tầng mặc định"')
    expect(page).toContain('QUICK_ROOM_MAX')
  })

  it('highlights server-side duplicates and sends rooms via toPayload', () => {
    expect(page).toContain('duplicateRoomNumbers')
    expect(page).toContain('markServerDuplicates')
    expect(page).toContain('preview.toPayload()')
    expect(page).not.toContain('quickRooms:')
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/pages/buildings-create-quick-rooms.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the script block**

Replace the quick-room state section of `<script setup>` (from `interface PreviewRoom` through `onSubmit`) with:

```ts
import type { PreviewRoom } from '~/composables/buildings/useQuickRoomPreview'
import { QUICK_ROOM_MAX } from '~/utils/validators/buildings'

const preview = useQuickRoomPreview()

const {
  isLoading,
  errors,
  apiError,
  submitCreate,
  duplicateRoomNumbers,
  hasDraft,
  restoreDraft,
  clearDraft,
  isDirty,
} = useBuildingForm<BuildingFormData>({
  draftKey: { mode: 'create' },
  formData,
  initialSnapshot,
})

watch(duplicateRoomNumbers, value => preview.markServerDuplicates(value))

const flaggedRooms = computed(() => new Set([
  ...preview.duplicateRoomNumbers.value,
  ...preview.serverDuplicates.value,
]))

const previewColumns: UiTableColumn<PreviewRoom>[] = [
  { key: 'roomNumber', label: 'Mã phòng' },
  { key: 'floor', label: 'Tầng', numeric: true },
  { key: 'rent', label: 'Giá thuê (đ)', numeric: true },
  { key: 'area', label: 'Diện tích (m²)', numeric: true },
]

const submitLabel = computed(() => preview.enabled.value ? 'Tạo tòa nhà & phòng' : 'Tạo tòa nhà')

async function onSubmit(data: BuildingFormData) {
  if (preview.enabled.value && preview.duplicateRoomNumbers.value.length > 0) return
  await submitCreate({
    ...buildingFormToApiPayload(data),
    rooms: preview.enabled.value ? preview.toPayload() : undefined,
  } as Parameters<typeof submitCreate>[0])
}
```

(Remove the old `quick*` refs, `previewRooms`, `hasDuplicateRoomCodes`, `updatePreviewRent`, `quickRoomError`.)

- [ ] **Step 5: Implement the template section**

Replace the `<template #extras>` content. Bind generator inputs to `preview.*` refs; add `Tầng mặc định`; table cells:

```vue
<UiFormSection
  title="Tạo phòng nhanh"
  description="Tạo trước một loạt phòng cùng lúc với tòa nhà. Có thể chỉnh tầng, giá, diện tích từng phòng."
>
  <UiCheckbox v-model="preview.enabled.value" label="Bật tạo phòng nhanh" />
  <template v-if="preview.enabled.value">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiInput
        label="Số lượng phòng"
        type="number"
        number-mode="integer"
        :hint="`Tối đa ${QUICK_ROOM_MAX} phòng`"
        :model-value="String(preview.count.value)"
        @update:model-value="(v) => preview.count.value = Number(v) || 1"
      />
      <UiInput v-model="preview.prefix.value" label="Tiền tố mã phòng" placeholder="Ví dụ: P, A, B" />
      <UiInput
        label="Số bắt đầu"
        type="number"
        number-mode="integer"
        :model-value="String(preview.start.value)"
        @update:model-value="(v) => preview.start.value = Number(v) || 0"
      />
      <UiInput
        label="Tầng mặc định"
        type="number"
        number-mode="integer"
        :model-value="String(preview.defaultFloor.value)"
        @update:model-value="(v) => preview.defaultFloor.value = Math.min(100, Math.max(1, Number(v) || 1))"
      />
      <UiInput
        label="Giá thuê mặc định (đ)"
        type="number"
        number-mode="currency"
        :model-value="String(preview.defaultRent.value)"
        @update:model-value="(v) => preview.defaultRent.value = Number(v) || 0"
      />
      <UiInput
        label="Diện tích mặc định (m²)"
        type="number"
        number-mode="area"
        placeholder="Tùy chọn"
        :model-value="preview.defaultArea.value !== null ? String(preview.defaultArea.value) : ''"
        @update:model-value="(v) => preview.defaultArea.value = v === '' ? null : Number(v)"
      />
    </div>

    <div v-if="preview.rows.value.length" class="mt-5">
      <UiAlert v-if="flaggedRooms.size" severity="warning" class="mb-3">
        Các mã phòng bị trùng: {{ [...flaggedRooms].join(', ') }}. Đổi tiền tố hoặc số bắt đầu rồi thử lại.
      </UiAlert>
      <p class="mb-2 text-xs text-ui-muted">Xem trước {{ preview.rows.value.length }} phòng sẽ được tạo:</p>
      <div class="overflow-x-auto">
        <UiTable :rows="preview.rows.value" :columns="previewColumns" row-key="roomNumber">
          <template #cell-roomNumber="{ row }">
            <span class="font-mono" :class="flaggedRooms.has(row.roomNumber) ? 'text-ui-danger' : 'text-ui-primary'">
              {{ row.roomNumber }}
            </span>
          </template>
          <template #cell-floor="{ row }">
            <UiInput
              density="compact"
              type="number"
              number-mode="integer"
              :aria-label="`Tầng phòng ${row.roomNumber}`"
              :model-value="String(row.floor)"
              @update:model-value="(v) => preview.setCell(row.roomNumber, 'floor', Math.min(100, Math.max(1, Number(v) || 1)))"
            />
          </template>
          <template #cell-rent="{ row }">
            <UiInput
              v-if="!preview.samePrice.value"
              density="compact"
              type="number"
              number-mode="currency"
              :aria-label="`Giá thuê phòng ${row.roomNumber}`"
              :model-value="String(row.rent)"
              @update:model-value="(v) => preview.setCell(row.roomNumber, 'rent', Number(v) || 0)"
            />
            <span v-else>{{ row.rent.toLocaleString('vi-VN') }}</span>
          </template>
          <template #cell-area="{ row }">
            <UiInput
              density="compact"
              type="number"
              number-mode="area"
              placeholder="—"
              :aria-label="`Diện tích phòng ${row.roomNumber}`"
              :model-value="row.area !== null ? String(row.area) : ''"
              @update:model-value="(v) => preview.setCell(row.roomNumber, 'area', v === '' ? null : Number(v))"
            />
          </template>
        </UiTable>
      </div>
      <UiCheckbox v-model="preview.samePrice.value" label="Đồng giá cho tất cả phòng" class="mt-3" />
    </div>
  </template>
</UiFormSection>
```

Override marker + "khôi phục mặc định" action: implement using the decision recorded in Step 1 (e.g. a subtle token-based background on overridden cells via an existing utility class, and a `UiButton` variant `ghost` size `xs` calling `preview.resetCell(row.roomNumber, field)`). Verify `UiInput` supports `hint`/`aria-label` passthrough and `UiButton` sizes before using them; if not, use the nearest existing prop.

Change the top-level `UiAlert v-if="apiError"` copy is driven by the composable (Task 7); keep it as is.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/pages/buildings-create-quick-rooms.spec.ts tests/composables/useQuickRoomPreview.test.ts tests/composables/buildings.test.ts`
Expected: PASS.

- [ ] **Step 7: Visual QA (Hallmark pass)**

Start dev server (ask the user before starting a local runtime), open `/dashboard/buildings/create` at desktop 1280px and mobile 375px. Check: enabling quick rooms, 30 rooms, edit floor/rent/area on 2 rows, change default rent (edits kept), toggle same price, local duplicate (prefix empty + overlapping), loading state, generic error, server duplicate highlight. Record screenshots/notes in `verification.md`.

- [ ] **Step 8: Commit**

```bash
git add app/pages/dashboard/buildings/create.vue tests/pages/buildings-create-quick-rooms.spec.ts docs/changes/atomic-building-room-setup/verification.md
git commit -m "feat(buildings): editable floor/area preview with duplicate states"
```

---

### Task 9: Full verification, docs and gates

**Files:**
- Create: `docs/changes/atomic-building-room-setup/verification.md` (if not created in Task 8)
- Modify: `docs/changes/atomic-building-room-setup/index.md` (status + links)

- [ ] **Step 1: Run the full local suite**

Run: `npm run typecheck && npm test && npm run lint && npm run knowledge:check`
Expected: all pass. Fix and re-run on failure; record outputs in `verification.md`.

- [ ] **Step 2: Write `verification.md`**

```markdown
---
type: Change Verification
title: "atomic-building-room-setup-verification"
status: draft
change_state: verification-pending
tags: [change, verification, buildings, rooms]
---

# Atomic Building + Room setup — verification

## Local (source)
- [ ] typecheck / test / lint / knowledge:check — <date, result>

## UI decisions
- <from Task 8 Step 1>

## Visual QA
- [ ] Desktop 1280px — <notes>
- [ ] Mobile 375px — <notes>

## Cloud gates (separate; not implied by local tests)
- [ ] Migration `20261111090000_create_building_with_rooms.sql` applied — <env, date>
- [ ] `supabase/verification/create_building_with_rooms.sql` passed — <output>
- [ ] Concurrency check (two sessions) — <result>
- [ ] Grants: anon/auth = false, service_role = true — <output>
- [ ] `app/types/database.types.ts` regenerated — <commit>
- [ ] Deployed app smoke: create building with 30 rooms; retry after forced network error lands on same building
```

Fill local results; leave cloud items unchecked until done.

- [ ] **Step 3: Update `index.md`**

Set status line to `**Status: implementation-review.**` and add links to `implementation-plan.md` and `verification.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/changes/atomic-building-room-setup
git commit -m "docs(changes): record PR0 verification evidence"
```

- [ ] **Step 5: Cloud gate (human-run)**

Apply the migration in the Supabase SQL Editor, run the verification script and concurrency check, regenerate types (`npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" --schema public > app/types/database.types.ts`), re-run `npm run typecheck`, update `verification.md`, commit. On acceptance: reconcile `docs/capabilities/{buildings-api,rooms-api,rooms-database,buildings-ui}.md` and move the bundle to `docs/history/`.
