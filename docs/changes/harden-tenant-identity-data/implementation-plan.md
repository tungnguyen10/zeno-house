---
type: Implementation Plan
title: "2026-11-09-harden-tenant-identity-data"
status: draft
change_state: implementation-verified-rollout-pending
tags: [superpowers, change, migration, security, tenants]
---

# Harden Tenant Identity Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tenant phone/ID number unique and normalized at the DB, return non-disclosing conflicts for out-of-scope duplicates with per-user rate limiting, and keep identity PII out of browser drafts and new audit snapshots.

**Architecture:** One normalization rule set exists in TypeScript (`app/utils/tenant-identity.ts`, used by Zod validators) and in SQL (functions + trigger). Two migrations: an independent rate-limit migration and an identity migration guarded by a duplicate check. A single `TenantIdentityConflictService` decides between `TENANT_DUPLICATE` (caller has `full` access) and `TENANT_IDENTITY_CONFLICT` (everything else) for create, update, import and the tenant portal; repositories translate unique-index violations into a typed error the service handles.

**Tech Stack:** Nuxt 4/Nitro, Vue 3, TypeScript, Zod, Vitest, Supabase PostgreSQL (cloud only).

**Spec:** [design.md](./design.md), [proposal.md](./proposal.md)

## Global Constraints

- Flow stays page/component → composable → server API → service → repository → Supabase. Services own permission and conflict decisions; repositories only query/persist and translate DB errors.
- Generic conflict message, verbatim: `Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên`.
- Error codes: `TENANT_DUPLICATE` (409, `details.fieldErrors` + `details.existingTenantId`), `TENANT_IDENTITY_CONFLICT` (409, no `details`), `RATE_LIMITED` (429, `details.retryAfterSeconds`).
- Rate limit defaults: 10 conflicts per 900 seconds per user; runtime keys `tenantIdentityConflictLimit`, `tenantIdentityConflictWindowSeconds`.
- Unique index names, verbatim: `tenants_phone_uq`, `tenants_id_number_uq`.
- Never hand-edit `app/types/database.types.ts`. Do not install the Supabase CLI or start local containers; prepare SQL for the cloud Dashboard and ask before any cloud write.
- Never commit real phone numbers, ID numbers or names; fixtures use obviously fictional values.
- Vietnamese copy must have diacritics. No new UI components; reuse the existing `UiAlert`/field error rendering.

## Review Focus

1. A phone typed with separators or `+84` (`0901 234 567`, `+84901234567`) that matches an existing normalized phone must conflict, not create a second tenant → Task 1 fixture + Task 4 service test.
2. Updating a tenant while keeping its own phone/ID number must not conflict with itself (`excludeId`) → Task 5 update test.
3. A user over the conflict limit gets 429 **before** any duplicate lookup, including for non-conflicting data, so the 429 itself is not an oracle → Task 4 test.
4. A caller with `full` access to one matched tenant and `none` to another (phone and ID matching different tenants) must get the generic conflict → Task 4 test.
5. A legacy draft in `localStorage` containing `id_number` is purged on load and restoring it leaves identity fields at their current (empty) values instead of `undefined` → Task 7 test.

---

### Task 1: Normalization utilities and validators

**Files:**
- Create: `app/utils/tenant-identity.ts`
- Create: `tests/__fixtures__/tenant-identity-normalization.json`
- Create: `tests/utils/tenant-identity.test.ts`
- Modify: `app/utils/validators/tenants.ts:12-13` (`phone`, `id_number` in `tenantCreateSchema`)
- Modify: `app/utils/validators/tenant-portal.ts:46,52` (`phone`, `id_number` in `tenantProfileUpdateSchema`)
- Modify: `tests/server/tenant-portal/services.test.ts` (portal phone `'0902'` → `'0902000000'` in inputs and mocks)

**Interfaces:**
- Produces:
  - `normalizeTenantPhone(input: string): string | null`
  - `normalizeTenantIdNumber(input: string | null | undefined): string | null`
  - `tenantPhoneSchema` (Zod, output `string`), `tenantIdNumberSchema` (Zod, output `string | null | undefined`)
  - `TENANT_PHONE_INVALID_MESSAGE = 'Số điện thoại không hợp lệ'`

- [x] **Step 1: Write the fixture**

`tests/__fixtures__/tenant-identity-normalization.json`:

```json
{
  "phone": [
    { "input": "0901234567", "expected": "0901234567" },
    { "input": "0901 234 567", "expected": "0901234567" },
    { "input": "0901.234.567", "expected": "0901234567" },
    { "input": "(090) 123-4567", "expected": "0901234567" },
    { "input": "+84901234567", "expected": "0901234567" },
    { "input": "+84 90 123 4567", "expected": "0901234567" },
    { "input": "84901234567", "expected": "0901234567" },
    { "input": "+12025550123", "expected": "+12025550123" },
    { "input": "+44 20 7946 0958", "expected": "+442079460958" },
    { "input": "+8490123", "expected": null },
    { "input": "+8490123456789", "expected": null },
    { "input": "090123", "expected": null },
    { "input": "abc", "expected": null },
    { "input": "", "expected": null }
  ],
  "idNumber": [
    { "input": " 012345678901 ", "expected": "012345678901" },
    { "input": "0123 4567 8901", "expected": "012345678901" },
    { "input": "b1234567", "expected": "B1234567" },
    { "input": "   ", "expected": null },
    { "input": null, "expected": null }
  ]
}
```

- [x] **Step 2: Write the failing tests**

`tests/utils/tenant-identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/tenant-identity-normalization.json'
import { normalizeTenantIdNumber, normalizeTenantPhone } from '~/utils/tenant-identity'
import { tenantCreateSchema, tenantUpdateSchema } from '~/utils/validators/tenants'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'

describe('normalizeTenantPhone', () => {
  it.each(fixture.phone)('$input -> $expected', ({ input, expected }) => {
    expect(normalizeTenantPhone(input)).toBe(expected)
  })
})

describe('normalizeTenantIdNumber', () => {
  it.each(fixture.idNumber)('$input -> $expected', ({ input, expected }) => {
    expect(normalizeTenantIdNumber(input)).toBe(expected)
  })
})

describe('tenant validators normalize identity fields', () => {
  it('stores normalized phone and id number on create', () => {
    const result = tenantCreateSchema.parse({ full_name: 'Khách Giả Lập', phone: '+84 90 123 4567', id_number: ' 0123 4567 8901 ' })
    expect(result.phone).toBe('0901234567')
    expect(result.id_number).toBe('012345678901')
  })

  it('rejects an invalid phone with a field error', () => {
    const result = tenantCreateSchema.safeParse({ full_name: 'Khách Giả Lập', phone: '090123' })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.phone).toEqual(['Số điện thoại không hợp lệ'])
  })

  it('leaves omitted fields undefined on partial update', () => {
    expect(tenantUpdateSchema.parse({ full_name: 'Khách Giả Lập' })).toEqual({ full_name: 'Khách Giả Lập' })
  })

  it('normalizes portal profile identity fields', () => {
    expect(tenantProfileUpdateSchema.parse({ phone: '0901.234.567', id_number: 'b1234567' }))
      .toEqual({ phone: '0901234567', id_number: 'B1234567' })
  })
})
```

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/utils/tenant-identity.test.ts`
Expected: FAIL, cannot resolve `~/utils/tenant-identity`.

- [x] **Step 4: Implement the utilities**

`app/utils/tenant-identity.ts`:

```ts
import { z } from 'zod'

const PHONE_SEPARATORS = /[\s.()-]/g

export const TENANT_PHONE_INVALID_MESSAGE = 'Số điện thoại không hợp lệ'

export function normalizeTenantPhone(input: string): string | null {
  const compact = input.replace(PHONE_SEPARATORS, '')
  if (/^0\d{9}$/.test(compact)) return compact
  const vietnam = compact.match(/^\+?84(\d{9})$/)
  if (vietnam) return `0${vietnam[1]}`
  if (compact.startsWith('+84')) return null
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact
  return null
}

export function normalizeTenantIdNumber(input: string | null | undefined): string | null {
  if (input == null) return null
  const compact = input.replace(/\s/g, '').toUpperCase()
  return compact === '' ? null : compact
}

export const tenantPhoneSchema = z.string()
  .min(1, 'Số điện thoại không được trống')
  .max(20, 'Số điện thoại quá dài')
  .transform((value, ctx) => {
    const normalized = normalizeTenantPhone(value)
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: TENANT_PHONE_INVALID_MESSAGE })
      return z.NEVER
    }
    return normalized
  })

export const tenantIdNumberSchema = z.string()
  .max(20, 'Số CMND/CCCD quá dài')
  .nullable()
  .optional()
  .transform(value => (value === undefined ? undefined : normalizeTenantIdNumber(value)))
```

In `app/utils/validators/tenants.ts`, import both schemas and replace the two fields:

```ts
import { tenantIdNumberSchema, tenantPhoneSchema } from '../tenant-identity'
// ...
  phone: tenantPhoneSchema,
  // ...
  id_number: tenantIdNumberSchema,
```

In `app/utils/validators/tenant-portal.ts`, replace the two fields:

```ts
import { tenantIdNumberSchema, tenantPhoneSchema } from '../tenant-identity'
// ...
  phone: tenantPhoneSchema.optional(),
  // ...
  id_number: tenantIdNumberSchema,
```

Bulk import already parses rows with `tenantCreateSchema` in `TenantService.bulkCreate`, so in-file duplicate detection (`seenPhones`, `seenIdNumbers`) automatically compares normalized values.

- [x] **Step 5: Fix the portal test fixture that used a non-phone value**

In `tests/server/tenant-portal/services.test.ts`, replace every `'0902'` with `'0902000000'` (inputs and `updateProfile` mock results).

- [x] **Step 6: Run tests**

Run: `npx vitest run tests/utils/tenant-identity.test.ts tests/server/tenant-portal tests/server/tenants.api.test.ts`
Expected: PASS. If an existing test sends a non-phone value through a validator, change it to a valid fictional number (`0901234567` style); do not loosen the validator.

- [ ] **Step 7: Commit**

```bash
git add app/utils/tenant-identity.ts app/utils/validators/tenants.ts app/utils/validators/tenant-portal.ts tests/__fixtures__/tenant-identity-normalization.json tests/utils/tenant-identity.test.ts tests/server/tenant-portal/services.test.ts
git commit -m "feat(tenants): normalize tenant phone and id number in validators"
```

---

### Task 2: Migrations, preflight and verification SQL

**Files:**
- Create: `supabase/migrations/<ts>_tenant_identity_conflict_limit.sql` (use `supabase migration new tenant_identity_conflict_limit` only if the CLI is already installed; otherwise name it with a `YYYYMMDDHHMMSS` UTC timestamp later than `20261105140000`)
- Create: `supabase/migrations/<ts+1>_harden_tenant_identity_data.sql`
- Create: `supabase/verification/tenant_identity_duplicates.sql` (preflight, read-only)
- Create: `supabase/verification/harden_tenant_identity_data.sql` (post-migration, rolled back)
- Modify: `supabase/verification/atomic_billing_close.sql:42`, `supabase/verification/atomic_contract_renewal.sql:28,36`, `supabase/verification/tenant_scoped_bulk_status.sql:55` (shared phone `'0900000000'` would now violate `tenants_phone_uq`)
- Create: `tests/server/tenants/identity-migration.test.ts`

**Interfaces:**
- Produces (SQL):
  - `public.normalize_tenant_phone(text) returns text`, `public.normalize_tenant_id_number(text) returns text`
  - `public.peek_tenant_identity_conflict_limit(p_subject_hash text, p_limit integer, p_window_seconds integer, p_now timestamptz default clock_timestamp()) returns table(allowed boolean, retry_after_seconds integer)`
  - `public.record_tenant_identity_conflicts(p_subject_hash text, p_units integer, p_window_seconds integer, p_now timestamptz default clock_timestamp()) returns void`
  - Unique indexes `tenants_phone_uq`, `tenants_id_number_uq`; trigger `tenants_normalize_identity`.

- [x] **Step 1: Write the failing static test**

`tests/server/tenants/identity-migration.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), 'supabase/migrations')
function migration(suffix: string): string {
  const name = readdirSync(migrationsDir).find(file => file.endsWith(suffix))
  if (!name) throw new Error(`Missing migration *${suffix}`)
  return readFileSync(join(migrationsDir, name), 'utf8').toLowerCase()
}

describe('tenant identity conflict limit migration', () => {
  const sql = migration('_tenant_identity_conflict_limit.sql')

  it('allows the new scope on the shared bucket table', () => {
    expect(sql).toContain("check (scope in ('chat', 'action', 'tenant_identity_conflict'))")
  })

  it('exposes peek and record functions to service_role only', () => {
    for (const fn of ['peek_tenant_identity_conflict_limit', 'record_tenant_identity_conflicts']) {
      expect(sql).toContain(`create or replace function public.${fn}(`)
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]+?from public, anon, authenticated`))
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]+?to service_role`))
    }
  })
})

describe('harden tenant identity data migration', () => {
  const sql = migration('_harden_tenant_identity_data.sql')

  it('aborts when normalized duplicates remain', () => {
    expect(sql).toContain("raise exception 'tenant_identity_duplicates")
  })

  it('normalizes existing rows before creating unique indexes', () => {
    const update = sql.indexOf('update public.tenants')
    expect(update).toBeGreaterThan(-1)
    expect(sql.indexOf('create unique index tenants_phone_uq')).toBeGreaterThan(update)
    expect(sql).toContain('create unique index tenants_id_number_uq on public.tenants (id_number) where id_number is not null')
  })

  it('normalizes every later write through a trigger', () => {
    expect(sql).toContain('before insert or update of phone, id_number on public.tenants')
  })
})

describe('verification fixtures', () => {
  it.each(['atomic_billing_close.sql', 'atomic_contract_renewal.sql', 'tenant_scoped_bulk_status.sql'])(
    '%s no longer reuses one phone for several tenants',
    (file) => {
      const sql = readFileSync(join(process.cwd(), 'supabase/verification', file), 'utf8')
      expect(sql).not.toContain("'0900000000'")
    },
  )
})
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/tenants/identity-migration.test.ts`
Expected: FAIL with `Missing migration *_tenant_identity_conflict_limit.sql`.

- [x] **Step 3: Write the rate-limit migration**

Before writing, confirm the inline check constraint name on cloud with `select conname from pg_constraint where conrelid = 'public.ai_rate_limit_buckets'::regclass and contype = 'c';` (expected `ai_rate_limit_buckets_scope_check`); use the real name if different.

```sql
-- Tenant identity conflict limit: reuses the AI bucket table with a dedicated scope.
alter table public.ai_rate_limit_buckets
  drop constraint if exists ai_rate_limit_buckets_scope_check;
alter table public.ai_rate_limit_buckets
  add constraint ai_rate_limit_buckets_scope_check
  check (scope in ('chat', 'action', 'tenant_identity_conflict'));

create or replace function public.peek_tenant_identity_conflict_limit(
  p_subject_hash   text,
  p_limit          integer,
  p_window_seconds integer,
  p_now            timestamptz default clock_timestamp()
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_started timestamptz;
  v_window_ends    timestamptz;
  v_count          integer;
begin
  if length(coalesce(p_subject_hash, '')) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'TENANT_CONFLICT_LIMIT_INPUT_INVALID' using errcode = 'P0001';
  end if;
  v_window_started := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_window_ends := v_window_started + pg_catalog.make_interval(secs => p_window_seconds);
  select bucket.request_count into v_count
  from public.ai_rate_limit_buckets bucket
  where bucket.subject_hash = p_subject_hash
    and bucket.scope = 'tenant_identity_conflict'
    and bucket.window_started = v_window_started;
  return query select
    coalesce(v_count, 0) < p_limit,
    greatest(pg_catalog.ceil(extract(epoch from (v_window_ends - p_now)))::integer, 1);
end;
$$;

create or replace function public.record_tenant_identity_conflicts(
  p_subject_hash   text,
  p_units          integer,
  p_window_seconds integer,
  p_now            timestamptz default clock_timestamp()
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_window_started timestamptz;
  v_window_ends    timestamptz;
begin
  if length(coalesce(p_subject_hash, '')) <> 64 or p_units < 1 or p_window_seconds < 1 then
    raise exception 'TENANT_CONFLICT_LIMIT_INPUT_INVALID' using errcode = 'P0001';
  end if;
  v_window_started := pg_catalog.to_timestamp(
    pg_catalog.floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_window_ends := v_window_started + pg_catalog.make_interval(secs => p_window_seconds);
  insert into public.ai_rate_limit_buckets (subject_hash, scope, window_started, request_count, expires_at)
  values (p_subject_hash, 'tenant_identity_conflict', v_window_started, p_units, v_window_ends + interval '1 day')
  on conflict (subject_hash, scope, window_started) do update
    set request_count = public.ai_rate_limit_buckets.request_count + p_units,
        expires_at = excluded.expires_at;
end;
$$;

revoke all on function public.peek_tenant_identity_conflict_limit(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.peek_tenant_identity_conflict_limit(text, integer, integer, timestamptz)
  to service_role;
revoke all on function public.record_tenant_identity_conflicts(text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_tenant_identity_conflicts(text, integer, integer, timestamptz)
  to service_role;

-- Rollback:
-- drop function if exists public.record_tenant_identity_conflicts(text, integer, integer, timestamptz);
-- drop function if exists public.peek_tenant_identity_conflict_limit(text, integer, integer, timestamptz);
-- delete from public.ai_rate_limit_buckets where scope = 'tenant_identity_conflict';
-- alter table public.ai_rate_limit_buckets drop constraint ai_rate_limit_buckets_scope_check;
-- alter table public.ai_rate_limit_buckets add constraint ai_rate_limit_buckets_scope_check check (scope in ('chat', 'action'));
```

- [x] **Step 4: Write the identity migration**

Before writing, list existing triggers on `public.tenants` in cloud (`select tgname from pg_trigger where tgrelid = 'public.tenants'::regclass and not tgisinternal;`). If an audit or `updated_at` trigger exists, note it in the change's execution record; the one-time `update` below will fire it once per changed row.

```sql
create or replace function public.normalize_tenant_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_compact text;
begin
  if p_value is null then
    return null;
  end if;
  v_compact := pg_catalog.regexp_replace(p_value, '[[:space:].()-]', '', 'g');
  if v_compact ~ '^0[0-9]{9}$' then
    return v_compact;
  end if;
  if v_compact ~ '^\+?84[0-9]{9}$' then
    return '0' || pg_catalog.right(v_compact, 9);
  end if;
  -- International and legacy invalid values keep their compact form; validators reject new invalid input.
  return v_compact;
end;
$$;

create or replace function public.normalize_tenant_id_number(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(pg_catalog.upper(pg_catalog.regexp_replace(p_value, '[[:space:]]', '', 'g')), '');
$$;

do $$
declare
  v_phone_groups integer;
  v_id_groups    integer;
begin
  select count(*) into v_phone_groups
  from (
    select public.normalize_tenant_phone(phone)
    from public.tenants
    group by 1
    having count(*) > 1
  ) groups;
  select count(*) into v_id_groups
  from (
    select public.normalize_tenant_id_number(id_number)
    from public.tenants
    where public.normalize_tenant_id_number(id_number) is not null
    group by 1
    having count(*) > 1
  ) groups;
  if v_phone_groups > 0 or v_id_groups > 0 then
    raise exception 'TENANT_IDENTITY_DUPLICATES phone_groups=% id_number_groups=%', v_phone_groups, v_id_groups
      using hint = 'Run supabase/verification/tenant_identity_duplicates.sql and resolve every group first.';
  end if;
end;
$$;

update public.tenants
set phone = public.normalize_tenant_phone(phone),
    id_number = public.normalize_tenant_id_number(id_number)
where phone is distinct from public.normalize_tenant_phone(phone)
   or id_number is distinct from public.normalize_tenant_id_number(id_number);

create unique index tenants_phone_uq on public.tenants (phone);
create unique index tenants_id_number_uq on public.tenants (id_number) where id_number is not null;

create or replace function public.tenants_normalize_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone := public.normalize_tenant_phone(new.phone);
  new.id_number := public.normalize_tenant_id_number(new.id_number);
  return new;
end;
$$;

create trigger tenants_normalize_identity
  before insert or update of phone, id_number on public.tenants
  for each row execute function public.tenants_normalize_identity();

-- Rollback (normalized values are kept):
-- drop trigger if exists tenants_normalize_identity on public.tenants;
-- drop function if exists public.tenants_normalize_identity();
-- drop index if exists public.tenants_id_number_uq;
-- drop index if exists public.tenants_phone_uq;
-- drop function if exists public.normalize_tenant_id_number(text);
-- drop function if exists public.normalize_tenant_phone(text);
```

- [x] **Step 5: Write the read-only preflight**

`supabase/verification/tenant_identity_duplicates.sql`:

```sql
-- Read-only. Run in Dashboard SQL Editor before the identity migration.
-- Lists duplicate groups by normalized value without exposing names, phones or ID numbers.
with normalized as (
  select
    id,
    code,
    pg_catalog.regexp_replace(phone, '[[:space:].()-]', '', 'g') as phone_compact,
    nullif(pg_catalog.upper(pg_catalog.regexp_replace(id_number, '[[:space:]]', '', 'g')), '') as id_key
  from public.tenants
),
keys as (
  select id, code, 'phone' as kind,
    case
      when phone_compact ~ '^\+?84[0-9]{9}$' then '0' || pg_catalog.right(phone_compact, 9)
      else phone_compact
    end as key
  from normalized
  union all
  select id, code, 'id_number', id_key from normalized where id_key is not null
),
groups as (
  select kind, key, dense_rank() over (partition by kind order by key) as group_no, count(*) over (partition by kind, key) as group_size, id, code
  from keys
)
select kind, group_no, group_size, id as tenant_id, code
from groups
where group_size > 1
order by kind, group_no, code;
```

- [x] **Step 6: Write the post-migration verification**

`supabase/verification/harden_tenant_identity_data.sql` (every assertion column must be `true`; all writes rolled back):

```sql
begin;

select
  public.normalize_tenant_phone('0901 234 567') = '0901234567' as phone_spaces,
  public.normalize_tenant_phone('+84 90 123 4567') = '0901234567' as phone_plus84,
  public.normalize_tenant_phone('84901234567') = '0901234567' as phone_84,
  public.normalize_tenant_phone('(090) 123-4567') = '0901234567' as phone_brackets,
  public.normalize_tenant_phone('+44 20 7946 0958') = '+442079460958' as phone_international,
  public.normalize_tenant_id_number('0123 4567 8901') = '012345678901' as id_spaces,
  public.normalize_tenant_id_number('b1234567') = 'B1234567' as id_upper,
  public.normalize_tenant_id_number('   ') is null as id_blank,
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'tenants_phone_uq') as phone_index,
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'tenants_id_number_uq') as id_index,
  not pg_catalog.has_function_privilege('authenticated', 'public.record_tenant_identity_conflicts(text,integer,integer,timestamptz)', 'EXECUTE') as record_denied_authenticated,
  pg_catalog.has_function_privilege('service_role', 'public.peek_tenant_identity_conflict_limit(text,integer,integer,timestamptz)', 'EXECUTE') as peek_allowed_service_role;

create temporary table identity_fixture on commit drop as
select pg_catalog.gen_random_uuid() as a, pg_catalog.gen_random_uuid() as b;

insert into public.tenants (id, code, full_name, phone, id_number)
select a, 'verify-' || a, 'Identity fixture A', '+999 1234 5678 901', ' zz 0001 ' from identity_fixture;

select
  (select phone from public.tenants where id = (select a from identity_fixture)) = '+99912345678901' as trigger_phone,
  (select id_number from public.tenants where id = (select a from identity_fixture)) = 'ZZ0001' as trigger_id;

do $$
begin
  insert into public.tenants (id, code, full_name, phone)
  select b, 'verify-' || b, 'Identity fixture B', '+99912345678901' from identity_fixture;
  raise exception 'duplicate phone unexpectedly inserted';
exception when unique_violation then null;
end;
$$;
select true as phone_unique_enforced;

do $$
begin
  insert into public.tenants (id, code, full_name, phone, id_number)
  select b, 'verify-' || b, 'Identity fixture B', '+99912345678902', 'ZZ 0001' from identity_fixture;
  raise exception 'duplicate id number unexpectedly inserted';
exception when unique_violation then null;
end;
$$;
select true as id_unique_enforced;

rollback;
```

- [x] **Step 7: Make shared-phone verification fixtures unique**

Replace each `'0900000000'` literal with a per-row fictional international number using the unassigned `+999` code:

```sql
'+999' || lpad((floor(random() * 100000000000))::bigint::text, 11, '0')
```

Files: `supabase/verification/atomic_billing_close.sql:42`, `supabase/verification/atomic_contract_renewal.sql:28` and `:36`, `supabase/verification/tenant_scoped_bulk_status.sql:55`.

- [x] **Step 8: Run tests**

Run: `npx vitest run tests/server/tenants/identity-migration.test.ts`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add supabase/migrations/*_tenant_identity_conflict_limit.sql supabase/migrations/*_harden_tenant_identity_data.sql supabase/verification/tenant_identity_duplicates.sql supabase/verification/harden_tenant_identity_data.sql supabase/verification/atomic_billing_close.sql supabase/verification/atomic_contract_renewal.sql supabase/verification/tenant_scoped_bulk_status.sql tests/server/tenants/identity-migration.test.ts
git commit -m "feat(db): tenant identity normalization, unique indexes and conflict limit"
```

---

### Task 3: Repository identity lookup and unique-violation translation

**Files:**
- Create: `server/repositories/tenants/identity-errors.ts`
- Create: `server/repositories/tenants/identity-conflict-limit.ts`
- Modify: `server/repositories/tenants/index.ts` (remove `findByPhone`, `findByIdNumber`, `findExistingIdentifiers`; add `findIdentityMatches`; translate violations in `insert`, `insertMany`, `update`)
- Modify: `server/repositories/tenant-portal/profile.ts` (`updateByTenantId`)
- Create: `tests/server/tenants/identity-repository.test.ts`

**Interfaces:**
- Produces:
  - `type TenantIdentityField = 'phone' | 'id_number'`
  - `class TenantIdentityUniqueViolation extends Error { readonly field: TenantIdentityField }`
  - `throwIfTenantIdentityViolation(error: unknown): void`
  - `interface TenantIdentityMatch { tenantId: string; field: TenantIdentityField; value: string }`
  - `TenantRepository.findIdentityMatches(event, input: { phones: string[]; idNumbers: string[]; excludeId?: string }): Promise<TenantIdentityMatch[]>`
  - `TenantIdentityConflictLimitRepository.peek(event, { subjectHash, limit, windowSeconds }): Promise<{ allowed: boolean; retryAfterSeconds: number }>`
  - `TenantIdentityConflictLimitRepository.record(event, { subjectHash, units, windowSeconds }): Promise<void>`

- [x] **Step 1: Write the failing tests**

`tests/server/tenants/identity-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TenantIdentityUniqueViolation, throwIfTenantIdentityViolation } from '../../../server/repositories/tenants/identity-errors'

describe('throwIfTenantIdentityViolation', () => {
  it('maps the phone index to a typed violation', () => {
    expect(() => throwIfTenantIdentityViolation({ code: '23505', message: 'duplicate key value violates unique constraint "tenants_phone_uq"' }))
      .toThrowError(expect.objectContaining({ field: 'phone' }))
  })

  it('maps the id number index from details too', () => {
    try {
      throwIfTenantIdentityViolation({ code: '23505', message: 'duplicate key', details: 'Key (id_number)=(X) already exists. tenants_id_number_uq' })
      throw new Error('expected throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(TenantIdentityUniqueViolation)
      expect((error as TenantIdentityUniqueViolation).field).toBe('id_number')
    }
  })

  it('ignores other unique violations and other errors', () => {
    expect(() => throwIfTenantIdentityViolation({ code: '23505', message: 'tenants_code_uq' })).not.toThrow()
    expect(() => throwIfTenantIdentityViolation({ code: '42501', message: 'tenants_phone_uq' })).not.toThrow()
    expect(() => throwIfTenantIdentityViolation(null)).not.toThrow()
  })
})
```

Add to `tests/server/tenants/repository.test.ts` (it already has a chainable Supabase fake that filters `eq`/`in`; extend the fake with `neq` if missing) a test that seeds `{ id: 'a', phone: '0901234567', id_number: null }`, `{ id: 'b', phone: '0907654321', id_number: '012345678901' }` and asserts:

```ts
expect(await TenantRepository.findIdentityMatches(event, { phones: ['0901234567'], idNumbers: ['012345678901'], excludeId: undefined }))
  .toEqual(expect.arrayContaining([
    { tenantId: 'a', field: 'phone', value: '0901234567' },
    { tenantId: 'b', field: 'id_number', value: '012345678901' },
  ]))
expect(await TenantRepository.findIdentityMatches(event, { phones: ['0901234567'], idNumbers: [], excludeId: 'a' })).toEqual([])
expect(await TenantRepository.findIdentityMatches(event, { phones: [], idNumbers: [] })).toEqual([])
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/tenants/identity-repository.test.ts tests/server/tenants/repository.test.ts`
Expected: FAIL, module/function not found.

- [x] **Step 3: Implement**

`server/repositories/tenants/identity-errors.ts`:

```ts
export type TenantIdentityField = 'phone' | 'id_number'

export class TenantIdentityUniqueViolation extends Error {
  constructor(readonly field: TenantIdentityField) {
    super('TENANT_IDENTITY_UNIQUE_VIOLATION')
    this.name = 'TenantIdentityUniqueViolation'
  }
}

export function throwIfTenantIdentityViolation(error: unknown): void {
  if (!error || typeof error !== 'object') return
  const record = error as { code?: unknown; message?: unknown; details?: unknown }
  if (record.code !== '23505') return
  const text = `${String(record.message ?? '')} ${String(record.details ?? '')}`
  if (text.includes('tenants_phone_uq')) throw new TenantIdentityUniqueViolation('phone')
  if (text.includes('tenants_id_number_uq')) throw new TenantIdentityUniqueViolation('id_number')
}
```

In `server/repositories/tenants/index.ts`:

```ts
import { throwIfTenantIdentityViolation, type TenantIdentityField } from './identity-errors'

export type { TenantIdentityField } from './identity-errors'
export interface TenantIdentityMatch { tenantId: string; field: TenantIdentityField; value: string }
```

Replace `findByIdNumber`, `findByPhone` and `findExistingIdentifiers` with:

```ts
  async findIdentityMatches(
    event: H3Event,
    input: { phones: string[]; idNumbers: string[]; excludeId?: string },
  ): Promise<TenantIdentityMatch[]> {
    const phones = [...new Set(input.phones)]
    const idNumbers = [...new Set(input.idNumbers)]
    if (!phones.length && !idNumbers.length) return []
    const client = await serverSupabaseClient(event)
    const phoneQuery = () => {
      const query = client.from('tenants').select('id, phone').in('phone', phones)
      return input.excludeId ? query.neq('id', input.excludeId) : query
    }
    const idQuery = () => {
      const query = client.from('tenants').select('id, id_number').in('id_number', idNumbers)
      return input.excludeId ? query.neq('id', input.excludeId) : query
    }
    const [phoneResult, idResult] = await Promise.all([
      phones.length ? phoneQuery() : Promise.resolve({ data: [], error: null }),
      idNumbers.length ? idQuery() : Promise.resolve({ data: [], error: null }),
    ])
    if (phoneResult.error) throwDbError(phoneResult.error, 'tenants.findIdentityMatches.phones')
    if (idResult.error) throwDbError(idResult.error, 'tenants.findIdentityMatches.idNumbers')
    return [
      ...(phoneResult.data ?? []).map(row => ({ tenantId: row.id, field: 'phone' as const, value: row.phone })),
      ...(idResult.data ?? []).flatMap(row => row.id_number
        ? [{ tenantId: row.id, field: 'id_number' as const, value: row.id_number }]
        : []),
    ]
  },
```

In `insert`, `insertMany` and `update`, change each `if (error) throwDbError(error, '<context>')` on the tenants write to:

```ts
    if (error) {
      throwIfTenantIdentityViolation(error)
      throwDbError(error, '<context>')
    }
```

Do the same in `server/repositories/tenant-portal/profile.ts` `updateByTenantId` (import from `../tenants/identity-errors`).

`server/repositories/tenants/identity-conflict-limit.ts` (the two RPCs are not in generated types until Task 8 regenerates them; keep the cast at this boundary only and remove it after regeneration):

```ts
import type { H3Event } from 'h3'
import { db } from '../../utils/db'

type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

export const TenantIdentityConflictLimitRepository = {
  async peek(
    event: H3Event,
    input: { subjectHash: string; limit: number; windowSeconds: number },
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const rpc = db(event).rpc.bind(db(event)) as unknown as UntypedRpc
    const { data, error } = await rpc('peek_tenant_identity_conflict_limit', {
      p_subject_hash: input.subjectHash,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    })
    if (error) throwDbError(error, 'tenants.identityConflictLimit.peek')
    const row = ((data ?? []) as Array<{ allowed: boolean; retry_after_seconds: number }>)[0]
    if (!row) throwInternal(new Error('Empty tenant identity conflict limit result'), 'tenants.identityConflictLimit.peek')
    return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds }
  },

  async record(event: H3Event, input: { subjectHash: string; units: number; windowSeconds: number }): Promise<void> {
    const rpc = db(event).rpc.bind(db(event)) as unknown as UntypedRpc
    const { error } = await rpc('record_tenant_identity_conflicts', {
      p_subject_hash: input.subjectHash,
      p_units: input.units,
      p_window_seconds: input.windowSeconds,
    })
    if (error) throwDbError(error, 'tenants.identityConflictLimit.record')
  },
}
```

If `db(event)` returns a new client per call, assign it once (`const client = db(event)`) and use `client.rpc.bind(client)`.

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/server/tenants/identity-repository.test.ts tests/server/tenants/repository.test.ts`
Expected: PASS. Service tests that still reference removed repository methods fail until Task 5; that is expected.

- [x] **Step 5: Commit**

```bash
git add server/repositories/tenants server/repositories/tenant-portal/profile.ts tests/server/tenants/identity-repository.test.ts tests/server/tenants/repository.test.ts
git commit -m "feat(tenants): identity match lookup and unique-violation translation"
```

---

### Task 4: TenantIdentityConflictService

**Files:**
- Create: `server/services/tenants/identity-conflict.ts`
- Modify: `app/utils/constants/audit.ts` (add `TENANT_IDENTITY_CONFLICT: 'tenant.identity_conflict'` next to `TENANT_UPDATED`)
- Modify: `app/utils/audit/display.ts:185` area (label `'tenant.identity_conflict': 'Xung đột định danh khách thuê'`)
- Modify: `app/types/api.ts` (`ErrorCode` adds `'TENANT_DUPLICATE' | 'TENANT_IDENTITY_CONFLICT' | 'RATE_LIMITED'`)
- Modify: `nuxt.config.ts` runtimeConfig (after `aiRateWindowSeconds`): `tenantIdentityConflictLimit: 10, // NUXT_TENANT_IDENTITY_CONFLICT_LIMIT` and `tenantIdentityConflictWindowSeconds: 900, // NUXT_TENANT_IDENTITY_CONFLICT_WINDOW_SECONDS`
- Create: `tests/server/tenants/identity-conflict.test.ts`

**Interfaces:**
- Consumes: `TenantRepository.findIdentityMatches`, `TenantIdentityMatch`, `TenantIdentityConflictLimitRepository`, `TenantAuthorizationService.resolveAccessMany`, `AuditService.append`.
- Produces:
  - `type TenantIdentitySource = 'create' | 'update' | 'import' | 'portal'`
  - `interface TenantIdentityCandidate { phone?: string; idNumber?: string | null; excludeId?: string }`
  - `TENANT_IDENTITY_CONFLICT_MESSAGE`
  - `TenantIdentityConflictService.assertWithinLimit(event, user): Promise<void>`
  - `TenantIdentityConflictService.classify(event, user, matches, source): Promise<{ specific: TenantIdentityMatch[]; generic: TenantIdentityMatch[] }>`
  - `TenantIdentityConflictService.recordConflicts(event, user, generic, source, units): Promise<void>`
  - `TenantIdentityConflictService.assertAvailable(event, user, candidate, source): Promise<void>`
  - `TenantIdentityConflictService.rejectUniqueViolation(event, user, candidate, source): Promise<never>`

- [x] **Step 1: Write the failing tests**

`tests/server/tenants/identity-conflict.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repo = vi.hoisted(() => ({ findIdentityMatches: vi.fn() }))
const limit = vi.hoisted(() => ({ peek: vi.fn(), record: vi.fn() }))
const authz = vi.hoisted(() => ({ resolveAccessMany: vi.fn() }))
const audit = vi.hoisted(() => ({ append: vi.fn() }))
vi.mock('../../../server/repositories/tenants', () => ({ TenantRepository: repo }))
vi.mock('../../../server/repositories/tenants/identity-conflict-limit', () => ({ TenantIdentityConflictLimitRepository: limit }))
vi.mock('../../../server/services/tenants/authorization', () => ({ TenantAuthorizationService: authz }))
vi.mock('../../../server/services/audit', () => ({ AuditService: audit }))
vi.stubGlobal('useRuntimeConfig', () => ({}))
vi.stubGlobal('setResponseHeader', vi.fn())

const event = {} as never
const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as never
const levels = (map: Record<string, 'full' | 'basic' | 'none'>) =>
  new Map(Object.entries(map).map(([id, level]) => [id, { level }]))

beforeEach(() => {
  vi.clearAllMocks()
  limit.peek.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })
  repo.findIdentityMatches.mockResolvedValue([])
})

async function service() {
  return (await import('../../../server/services/tenants/identity-conflict')).TenantIdentityConflictService
}

describe('TenantIdentityConflictService.assertAvailable', () => {
  it('passes when nothing matches and records nothing', async () => {
    await (await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'create')
    expect(limit.record).not.toHaveBeenCalled()
  })

  it('skips lookup and limit when no identity field is present', async () => {
    await (await service()).assertAvailable(event, owner, { idNumber: null }, 'update')
    expect(limit.peek).not.toHaveBeenCalled()
    expect(repo.findIdentityMatches).not.toHaveBeenCalled()
  })

  it('returns TENANT_DUPLICATE with field and tenant id for full access', async () => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-full', field: 'phone', value: '0901234567' }])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-full': 'full' }))
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'create')).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { code: 'TENANT_DUPLICATE', details: { fieldErrors: { phone: ['Số điện thoại đã tồn tại'] }, existingTenantId: 't-full' } } },
    })
    expect(limit.record).toHaveBeenCalledWith(event, expect.objectContaining({ units: 1 }))
    expect(audit.append).not.toHaveBeenCalled()
  })

  it.each(['basic', 'none'] as const)('returns the generic conflict without details for %s access', async (level) => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-out', field: 'id_number', value: '012345678901' }])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-out': level }))
    const error = await (await service()).assertAvailable(event, owner, { idNumber: '012345678901' }, 'create').catch(e => e)
    expect(error).toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' } } })
    expect(error.data.error.details).toBeUndefined()
    expect(JSON.stringify(error.data)).not.toContain('t-out')
    expect(audit.append).toHaveBeenCalledWith(event, owner, expect.objectContaining({
      action: 'tenant.identity_conflict', entity_id: 't-out', after_data: { fields: ['id_number'], source: 'create' },
    }))
  })

  it('returns the generic conflict when any matched tenant is out of scope', async () => {
    repo.findIdentityMatches.mockResolvedValue([
      { tenantId: 't-full', field: 'phone', value: '0901234567' },
      { tenantId: 't-out', field: 'id_number', value: '012345678901' },
    ])
    authz.resolveAccessMany.mockResolvedValue(levels({ 't-full': 'full', 't-out': 'none' }))
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567', idNumber: '012345678901' }, 'update'))
      .rejects.toMatchObject({ data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
  })

  it('always uses the generic conflict for the tenant portal without resolving access', async () => {
    repo.findIdentityMatches.mockResolvedValue([{ tenantId: 't-any', field: 'phone', value: '0901234567' }])
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'portal'))
      .rejects.toMatchObject({ data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
    expect(authz.resolveAccessMany).not.toHaveBeenCalled()
  })

  it('rejects with 429 before any lookup when the limit is exhausted', async () => {
    limit.peek.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 })
    await expect((await service()).assertAvailable(event, owner, { phone: '0901234567' }, 'create')).rejects.toMatchObject({
      statusCode: 429, data: { error: { code: 'RATE_LIMITED', details: { retryAfterSeconds: 120 } } },
    })
    expect(repo.findIdentityMatches).not.toHaveBeenCalled()
  })
})

describe('TenantIdentityConflictService.rejectUniqueViolation', () => {
  it('falls back to the generic conflict when the racing row is no longer visible', async () => {
    await expect((await service()).rejectUniqueViolation(event, owner, { phone: '0901234567' }, 'create'))
      .rejects.toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
    expect(limit.record).toHaveBeenCalledWith(event, expect.objectContaining({ units: 1 }))
  })
})
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/tenants/identity-conflict.test.ts`
Expected: FAIL, module not found.

- [x] **Step 3: Implement**

`server/services/tenants/identity-conflict.ts`:

```ts
import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { TenantRepository, type TenantIdentityField, type TenantIdentityMatch } from '../../repositories/tenants'
import { TenantIdentityConflictLimitRepository } from '../../repositories/tenants/identity-conflict-limit'
import { AuditService } from '../audit'
import { TenantAuthorizationService } from './authorization'

export type TenantIdentitySource = 'create' | 'update' | 'import' | 'portal'
export interface TenantIdentityCandidate { phone?: string; idNumber?: string | null; excludeId?: string }

export const TENANT_IDENTITY_CONFLICT_MESSAGE = 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên'
const DUPLICATE_MESSAGES: Record<TenantIdentityField, string> = {
  phone: 'Số điện thoại đã tồn tại',
  id_number: 'Số CMND/CCCD đã tồn tại',
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback
}

function policy(event: H3Event) {
  const runtime = useRuntimeConfig(event) as Record<string, unknown>
  return {
    limit: bounded(runtime.tenantIdentityConflictLimit, 10, 1, 1_000),
    windowSeconds: bounded(runtime.tenantIdentityConflictWindowSeconds, 900, 60, 86_400),
  }
}

function subjectHash(user: AuthUser): string {
  return createHash('sha256').update(user.id).digest('hex')
}

function lookupOf(candidate: TenantIdentityCandidate) {
  return {
    phones: candidate.phone ? [candidate.phone] : [],
    idNumbers: candidate.idNumber ? [candidate.idNumber] : [],
    excludeId: candidate.excludeId,
  }
}

function genericConflict(): never {
  throw createError({
    statusCode: 409,
    data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: TENANT_IDENTITY_CONFLICT_MESSAGE } },
  })
}

function duplicateConflict(matches: TenantIdentityMatch[]): never {
  const fieldErrors: Partial<Record<TenantIdentityField, string[]>> = {}
  for (const match of matches) fieldErrors[match.field] = [DUPLICATE_MESSAGES[match.field]]
  throw createError({
    statusCode: 409,
    data: {
      error: {
        code: 'TENANT_DUPLICATE',
        message: DUPLICATE_MESSAGES[matches[0]!.field],
        details: { fieldErrors, existingTenantId: matches[0]!.tenantId },
      },
    },
  })
}

export const TenantIdentityConflictService = {
  async assertWithinLimit(event: H3Event, user: AuthUser): Promise<void> {
    const { limit, windowSeconds } = policy(event)
    const result = await TenantIdentityConflictLimitRepository.peek(event, { subjectHash: subjectHash(user), limit, windowSeconds })
    if (result.allowed) return
    setResponseHeader(event, 'Retry-After', result.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      data: {
        error: {
          code: 'RATE_LIMITED',
          message: 'Bạn đã thử quá nhiều lần, vui lòng thử lại sau.',
          details: { retryable: true, retryAfterSeconds: result.retryAfterSeconds },
        },
      },
    })
  },

  async classify(
    event: H3Event,
    user: AuthUser,
    matches: TenantIdentityMatch[],
    source: TenantIdentitySource,
  ): Promise<{ specific: TenantIdentityMatch[]; generic: TenantIdentityMatch[] }> {
    if (!matches.length) return { specific: [], generic: [] }
    if (source === 'portal') return { specific: [], generic: matches }
    const contexts = await TenantAuthorizationService.resolveAccessMany(event, user, matches.map(match => match.tenantId))
    const specific = matches.filter(match => contexts.get(match.tenantId)?.level === 'full')
    return { specific, generic: matches.filter(match => !specific.includes(match)) }
  },

  async recordConflicts(
    event: H3Event,
    user: AuthUser,
    generic: TenantIdentityMatch[],
    source: TenantIdentitySource,
    units: number,
  ): Promise<void> {
    if (units < 1) return
    const { windowSeconds } = policy(event)
    await TenantIdentityConflictLimitRepository.record(event, { subjectHash: subjectHash(user), units, windowSeconds })
    const fieldsByTenant = new Map<string, TenantIdentityField[]>()
    for (const match of generic) {
      const fields = fieldsByTenant.get(match.tenantId) ?? []
      if (!fields.includes(match.field)) fields.push(match.field)
      fieldsByTenant.set(match.tenantId, fields)
    }
    for (const [tenantId, fields] of fieldsByTenant) {
      await AuditService.append(event, user, {
        building_id: null,
        action: AUDIT_ACTIONS.TENANT_IDENTITY_CONFLICT,
        entity_type: 'tenant',
        entity_id: tenantId,
        after_data: { fields, source },
      })
    }
  },

  async rejectMatches(event: H3Event, user: AuthUser, matches: TenantIdentityMatch[], source: TenantIdentitySource): Promise<void> {
    if (!matches.length) return
    const { specific, generic } = await this.classify(event, user, matches, source)
    await this.recordConflicts(event, user, generic, source, 1)
    if (generic.length) genericConflict()
    duplicateConflict(specific)
  },

  async assertAvailable(event: H3Event, user: AuthUser, candidate: TenantIdentityCandidate, source: TenantIdentitySource): Promise<void> {
    const lookup = lookupOf(candidate)
    if (!lookup.phones.length && !lookup.idNumbers.length) return
    await this.assertWithinLimit(event, user)
    await this.rejectMatches(event, user, await TenantRepository.findIdentityMatches(event, lookup), source)
  },

  async rejectUniqueViolation(event: H3Event, user: AuthUser, candidate: TenantIdentityCandidate, source: TenantIdentitySource): Promise<never> {
    await this.rejectMatches(event, user, await TenantRepository.findIdentityMatches(event, lookupOf(candidate)), source)
    await this.recordConflicts(event, user, [], source, 1)
    genericConflict()
  },
}
```

Add the audit constant, display label, `ErrorCode` members and the two runtime keys listed under **Files**.

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/server/tenants/identity-conflict.test.ts tests/utils/audit-display.test.ts`
Expected: PASS. If `audit-display.test.ts` asserts the full label map, add the new label to its expectation.

- [x] **Step 5: Commit**

```bash
git add server/services/tenants/identity-conflict.ts app/utils/constants/audit.ts app/utils/audit/display.ts app/types/api.ts nuxt.config.ts tests/server/tenants/identity-conflict.test.ts tests/utils/audit-display.test.ts
git commit -m "feat(tenants): scoped identity conflict service with rate limit"
```

---

### Task 5: Wire conflicts into create, update, import and portal

**Files:**
- Modify: `server/services/tenants/index.ts` (`create`, `bulkCreate`, `update`, `TenantBulkCreateFailure.reason`)
- Modify: `server/services/tenant-portal/profile.ts` (`update`)
- Modify: `app/pages/dashboard/tenants/index.vue:109-116` (`bulkCreateReasonLabels`)
- Modify: client type of bulk-create failure reason if declared under `app/types/**` (search `duplicate_phone_in_file`)
- Modify: `tests/server/tenants.api.test.ts`, `tests/server/tenants/scope-service.test.ts`, `tests/server/tenant-portal/services.test.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 3 and 4.
- Produces: bulk failure reason `'identity_conflict'` with message `TENANT_IDENTITY_CONFLICT_MESSAGE`.

- [x] **Step 1: Update test harnesses for the new dependencies**

In `tests/server/tenants.api.test.ts`:
- In `repoMocks`, replace `findByIdNumber`, `findByPhone`, `findExistingIdentifiers` with `findIdentityMatches: vi.fn()`; in `beforeEach` set `repoMocks.findIdentityMatches.mockResolvedValue([])` and delete the old defaults.
- Add:

```ts
const limitMocks = vi.hoisted(() => ({ peek: vi.fn(), record: vi.fn() }))
vi.mock('../../server/repositories/tenants/identity-conflict-limit', () => ({ TenantIdentityConflictLimitRepository: limitMocks }))
vi.stubGlobal('useRuntimeConfig', () => ({}))
vi.stubGlobal('setResponseHeader', vi.fn())
```

and in `beforeEach`: `limitMocks.peek.mockResolvedValue({ allowed: true, retryAfterSeconds: 1 })`.
- Convert every `findExistingIdentifiers.mockResolvedValue({ phones: new Set([P]), idNumbers: new Set([I]) })` into `findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'phone', value: P }, { tenantId: 'existing', field: 'id_number', value: I }])` (only the entries that were present). Admin callers resolve to `full`, so existing reason assertions stay unchanged.

Apply the same `findIdentityMatches` / limit mock / `useRuntimeConfig` changes to `tests/server/tenants/scope-service.test.ts` (its `expect(repo.findByPhone).not.toHaveBeenCalled()` becomes `expect(repo.findIdentityMatches).not.toHaveBeenCalled()`) and to `tests/server/tenant-portal/services.test.ts` (`TenantRepository: { findIdentityMatches: mocks.findIdentityMatches }`, default `[]`).

- [x] **Step 2: Write the failing behavior tests**

Replace the two duplicate tests in `describe('POST /api/tenants')` and add the rest:

```ts
  it('returns TENANT_DUPLICATE for an admin when the normalized id number exists', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'id_number', value: '012345678901' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({
      body: { full_name: 'Nguyen Van A', phone: '0901234567', id_number: '0123 4567 8901' },
    }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idNumbers: ['012345678901'] }))
    expect(repoMocks.insert).not.toHaveBeenCalled()
  })

  it('looks up the normalized phone when the input uses +84 and separators', async () => {
    asAdmin()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'existing', field: 'phone', value: '0901234567' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Nguyen Van A', phone: '+84 90 123 4567' } }))))
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ phones: ['0901234567'] }))
  })

  it('returns the generic conflict to an owner when the duplicate is outside scope', async () => {
    asOwner()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'other-building', field: 'phone', value: '0901234567' }])
    repoMocks.findAccessFacts.mockResolvedValue(new Map([['other-building', { activeBuildingIds: ['b-other'], historicalBuildingIds: ['b-other'], everContracted: true }]]))
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Nguyen Van A', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_IDENTITY_CONFLICT')
    expect(err.data?.error?.details).toBeUndefined()
  })

  it('maps a unique-index race on insert to a conflict instead of 500', async () => {
    asAdmin()
    const { TenantIdentityUniqueViolation } = await import('../../server/repositories/tenants/identity-errors')
    repoMocks.insert.mockRejectedValue(new TenantIdentityUniqueViolation('phone'))
    repoMocks.findIdentityMatches.mockResolvedValueOnce([]).mockResolvedValueOnce([{ tenantId: 'racer', field: 'phone', value: '0901234567' }])
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Nguyen Van A', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(409)
    expect(err.data?.error?.code).toBe('TENANT_DUPLICATE')
  })

  it('rejects with 429 before lookup when the conflict limit is exhausted', async () => {
    asAdmin()
    limitMocks.peek.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 })
    const { default: handler } = await import('../../server/api/tenants/index.post')
    const err = await expectError(Promise.resolve(handler(makeEvent({ body: { full_name: 'Nguyen Van A', phone: '0901234567' } }))))
    expect(err.statusCode).toBe(429)
    expect(repoMocks.findIdentityMatches).not.toHaveBeenCalled()
    expect(repoMocks.insert).not.toHaveBeenCalled()
  })
```

In the PATCH describe block, add:

```ts
  it('excludes the tenant being edited from identity matching', async () => {
    asAdmin()
    repoMocks.findByIdentifier.mockResolvedValue(buildTenant({ id: 't-1', phone: '0901234567' }))
    repoMocks.update.mockResolvedValue(buildTenant({ id: 't-1' }))
    const { default: handler } = await import('../../server/api/tenants/[id].patch')
    await handler(makeEvent({ params: { id: 't-1' }, body: { phone: '0901234567' } }))
    expect(repoMocks.findIdentityMatches).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ excludeId: 't-1', phones: ['0901234567'] }))
  })
```

(Use the existing PATCH route file name and identifier helper of this test file; adjust only those two names if they differ.)

In the bulk-create describe block, add:

```ts
  it('reports out-of-scope duplicates as identity_conflict without detail', async () => {
    asOwner()
    repoMocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'elsewhere', field: 'id_number', value: '012345678901' }])
    repoMocks.findAccessFacts.mockResolvedValue(new Map([['elsewhere', { activeBuildingIds: ['b-other'], historicalBuildingIds: ['b-other'], everContracted: true }]]))
    const { default: handler } = await import('../../server/api/tenants/bulk-create.post')
    const res = await handler(makeEvent({ body: { rows: [{ line: 2, full_name: 'Nguyen Van A', phone: '0901234567', id_number: '012345678901' }] } })) as { data: { failed: unknown[] } }
    expect(res.data.failed).toEqual([{ line: 2, reason: 'identity_conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' }])
    expect(limitMocks.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ units: 1 }))
  })
```

(Use the existing bulk-create route import path from the current bulk tests in this file.)

In `tests/server/tenant-portal/services.test.ts`, replace the existing duplicate-ID expectation with:

```ts
  it('returns the generic conflict when a portal tenant enters an existing phone or id number', async () => {
    mocks.findIdentityMatches.mockResolvedValue([{ tenantId: 'tenant-2', field: 'phone', value: '0903000000' }])
    const { TenantProfileService } = await import('../../../server/services/tenant-portal/profile')
    await expect(TenantProfileService.update({} as never, tenantUser, { phone: '0903000000' } as never))
      .rejects.toMatchObject({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT' } } })
    expect(mocks.updateProfile).not.toHaveBeenCalled()
  })
```

- [x] **Step 3: Run to verify failure**

Run: `npx vitest run tests/server/tenants.api.test.ts tests/server/tenants/scope-service.test.ts tests/server/tenant-portal/services.test.ts`
Expected: FAIL on the new expectations (old service still calls removed repository methods).

- [x] **Step 4: Implement `create` and `update`**

In `server/services/tenants/index.ts` import:

```ts
import { TenantIdentityUniqueViolation } from '../../repositories/tenants/identity-errors'
import { TENANT_IDENTITY_CONFLICT_MESSAGE, TenantIdentityConflictService } from './identity-conflict'
```

`create` body after `requireCapability`:

```ts
    const candidate = { phone: input.phone, idNumber: input.id_number ?? null }
    await TenantIdentityConflictService.assertAvailable(event, user, candidate, 'create')
    let result: Tenant
    try {
      result = await TenantRepository.insert(event, input)
    }
    catch (error) {
      if (error instanceof TenantIdentityUniqueViolation) {
        return TenantIdentityConflictService.rejectUniqueViolation(event, user, candidate, 'create')
      }
      throw error
    }
```

`update` after `assertAccess`, replacing both old duplicate checks:

```ts
    const candidate = { phone: input.phone, idNumber: input.id_number ?? null, excludeId: existing.id }
    await TenantIdentityConflictService.assertAvailable(event, user, candidate, 'update')
    let updated: Tenant
    try {
      updated = await TenantRepository.update(event, existing.id, input)
    }
    catch (error) {
      if (error instanceof TenantIdentityUniqueViolation) {
        return TenantIdentityConflictService.rejectUniqueViolation(event, user, candidate, 'update')
      }
      throw error
    }
```

- [x] **Step 5: Implement `bulkCreate`**

Add `'identity_conflict'` to `TenantBulkCreateFailure['reason']`. Right after `requireCapability`, call `await TenantIdentityConflictService.assertWithinLimit(event, user)`. Replace the `findExistingIdentifiers` block and the `insertable` filter with:

```ts
    const matches = await TenantRepository.findIdentityMatches(event, {
      phones: valid.map(item => item.data.phone),
      idNumbers: valid.flatMap(item => item.data.id_number ? [item.data.id_number] : []),
    })
    const { specific, generic } = await TenantIdentityConflictService.classify(event, user, matches, 'import')
    const valuesOf = (list: typeof matches, field: 'phone' | 'id_number') =>
      new Set(list.filter(match => match.field === field).map(match => match.value))
    const genericPhones = valuesOf(generic, 'phone')
    const genericIds = valuesOf(generic, 'id_number')
    const specificPhones = valuesOf(specific, 'phone')
    const specificIds = valuesOf(specific, 'id_number')
    let conflictRows = 0
    const insertable = valid.filter((item) => {
      const idNumber = item.data.id_number
      if (genericPhones.has(item.data.phone) || (idNumber && genericIds.has(idNumber))) {
        conflictRows++
        failed.push({ line: item.line, reason: 'identity_conflict', message: TENANT_IDENTITY_CONFLICT_MESSAGE })
        return false
      }
      if (specificPhones.has(item.data.phone)) {
        conflictRows++
        failed.push({
          line: item.line,
          reason: 'duplicate_phone',
          message: 'Số điện thoại đã tồn tại trong hệ thống',
          fieldErrors: { phone: ['Số điện thoại đã tồn tại trong hệ thống'] },
        })
        return false
      }
      if (idNumber && specificIds.has(idNumber)) {
        conflictRows++
        failed.push({
          line: item.line,
          reason: 'duplicate_id_number',
          message: 'Số CMND/CCCD đã tồn tại trong hệ thống',
          fieldErrors: { id_number: ['Số CMND/CCCD đã tồn tại trong hệ thống'] },
        })
        return false
      }
      return true
    })
    await TenantIdentityConflictService.recordConflicts(event, user, generic, 'import', conflictRows)
```

The existing `insertMany` `catch` keeps marking every insertable row as `unexpected_error`; a `TenantIdentityUniqueViolation` from a concurrent import lands there because the batch is one insert and the offending row is unknown.

- [x] **Step 6: Implement the portal**

In `server/services/tenant-portal/profile.ts`, replace the `findByIdNumber` block with:

```ts
    const candidate = { phone: whitelisted.phone, idNumber: whitelisted.id_number ?? null, excludeId: id }
    await TenantIdentityConflictService.assertAvailable(event, user, candidate, 'portal')
```

and wrap `TenantProfileRepository.updateByTenantId` like `update` above with source `'portal'`. Remove the now-unused `TenantRepository` and `throwConflict` imports.

- [x] **Step 7: Bulk label in the UI**

In `app/pages/dashboard/tenants/index.vue`, add to `bulkCreateReasonLabels`:

```ts
  identity_conflict: 'Không thể nhập dòng này; liên hệ quản trị viên',
```

Add `'identity_conflict'` to any client-side union of bulk-create reasons found by searching `duplicate_phone_in_file` under `app/`.

- [x] **Step 8: Run tests**

Run: `npx vitest run tests/server/tenants tests/server/tenants.api.test.ts tests/server/tenant-portal tests/pages`
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add server/services/tenants/index.ts server/services/tenant-portal/profile.ts app/pages/dashboard/tenants/index.vue app/types tests/server
git commit -m "feat(tenants): non-disclosing identity conflicts for create, update, import and portal"
```

---

### Task 6: Redact tenant audit snapshots

**Files:**
- Create: `server/utils/tenant-audit-redaction.ts`
- Create: `tests/server/tenants/audit-redaction.test.ts`
- Modify: `server/services/tenants/index.ts` (audit calls in `create`, `update`, and any `entity_type: 'tenant'` call that passes a tenant snapshot in `before_data`/`after_data`, e.g. around lines 421 and 457)
- Modify: `server/services/tenant-portal/profile.ts` (profile audit)
- Modify: `server/services/tenant-portal/identity-images.ts` (only if its audit passes tenant snapshots)

**Interfaces:**
- Produces: `redactTenantAuditData(before: unknown, after: unknown): { before: unknown; after: unknown }`, `TENANT_AUDIT_REDACTED = '[đã ẩn]'`, `TENANT_AUDIT_REDACTED_CHANGED = '[đã ẩn · đã thay đổi]'`.

`sanitizeAuditPayload` already drops keys ending in `path`/`url`, so ID image paths need no extra handling.

- [x] **Step 1: Write the failing tests**

`tests/server/tenants/audit-redaction.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { redactTenantAuditData } from '../../../server/utils/tenant-audit-redaction'

const before = {
  id: 't-1', fullName: 'Khách Giả Lập', phone: '0901234567', idNumber: '012345678901',
  dateOfBirth: '1990-01-01', permanentAddress: 'Địa chỉ giả lập', idIssuedDate: '2020-01-01',
  idIssuedPlace: 'Nơi cấp giả lập', emergencyContactName: 'Người thân', emergencyContactPhone: '0907654321',
}

describe('redactTenantAuditData', () => {
  it('masks the id number and hides other identity fields on create', () => {
    const { before: b, after } = redactTenantAuditData(null, before)
    expect(b).toBeNull()
    expect(after).toMatchObject({
      fullName: 'Khách Giả Lập', phone: '0901234567', idNumber: '•••• 8901',
      dateOfBirth: '[đã ẩn]', permanentAddress: '[đã ẩn]', emergencyContactPhone: '[đã ẩn]',
    })
    expect(JSON.stringify(after)).not.toContain('012345678901')
    expect(JSON.stringify(after)).not.toContain('Địa chỉ giả lập')
  })

  it('marks changed hidden fields so history still shows a diff', () => {
    const { before: b, after } = redactTenantAuditData(before, { ...before, permanentAddress: 'Địa chỉ mới' })
    expect((b as Record<string, unknown>).permanentAddress).toBe('[đã ẩn]')
    expect((after as Record<string, unknown>).permanentAddress).toBe('[đã ẩn · đã thay đổi]')
    expect((after as Record<string, unknown>).dateOfBirth).toBe('[đã ẩn]')
  })

  it('flags an id number change even when the last four digits match', () => {
    const { after } = redactTenantAuditData(before, { ...before, idNumber: '999999998901' })
    expect((after as Record<string, unknown>).idNumber).toBe('•••• 8901 · đã thay đổi')
  })

  it('handles snake_case portal payloads and keeps nulls', () => {
    const { after } = redactTenantAuditData(null, { id_number: '012345678901', date_of_birth: null })
    expect(after).toEqual({ id_number: '•••• 8901', date_of_birth: null })
  })
})
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/server/tenants/audit-redaction.test.ts`
Expected: FAIL, module not found.

- [x] **Step 3: Implement**

`server/utils/tenant-audit-redaction.ts`:

```ts
export const TENANT_AUDIT_REDACTED = '[đã ẩn]'
export const TENANT_AUDIT_REDACTED_CHANGED = '[đã ẩn · đã thay đổi]'

const MASKED_KEYS = new Set(['idnumber'])
const HIDDEN_KEYS = new Set([
  'dateofbirth', 'permanentaddress', 'idissueddate', 'idissuedplace', 'emergencycontactname', 'emergencycontactphone',
])

type Snapshot = Record<string, unknown>
const keyOf = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase()
const isSnapshot = (value: unknown): value is Snapshot => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const mask = (value: string) => `•••• ${value.slice(-4)}`

function redact(snapshot: Snapshot, previous: Snapshot | null): Snapshot {
  const output: Snapshot = { ...snapshot }
  for (const [key, value] of Object.entries(snapshot)) {
    const normalized = keyOf(key)
    if (value === null || value === undefined || value === '') continue
    const changed = previous !== null && previous[key] !== value
    if (MASKED_KEYS.has(normalized) && typeof value === 'string') {
      const previousValue = previous?.[key]
      const sameMask = typeof previousValue === 'string' && mask(previousValue) === mask(value)
      output[key] = changed && sameMask ? `${mask(value)} · đã thay đổi` : mask(value)
    }
    else if (HIDDEN_KEYS.has(normalized)) {
      output[key] = changed ? TENANT_AUDIT_REDACTED_CHANGED : TENANT_AUDIT_REDACTED
    }
  }
  return output
}

export function redactTenantAuditData(before: unknown, after: unknown): { before: unknown; after: unknown } {
  const previous = isSnapshot(before) ? before : null
  return {
    before: previous ? redact(previous, null) : before,
    after: isSnapshot(after) ? redact(after, previous) : after,
  }
}
```

Note: on create (`before = null`) `changed` is false, so hidden fields show `[đã ẩn]`.

Wire it into each tenant-snapshot audit call:

```ts
    const redacted = redactTenantAuditData(existing, updated)
    await AuditService.append(event, user, {
      // ...unchanged fields
      before_data: redacted.before,
      after_data: redacted.after,
    })
```

For create: `const redacted = redactTenantAuditData(null, result)` and `after_data: redacted.after`. Import from `'../../utils/tenant-audit-redaction'` (portal: same relative depth).

- [x] **Step 4: Add a service-level assertion**

In `tests/server/tenant-portal/services.test.ts` add a test that updates `{ id_number: '012345678901' }` with `findProfile` returning `{ id: 'tenant-1', idNumber: null }` and `updateProfile` returning `{ id: 'tenant-1', idNumber: '012345678901' }`, then asserts `JSON.stringify(mocks.auditAppend.mock.calls[0][2])` does not contain `'012345678901'`.

- [x] **Step 5: Run tests**

Run: `npx vitest run tests/server/tenants tests/server/tenant-portal tests/server/tenants.api.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add server/utils/tenant-audit-redaction.ts server/services/tenants server/services/tenant-portal tests/server
git commit -m "feat(audit): redact tenant identity fields in new audit snapshots"
```

---

### Task 7: Keep identity fields out of form drafts

**Files:**
- Modify: `app/composables/useLocalFormDraft.ts` (new `omitKeys` option)
- Modify: `app/composables/tenants/useTenantForm.ts:35-39`
- Modify: `app/utils/tenant-identity.ts` (export `TENANT_SENSITIVE_DRAFT_KEYS`)
- Modify: `tests/composables/useLocalFormDraft.test.ts`

**Interfaces:**
- Produces: `UseLocalFormDraftOptions.omitKeys?: readonly string[]`; `TENANT_SENSITIVE_DRAFT_KEYS`.

- [x] **Step 1: Write the failing tests**

Append to `tests/composables/useLocalFormDraft.test.ts`:

```ts
interface IdentityForm {
  full_name: string
  id_number: string
}

describe('useLocalFormDraft omitKeys', () => {
  it('never writes omitted keys', async () => {
    vi.useFakeTimers()
    const formData = ref<IdentityForm>({ full_name: '', id_number: '' })
    const snapshot = ref<IdentityForm | null>({ full_name: '', id_number: '' })
    useLocalFormDraft<IdentityForm>({ key: 'form:omit', formData, initialSnapshot: snapshot, omitKeys: ['id_number'], debounceMs: 10 })
    formData.value = { full_name: 'Khách Giả Lập', id_number: '012345678901' }
    await nextTick()
    await vi.advanceTimersByTimeAsync(20)
    expect(window.localStorage.getItem('form:omit')).toBe(JSON.stringify({ full_name: 'Khách Giả Lập' }))
    vi.useRealTimers()
  })

  it('purges omitted keys from a legacy draft and keeps current values on restore', () => {
    window.localStorage.setItem('form:legacy', JSON.stringify({ full_name: 'Khách Giả Lập', id_number: '012345678901' }))
    const formData = ref<IdentityForm>({ full_name: '', id_number: '' })
    const draft = useLocalFormDraft<IdentityForm>({ key: 'form:legacy', formData, omitKeys: ['id_number'] })
    expect(window.localStorage.getItem('form:legacy')).not.toContain('012345678901')
    draft.restoreDraft()
    expect(formData.value).toEqual({ full_name: 'Khách Giả Lập', id_number: '' })
  })
})
```

Update the imports at the top of the file to `import { afterEach, describe, expect, it, vi } from 'vitest'` and `import { nextTick, ref } from 'vue'`.

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/composables/useLocalFormDraft.test.ts`
Expected: FAIL (`omitKeys` ignored; legacy draft still contains the ID number).

- [x] **Step 3: Implement**

In `useLocalFormDraft.ts`, add to the options interface:

```ts
  /** Top-level keys never persisted; existing drafts are purged of them on read. */
  omitKeys?: readonly string[]
```

Inside `useLocalFormDraft`:

```ts
  const omitKeys = options.omitKeys ?? []

  function stripOmitted(value: T): T {
    if (!omitKeys.length || !value || typeof value !== 'object' || Array.isArray(value)) return value
    const copy = { ...(value as Record<string, unknown>) }
    for (const key of omitKeys) delete copy[key]
    return copy as T
  }

  function purgeStoredDraft() {
    if (!omitKeys.length || !storageKey.value) return
    const envelope = readDraftEnvelope<T>(storageKey.value)
    if (!envelope || !envelope.data || typeof envelope.data !== 'object') return
    if (!omitKeys.some(key => key in (envelope.data as Record<string, unknown>))) return
    const data = stripOmitted(envelope.data)
    safeSetItem(storageKey.value, envelope.savedAt ? JSON.stringify({ savedAt: envelope.savedAt, data }) : JSON.stringify(data))
  }
```

Call `purgeStoredDraft()` right before the existing `if (isHydrated.value) refreshHasDraft()` and at the start of the `onMounted` callback. In `write`, serialize `stripOmitted(value)` instead of `value`. In `restoreDraft`, replace the assignment with:

```ts
    const data = stripOmitted(envelope.data)
    if (options.formData) {
      options.formData.value = omitKeys.length && options.formData.value && typeof options.formData.value === 'object'
        ? { ...options.formData.value, ...data } as T
        : data
    }
    return data
```

In `app/utils/tenant-identity.ts`:

```ts
export const TENANT_SENSITIVE_DRAFT_KEYS = [
  'id_number', 'id_issued_date', 'id_issued_place', 'date_of_birth',
  'permanent_address', 'emergency_contact_name', 'emergency_contact_phone',
] as const
```

In `useTenantForm.ts`, pass `omitKeys: TENANT_SENSITIVE_DRAFT_KEYS` to `useLocalFormDraft` (import from `~/utils/tenant-identity`).

- [x] **Step 4: Run tests**

Run: `npx vitest run tests/composables tests/pages`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add app/composables/useLocalFormDraft.ts app/composables/tenants/useTenantForm.ts app/utils/tenant-identity.ts tests/composables/useLocalFormDraft.test.ts
git commit -m "fix(tenants): keep identity fields out of local form drafts"
```

---

### Task 8: Full verification, cloud rollout and documentation

**Files:**
- Modify: `server/repositories/tenants/identity-conflict-limit.ts` (remove the `UntypedRpc` cast after type regeneration)
- Regenerate: `app/types/database.types.ts` (tooling only)
- Modify: `docs/capabilities/tenants-api.md`, `docs/capabilities/tenants-database.md`, `docs/capabilities/tenants-ui.md`, `docs/capabilities/tenant-portal-api.md`, `docs/capabilities/entity-audit-log.md`
- Modify: `docs/changes/harden-tenant-identity-data/index.md`, `design.md`, `proposal.md` (`change_state`), this file (execution record)
- Modify: `docs/changes/index.md`

- [x] **Step 1: Local verification**

Run, in order, and record outputs in the execution record below: `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`. All must pass.

- [ ] **Step 2: Visual check of affected states**

Following `.agents/skills/zeno-house/references/ui-polish-workflow.md` for affected states only: tenant create/edit with the generic conflict alert, tenant create with a `TENANT_DUPLICATE` alert, 429 alert, bulk import result with `identity_conflict`, portal profile edit with the generic conflict. Use mocked API responses; no new components.

- [ ] **Step 3: Cloud rollout (ask the user before each write)**

1. Apply `*_tenant_identity_conflict_limit.sql` in the Dashboard SQL editor.
2. Run `supabase/verification/tenant_identity_duplicates.sql`; share only the group counts with the user. Admin resolves every group manually (merge or correct records).
3. Re-run the preflight until it returns zero rows; apply `*_harden_tenant_identity_data.sql`.
4. Run `supabase/verification/harden_tenant_identity_data.sql`; every column must be `true`.
5. Re-run `atomic_billing_close.sql`, `atomic_contract_renewal.sql`, `tenant_scoped_bulk_status.sql` verifications.
6. Regenerate `app/types/database.types.ts` with the project's existing type-generation command, remove the `UntypedRpc` cast, re-run `npm run typecheck`.

Never claim cloud steps passed without the user-confirmed output.

- [ ] **Step 4: Reconcile documentation**

Update the accepted capabilities with: normalized phone/ID uniqueness and rules (`tenants-database`, `tenants-api`), `TENANT_DUPLICATE` / `TENANT_IDENTITY_CONFLICT` / `RATE_LIMITED` behavior and the `identity_conflict` import reason (`tenants-api`, `tenant-portal-api`), draft omission and error display (`tenants-ui`), redaction and `tenant.identity_conflict` (`entity-audit-log`). Set `change_state` accordingly, update `docs/changes/index.md`, run `npm run knowledge:check`.

- [ ] **Step 5: Commit**

```bash
git add app/types/database.types.ts server/repositories/tenants/identity-conflict-limit.ts docs
git commit -m "docs(tenants): reconcile identity hardening capabilities and rollout evidence"
```

## Execution record

### 2026-11-09 — implementation and review

Tasks 1–7 are recorded in one consolidated implementation commit after full verification, rather than committing intermediate non-integrated states.

- Work occurs on `fix/harden-tenant-identity-data`; preexisting changes to the Tenant V2 umbrella document are preserved. No dependency installation or local server/container started. `caffeinate -i` runs during the task.
- Tasks 1–7 implemented with red/green evidence: normalization/draft/error/bulk-preview tests, SQL contract/fixture checks, identity repository/RPC tests, shared conflict policy tests, real create/update/import/portal wiring and audit boundary regressions.
- Added focused UI error mapping using existing inline fields/UiAlert: full-access duplicate fields, generic banner without identity details, and a finite retry interval for 429. Bulk preview compares parsed canonical identities.
- Independent foundation/wiring/redaction reviews found a Unicode mismatch; fixed SQL/preflight to strip the explicit ECMAScript whitespace repertoire and uppercase with root ICU (`pg_catalog."und-x-icu"`). The generated 31-case SQL fixture comes from the same JSON as TypeScript tests; `node scripts/generate-tenant-identity-sql-fixture.mjs --check` enforces synchronization.
- Reconciled import budget wording to the explicit plan implementation: count every DB-conflicting row once, including full-access matches, not in-file duplicates. Added a mixed-access regression. Peek/record intentionally remain separate as designed: concurrently admitted checks may exceed the window budget; no strict admission guarantee is claimed.
- Audit helper and all actual dashboard lifecycle/bulk/image and portal profile snapshot paths were reviewed. Portal image paths continue through existing path/URL sanitizer. Old audit rows are unchanged.
- Initial full verification: `npm run typecheck` exit 0; `npm test` 379 files / 2,298 tests passed; `npm run lint` exit 0 with one preexisting `vue/no-v-html` warning at `AppAiDevChat.vue:427`; `npm run knowledge:check` passed (302 concepts, 11 indexes). Final checks after review fixes: `npm run typecheck` exit 0; `npm test` 379 files / 2,325 tests passed; `npm run lint` exit 0 (same one preexisting warning); `npm run knowledge:check` passed (302 concepts, 11 indexes). `git diff --check` and generated SQL fixture `--check` pass.
- Additional boundary regression command: `npx vitest run tests/server/tenants.api.test.ts tests/server/tenant-portal/services.test.ts` passed 73 tests in two files, including update and portal unique races, mixed import accounting and authorized audit redaction.

### Read-only production preflight

- Supabase CLI v3.0.0 is already installed; linked project is `zeno-house` (`alndujothmxhilmvykqs`), production. CLI was used with `db query --remote --read-only`; no cloud writes were made.
- Actual bucket constraints permit `chat`/`action`, require nonnegative request count and 64-character subject hashes. Only user-defined tenant trigger is `tenants_set_updated_at`; no cloud tenant audit trigger was found.
- Root ICU collation exists, and production `upper('ß' collate "und-x-icu")` returns `SS`.
- Duplicate preflight using corrected Unicode semantics returns zero groups. Only group counts were examined; no real names/phones/ID values were printed or committed.
- Two reviewed migration files: `20261109155705_tenant_identity_conflict_limit.sql` then `20261109155706_harden_tenant_identity_data.sql`. The normalization backfill can change `updated_at`; guard+backfill+unique indexes run under a table lock in one transaction.
- Cloud writes still require the explicit approval stated in this plan. Apply only these reviewed migrations (do not blindly push all pending repository migrations), then run shared fixture + rollback functional verification and existing billing/renewal/scoped-status regression SQL. Regenerate database types using the existing CLI only after deployment. The temporary narrow RPC cast remains until then.

### Remaining external gates

- Production migration writes and rollback SQL verification, followed by type generation and scoped/full typecheck.
- Desktop/mobile browser inspection of affected error states; no local runtime started because AGENTS.md requires explicit permission.
- Do not archive/promote this record as fully deployed until those gates have real evidence.

