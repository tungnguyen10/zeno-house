---
type: Change Implementation Plan
title: "building-contract-defaults-implementation-plan"
status: draft
change_state: implementation-review
tags: [superpowers, change, buildings, contracts, pii, v2]
---

# Building Contract Defaults & Readiness (V2 PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store a per-building lessor profile and contract policy defaults, expose a data-derived readiness status, and protect the lessor's personal data.

**Architecture:** New service-role-only table `building_contract_profiles` (1:1 with `buildings`). `BuildingContractProfileService` enforces capability + scope, masks PII for roles without `building-contract-profile.pii.read`, and audits only changed field names. A pure `computeBuildingReadiness()` derives `contract`/`billing` readiness. The settings page gains a "Hợp đồng" section; the building detail page gains a compact readiness block.

**Tech Stack:** Nuxt 3, Vue 3, Zod, Vitest, Supabase (PostgREST), PL/pgSQL.

**Spec:** [design.md](./design.md)

## Global Constraints

- Flow: page/component → composable → server API → service → repository → Supabase.
- Validators in `app/utils/validators/**`, used client + server. DTOs in `app/types/**`, mappers in `app/utils/mappers/**`.
- Do not hand-edit `app/types/database.types.ts`; until regenerated, cast at the repository boundary (`as never`), as `building-invoice-profiles.ts` does.
- Table: RLS enabled, no policies, `revoke all … from public, anon, authenticated`, `grant select, insert, update, delete … to service_role`.
- PII fields: `lessor_date_of_birth`, `lessor_permanent_address`, `lessor_id_number`. They must never appear in audit data, error messages, logs, or responses to callers without `building-contract-profile.pii.read`.
- Masked id format: `"*******" + last 4 digits`.
- Payment window is derived, not stored: X = `billing_generation_day`, Y = `payment_due_day`, Z = `payment_due_day + grace_period_days`.
- Vietnamese copy must have full diacritics.
- UI: reuse design system/primitives; run `frontend-design` + Hallmark per `.agents/skills/zeno-house/references/ui-polish-workflow.md`. New tokens/primitives only after explicit evaluation and approval.
- Cloud migration apply and type regeneration are separate gates.

## Review Focus

1. **Manager response leaks PII via nested/raw fields** — the JSON returned to a manager (profile endpoint and settings bootstrap) must not contain the raw id number anywhere. Pinned in Task 4 (service) and Task 6 (bootstrap) with a `JSON.stringify(...).includes(rawId)` assertion.
2. **Partial save** — owner saves with only the lessor name filled; save succeeds and readiness lists the remaining codes. Pinned in Task 2 (validator) and Task 3 (readiness).
3. **`Z` past day 31** — `payment_due_day = 28`, `grace_period_days = 5` must not print "sau ngày 33"; the sentence switches to "quá N ngày sau hạn thanh toán". Pinned in Task 7 (`formatPaymentWindow` test).
4. **Validation error echoes the CCCD** — Zod messages must be static strings. Pinned in Task 2.
5. **Owner outside scope** — owner reading another owner's building gets 404, while writing gets 403, before any repository read of the profile (accepted building-scope contract). Pinned in Task 4.

---

### Task 1: Migration + verification script

**Files:**
- Create: `supabase/migrations/20261111172755_building_contract_profiles.sql`
- Create: `supabase/verification/building_contract_profiles.sql`
- Test: `tests/config/building-contract-profiles-migration.test.ts`

**Interfaces:**
- Produces table `public.building_contract_profiles` with columns listed in design §4.

- [x] **Step 1: Write the failing static test**

```ts
// tests/config/building-contract-profiles-migration.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261111172755_building_contract_profiles.sql'), 'utf8')

describe('building_contract_profiles migration', () => {
  it('creates a 1:1 table cascading with buildings', () => {
    expect(sql).toContain('create table if not exists public.building_contract_profiles')
    expect(sql).toContain('building_id uuid primary key references public.buildings(id) on delete cascade')
  })

  it('locks the table to service_role', () => {
    expect(sql).toContain('alter table public.building_contract_profiles enable row level security;')
    expect(sql).toContain('revoke all on table public.building_contract_profiles from public, anon, authenticated;')
    expect(sql).toContain('grant select, insert, update, delete on table public.building_contract_profiles to service_role;')
    expect(sql).not.toMatch(/create policy/i)
  })

  it('validates id number and copies', () => {
    expect(sql).toContain(`lessor_id_number ~ '^[0-9]{9}([0-9]{3})?$'`)
    expect(sql).toContain('copies_per_party * 2 <= signed_copies')
  })
})
```

- [x] **Step 2: Run to verify failure**

Run: `npx vitest run tests/config/building-contract-profiles-migration.test.ts`
Expected: FAIL (ENOENT).

- [x] **Step 3: Write the migration**

```sql
-- =============================================================================
-- Building contract profiles (V2 PR1)
-- =============================================================================
-- Lessor (contract signer) identity and default contract policy per building.
-- Contains personal data: service_role only, no RLS policies for clients.
--
-- Data impact: ADDITIVE ONLY (new table).
-- Execution model: apply manually in the Supabase Dashboard SQL Editor, then
-- regenerate database types:
--   npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" \
--     --schema public > app/types/database.types.ts
-- =============================================================================

create table if not exists public.building_contract_profiles (
  building_id uuid primary key references public.buildings(id) on delete cascade,

  lessor_full_name text check (lessor_full_name is null or length(trim(lessor_full_name)) between 2 and 100),
  lessor_date_of_birth date,
  lessor_permanent_address text check (lessor_permanent_address is null or length(lessor_permanent_address) <= 255),
  lessor_id_number text check (lessor_id_number is null or lessor_id_number ~ '^[0-9]{9}([0-9]{3})?$'),
  lessor_id_issued_date date check (lessor_id_issued_date is null or lessor_id_issued_date <= current_date),
  lessor_id_issued_place text check (lessor_id_issued_place is null or length(lessor_id_issued_place) <= 150),
  lessor_phone text check (lessor_phone is null or length(lessor_phone) between 8 and 20),

  brand_name text check (brand_name is null or length(trim(brand_name)) between 1 and 100),

  default_term_months integer check (default_term_months is null or default_term_months between 1 and 60),
  default_deposit_months numeric(3,1) check (default_deposit_months is null or default_deposit_months between 0 and 6),

  notice_days integer check (notice_days is null or notice_days between 0 and 180),
  deposit_refund_days integer check (deposit_refund_days is null or deposit_refund_days between 0 and 90),
  renewal_months integer check (renewal_months is null or renewal_months between 0 and 24),
  extra_occupant_fee numeric(12,0) check (extra_occupant_fee is null or extra_occupant_fee >= 0),
  drilling_fee numeric(12,0) check (drilling_fee is null or drilling_fee >= 0),
  fingerprint_reset_fee numeric(12,0) check (fingerprint_reset_fee is null or fingerprint_reset_fee >= 0),

  signed_copies integer not null default 2 check (signed_copies between 1 and 10),
  copies_per_party integer not null default 1 check (copies_per_party between 1 and 5),
  constraint building_contract_profiles_copies_check check (copies_per_party * 2 <= signed_copies),

  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists building_contract_profiles_set_updated_at on public.building_contract_profiles;
create trigger building_contract_profiles_set_updated_at
  before update on public.building_contract_profiles
  for each row execute function public.set_updated_at();

alter table public.building_contract_profiles enable row level security;
revoke all on table public.building_contract_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.building_contract_profiles to service_role;
```

- [x] **Step 4: Write the verification script**

```sql
-- Verification for building_contract_profiles (V2 PR1). Run as service_role; rolled back.
begin;

do $$
declare
  v_building uuid := (select id from public.buildings order by created_at limit 1);
  v_failed boolean;
begin
  if v_building is null then raise exception 'VERIFY: need at least one building'; end if;

  insert into public.building_contract_profiles (building_id, lessor_full_name, lessor_id_number)
  values (v_building, 'Nguyễn Văn A', '012345678901')
  on conflict (building_id) do update set lessor_full_name = excluded.lessor_full_name;

  v_failed := false;
  begin
    update public.building_contract_profiles set lessor_id_number = '12AB' where building_id = v_building;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY 1 failed: invalid id number accepted'; end if;

  v_failed := false;
  begin
    update public.building_contract_profiles set signed_copies = 1, copies_per_party = 1 where building_id = v_building;
  exception when check_violation then v_failed := true;
  end;
  if not v_failed then raise exception 'VERIFY 2 failed: copies constraint not enforced'; end if;

  raise notice 'building_contract_profiles constraint checks passed';
end $$;

select
  has_table_privilege('anon', 'public.building_contract_profiles', 'select') as anon_select,
  has_table_privilege('authenticated', 'public.building_contract_profiles', 'select') as auth_select,
  has_table_privilege('service_role', 'public.building_contract_profiles', 'select') as service_select,
  (select count(*) from pg_policies where tablename = 'building_contract_profiles') as policy_count;
-- Expected: false, false, true, 0.

rollback;
```

Cascade check (manual, cloud gate): create a throwaway building + profile inside `begin; … rollback;`, delete the building, confirm the profile row is gone.

- [x] **Step 5: Run test** — `npx vitest run tests/config/building-contract-profiles-migration.test.ts` → PASS.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20261111172755_building_contract_profiles.sql supabase/verification/building_contract_profiles.sql tests/config/building-contract-profiles-migration.test.ts
git commit -m "feat(db): add building_contract_profiles table"
```

---

### Task 2: DTO, mapper, validator

**Files:**
- Create: `app/types/building-contract-profile.ts`
- Create: `app/utils/mappers/building-contract-profile.ts`
- Create: `app/utils/validators/building-contract-profile.ts`
- Test: `tests/utils/building-contract-profile-validator.test.ts`, `tests/utils/building-contract-profile-mapper.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // app/types/building-contract-profile.ts
  export interface BuildingContractProfile {
    buildingId: string
    lessorFullName: string | null
    lessorDateOfBirth: string | null
    lessorPermanentAddress: string | null
    lessorIdNumber: string | null
    lessorIdIssuedDate: string | null
    lessorIdIssuedPlace: string | null
    lessorPhone: string | null
    lessorIdentityMasked: boolean
    brandName: string | null
    defaultTermMonths: number | null
    defaultDepositMonths: number | null
    noticeDays: number | null
    depositRefundDays: number | null
    renewalMonths: number | null
    extraOccupantFee: number | null
    drillingFee: number | null
    fingerprintResetFee: number | null
    signedCopies: number
    copiesPerParty: number
    updatedAt: string
    updatedBy: string | null
  }
  export type ReadinessCode =
    | 'lessor.full_name' | 'lessor.date_of_birth' | 'lessor.permanent_address' | 'lessor.id_number'
    | 'lessor.id_issued_date' | 'lessor.id_issued_place' | 'lessor.phone'
    | 'contract.default_term_months' | 'contract.default_deposit_months'
    | 'terms.notice_days' | 'terms.deposit_refund_days' | 'terms.renewal_months'
    | 'terms.extra_occupant_fee' | 'terms.drilling_fee' | 'terms.fingerprint_reset_fee'
    | 'billing.schedule' | 'billing.electricity_rate' | 'billing.water_rate' | 'invoice_profile'
  export interface ReadinessStatus { ready: boolean; missing: ReadinessCode[] }
  export interface BuildingReadiness { contract: ReadinessStatus; billing: ReadinessStatus }
  ```
  ```ts
  // mapper
  export interface BuildingContractProfileRow { building_id: string; lessor_full_name: string | null; lessor_date_of_birth: string | null; lessor_permanent_address: string | null; lessor_id_number: string | null; lessor_id_issued_date: string | null; lessor_id_issued_place: string | null; lessor_phone: string | null; brand_name: string | null; default_term_months: number | null; default_deposit_months: number | string | null; notice_days: number | null; deposit_refund_days: number | null; renewal_months: number | null; extra_occupant_fee: number | string | null; drilling_fee: number | string | null; fingerprint_reset_fee: number | string | null; signed_copies: number; copies_per_party: number; updated_by: string | null; created_at: string | null; updated_at: string | null }
  export function mapBuildingContractProfile(row: BuildingContractProfileRow): BuildingContractProfile
  export function maskBuildingContractProfile(profile: BuildingContractProfile): BuildingContractProfile
  export function maskIdNumber(value: string | null): string | null
  ```
  ```ts
  // validator
  export const buildingContractProfileSchema: z.ZodType<…>   // snake_case body
  export type BuildingContractProfileInput = z.infer<typeof buildingContractProfileSchema>
  export const CONTRACT_PROFILE_PII_FIELDS = ['lessor_date_of_birth', 'lessor_permanent_address', 'lessor_id_number'] as const
  ```

- [x] **Step 1: Write failing tests**

```ts
// tests/utils/building-contract-profile-validator.test.ts
import { describe, expect, it } from 'vitest'
import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'

const full = {
  lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02', lessor_permanent_address: '12 Lê Lợi, Huế',
  lessor_id_number: '012345678901', lessor_id_issued_date: '2021-05-01', lessor_id_issued_place: 'Cục Cảnh sát QLHC về TTXH',
  lessor_phone: '0901 234 567', brand_name: 'Zeno House', default_term_months: 12, default_deposit_months: 1.5,
  notice_days: 30, deposit_refund_days: 7, renewal_months: 6, extra_occupant_fee: 500000, drilling_fee: 50000,
  fingerprint_reset_fee: 100000, signed_copies: 2, copies_per_party: 1,
}

describe('buildingContractProfileSchema', () => {
  it('accepts a full profile and normalizes phone', () => {
    const r = buildingContractProfileSchema.safeParse(full)
    expect(r.success).toBe(true)
    expect(r.data!.lessor_phone).toBe('0901234567')
  })

  it('accepts an empty profile (all nullable, copies default)', () => {
    const r = buildingContractProfileSchema.safeParse({})
    expect(r.success).toBe(true)
    expect(r.data).toMatchObject({ lessor_full_name: null, signed_copies: 2, copies_per_party: 1 })
  })

  it('converts empty strings to null', () => {
    const r = buildingContractProfileSchema.safeParse({ lessor_full_name: '  ', lessor_id_number: '' })
    expect(r.data).toMatchObject({ lessor_full_name: null, lessor_id_number: null })
  })

  it.each(['12345', '0123456789012', '01234567890A'])('rejects id number %s without echoing it', (bad) => {
    const r = buildingContractProfileSchema.safeParse({ lessor_id_number: bad })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error!.issues)).not.toContain(bad)
  })

  it('accepts 9-digit legacy CMND', () => {
    expect(buildingContractProfileSchema.safeParse({ lessor_id_number: '123456789' }).success).toBe(true)
  })

  it('rejects id issued date in the future', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    expect(buildingContractProfileSchema.safeParse({ lessor_id_issued_date: tomorrow }).success).toBe(false)
  })

  it('enforces copies_per_party * 2 <= signed_copies', () => {
    const r = buildingContractProfileSchema.safeParse({ signed_copies: 1, copies_per_party: 1 })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]!.path).toEqual(['copies_per_party'])
  })

  it.each([
    ['default_term_months', 0], ['default_term_months', 61], ['default_deposit_months', 6.5],
    ['notice_days', 181], ['deposit_refund_days', 91], ['renewal_months', 25], ['drilling_fee', -1],
  ])('rejects %s = %s', (field, value) => {
    expect(buildingContractProfileSchema.safeParse({ [field]: value }).success).toBe(false)
  })
})
```

```ts
// tests/utils/building-contract-profile-mapper.test.ts
import { describe, expect, it } from 'vitest'
import { mapBuildingContractProfile, maskBuildingContractProfile, maskIdNumber } from '~/utils/mappers/building-contract-profile'

const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi, Huế', lessor_id_number: '012345678901', lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', brand_name: null, default_term_months: 12,
  default_deposit_months: '1.5', notice_days: 30, deposit_refund_days: 7, renewal_months: 6,
  extra_occupant_fee: '500000', drilling_fee: '50000', fingerprint_reset_fee: '100000', signed_copies: 2,
  copies_per_party: 1, updated_by: 'u-1', created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}

describe('building contract profile mapper', () => {
  it('maps numeric strings to numbers', () => {
    const p = mapBuildingContractProfile(row)
    expect(p).toMatchObject({ defaultDepositMonths: 1.5, extraOccupantFee: 500000, lessorIdentityMasked: false })
  })

  it('masks id to last 4 digits', () => {
    expect(maskIdNumber('012345678901')).toBe('*******8901')
    expect(maskIdNumber(null)).toBeNull()
  })

  it('masked profile contains no raw PII', () => {
    const masked = maskBuildingContractProfile(mapBuildingContractProfile(row))
    const json = JSON.stringify(masked)
    expect(json).not.toContain('012345678901')
    expect(json).not.toContain('1980-01-02')
    expect(json).not.toContain('Lê Lợi')
    expect(masked).toMatchObject({ lessorIdentityMasked: true, lessorIdNumber: '*******8901', lessorDateOfBirth: null, lessorPermanentAddress: null })
  })
})
```

- [x] **Step 2: Run to verify failure** — `npx vitest run tests/utils/building-contract-profile-validator.test.ts tests/utils/building-contract-profile-mapper.test.ts` → FAIL (modules missing).

- [x] **Step 3: Implement the types file** exactly as in **Interfaces** above.

- [x] **Step 4: Implement the mapper**

```ts
// app/utils/mappers/building-contract-profile.ts
import type { BuildingContractProfile } from '~/types/building-contract-profile'

export interface BuildingContractProfileRow {
  building_id: string
  lessor_full_name: string | null
  lessor_date_of_birth: string | null
  lessor_permanent_address: string | null
  lessor_id_number: string | null
  lessor_id_issued_date: string | null
  lessor_id_issued_place: string | null
  lessor_phone: string | null
  brand_name: string | null
  default_term_months: number | null
  default_deposit_months: number | string | null
  notice_days: number | null
  deposit_refund_days: number | null
  renewal_months: number | null
  extra_occupant_fee: number | string | null
  drilling_fee: number | string | null
  fingerprint_reset_fee: number | string | null
  signed_copies: number
  copies_per_party: number
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

const num = (value: number | string | null): number | null => (value === null ? null : Number(value))

export function mapBuildingContractProfile(row: BuildingContractProfileRow): BuildingContractProfile {
  return {
    buildingId: row.building_id,
    lessorFullName: row.lessor_full_name,
    lessorDateOfBirth: row.lessor_date_of_birth,
    lessorPermanentAddress: row.lessor_permanent_address,
    lessorIdNumber: row.lessor_id_number,
    lessorIdIssuedDate: row.lessor_id_issued_date,
    lessorIdIssuedPlace: row.lessor_id_issued_place,
    lessorPhone: row.lessor_phone,
    lessorIdentityMasked: false,
    brandName: row.brand_name,
    defaultTermMonths: row.default_term_months,
    defaultDepositMonths: num(row.default_deposit_months),
    noticeDays: row.notice_days,
    depositRefundDays: row.deposit_refund_days,
    renewalMonths: row.renewal_months,
    extraOccupantFee: num(row.extra_occupant_fee),
    drillingFee: num(row.drilling_fee),
    fingerprintResetFee: num(row.fingerprint_reset_fee),
    signedCopies: row.signed_copies,
    copiesPerParty: row.copies_per_party,
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by,
  }
}

export function maskIdNumber(value: string | null): string | null {
  if (!value) return null
  return `*******${value.slice(-4)}`
}

export function maskBuildingContractProfile(profile: BuildingContractProfile): BuildingContractProfile {
  return {
    ...profile,
    lessorIdNumber: maskIdNumber(profile.lessorIdNumber),
    lessorDateOfBirth: null,
    lessorPermanentAddress: null,
    lessorIdentityMasked: true,
  }
}
```

- [x] **Step 5: Implement the validator**

```ts
// app/utils/validators/building-contract-profile.ts
import { z } from 'zod'
import { normalizeTenantPhone, TENANT_PHONE_INVALID_MESSAGE } from '~/utils/tenant-identity'

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

const optionalText = (min: number, max: number, label: string) =>
  z.preprocess(blankToNull, z.string().trim().min(min, `${label} quá ngắn`).max(max, `${label} quá dài`).nullable().default(null))

const optionalDate = z.preprocess(
  blankToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ').nullable().default(null),
)

const optionalInt = (min: number, max: number) =>
  z.preprocess(blankToNull, z.number().int('Phải là số nguyên').min(min, `Tối thiểu ${min}`).max(max, `Tối đa ${max}`).nullable().default(null))

const optionalMoney = z.preprocess(blankToNull, z.number().int('Phải là số nguyên').min(0, 'Không được âm').nullable().default(null))

export const CONTRACT_PROFILE_PII_FIELDS = ['lessor_date_of_birth', 'lessor_permanent_address', 'lessor_id_number'] as const

export const buildingContractProfileSchema = z.object({
  lessor_full_name: optionalText(2, 100, 'Họ tên'),
  lessor_date_of_birth: optionalDate,
  lessor_permanent_address: optionalText(1, 255, 'Địa chỉ'),
  lessor_id_number: z.preprocess(
    value => (typeof value === 'string' ? value.replace(/\s/g, '') : value),
    z.preprocess(blankToNull, z.string().regex(/^\d{9}(\d{3})?$/, 'Số CMND/CCCD phải gồm 9 hoặc 12 chữ số').nullable().default(null)),
  ),
  lessor_id_issued_date: optionalDate.refine(
    value => value === null || value <= new Date().toISOString().slice(0, 10),
    'Ngày cấp không được ở tương lai',
  ),
  lessor_id_issued_place: optionalText(1, 150, 'Nơi cấp'),
  lessor_phone: z.preprocess(blankToNull, z.string().max(20, 'Số điện thoại quá dài').nullable().default(null))
    .transform((value, ctx) => {
      if (value === null) return null
      const normalized = normalizeTenantPhone(value)
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: TENANT_PHONE_INVALID_MESSAGE })
        return z.NEVER
      }
      return normalized
    }),
  brand_name: optionalText(1, 100, 'Tên thương hiệu'),
  default_term_months: optionalInt(1, 60),
  default_deposit_months: z.preprocess(
    blankToNull,
    z.number().min(0, 'Tối thiểu 0').max(6, 'Tối đa 6')
      .refine(value => Number.isInteger(value * 10), 'Tối đa 1 chữ số thập phân')
      .nullable().default(null),
  ),
  notice_days: optionalInt(0, 180),
  deposit_refund_days: optionalInt(0, 90),
  renewal_months: optionalInt(0, 24),
  extra_occupant_fee: optionalMoney,
  drilling_fee: optionalMoney,
  fingerprint_reset_fee: optionalMoney,
  signed_copies: z.number().int().min(1, 'Tối thiểu 1').max(10, 'Tối đa 10').default(2),
  copies_per_party: z.number().int().min(1, 'Tối thiểu 1').max(5, 'Tối đa 5').default(1),
}).superRefine((value, ctx) => {
  if (value.copies_per_party * 2 > value.signed_copies) {
    ctx.addIssue({ code: 'custom', path: ['copies_per_party'], message: 'Tổng số bản hai bên giữ vượt quá số bản ký' })
  }
})

export type BuildingContractProfileInput = z.infer<typeof buildingContractProfileSchema>
```

- [x] **Step 6: Run tests** — both files PASS.

- [x] **Step 7: Commit**

```bash
git add app/types/building-contract-profile.ts app/utils/mappers/building-contract-profile.ts app/utils/validators/building-contract-profile.ts tests/utils/building-contract-profile-*.test.ts
git commit -m "feat(buildings): add contract profile DTO, mapper and validator"
```

---

### Task 3: Readiness pure function

**Files:**
- Create: `server/services/buildings/readiness.ts`
- Test: `tests/server/buildings/readiness.test.ts`

**Interfaces:**
- Consumes: `Building` (`~/types/buildings`), `BuildingContractProfile`, `BuildingReadiness`, `ReadinessCode` (Task 2).
- Produces:
  ```ts
  export function computeBuildingReadiness(
    building: Pick<Building, 'billingGenerationDay' | 'paymentDueDay' | 'electricityPricingType' | 'defaultElectricityRate' | 'waterPricingType' | 'defaultWaterRate'>,
    contractProfile: BuildingContractProfile | null,
    hasInvoiceProfile: boolean,
  ): BuildingReadiness
  ```
  Uses the profile's presence of values only; masked profiles still count as filled (`lessorIdNumber` masked is non-null; `lessorDateOfBirth`/`lessorPermanentAddress` masked are null — so the service MUST compute readiness from the **unmasked** profile, see Task 4).

- [x] **Step 1: Write the failing test**

```ts
// tests/server/buildings/readiness.test.ts
import { describe, expect, it } from 'vitest'
import { computeBuildingReadiness } from '../../../server/services/buildings/readiness'
import type { BuildingContractProfile } from '~/types/building-contract-profile'

const building = {
  billingGenerationDay: 1, paymentDueDay: 5,
  electricityPricingType: 'per_kwh', defaultElectricityRate: 3500,
  waterPricingType: 'per_m3', defaultWaterRate: 15000,
} as const

const profile: BuildingContractProfile = {
  buildingId: 'b-1', lessorFullName: 'A', lessorDateOfBirth: '1980-01-01', lessorPermanentAddress: 'X',
  lessorIdNumber: '012345678901', lessorIdIssuedDate: '2020-01-01', lessorIdIssuedPlace: 'Y', lessorPhone: '0901234567',
  lessorIdentityMasked: false, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 1, noticeDays: 30,
  depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0,
  signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null,
}

describe('computeBuildingReadiness', () => {
  it('is fully ready when everything is configured (zero values count as set)', () => {
    expect(computeBuildingReadiness(building as never, profile, true)).toEqual({
      contract: { ready: true, missing: [] },
      billing: { ready: true, missing: [] },
    })
  })

  it('lists every contract code when the profile is missing', () => {
    const r = computeBuildingReadiness(building as never, null, true)
    expect(r.contract.ready).toBe(false)
    expect(r.contract.missing).toEqual([
      'lessor.full_name', 'lessor.date_of_birth', 'lessor.permanent_address', 'lessor.id_number',
      'lessor.id_issued_date', 'lessor.id_issued_place', 'lessor.phone',
      'contract.default_term_months', 'contract.default_deposit_months',
      'terms.notice_days', 'terms.deposit_refund_days', 'terms.renewal_months',
      'terms.extra_occupant_fee', 'terms.drilling_fee', 'terms.fingerprint_reset_fee',
    ])
    expect(r.billing.ready).toBe(true)
  })

  it('missing invoice profile blocks both', () => {
    const r = computeBuildingReadiness(building as never, profile, false)
    expect(r.contract.missing).toEqual(['invoice_profile'])
    expect(r.billing.missing).toEqual(['invoice_profile'])
  })

  it('missing schedule blocks both with billing.schedule', () => {
    const r = computeBuildingReadiness({ ...building, paymentDueDay: null } as never, profile, true)
    expect(r.contract.missing).toContain('billing.schedule')
    expect(r.billing.missing).toContain('billing.schedule')
  })

  it('requires utility rates except for tiered electricity', () => {
    const r = computeBuildingReadiness({ ...building, defaultElectricityRate: null, defaultWaterRate: null } as never, profile, true)
    expect(r.billing.missing).toEqual(['billing.electricity_rate', 'billing.water_rate'])
    expect(r.contract.ready).toBe(true)
    const tiered = computeBuildingReadiness({ ...building, electricityPricingType: 'tiered', defaultElectricityRate: null } as never, profile, true)
    expect(tiered.billing.missing).not.toContain('billing.electricity_rate')
  })
})
```

- [x] **Step 2: Run to verify failure** — FAIL (module missing).

- [x] **Step 3: Implement**

```ts
// server/services/buildings/readiness.ts
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile, BuildingReadiness, ReadinessCode } from '~/types/building-contract-profile'

type ReadinessBuilding = Pick<Building,
  'billingGenerationDay' | 'paymentDueDay' | 'electricityPricingType' | 'defaultElectricityRate' | 'waterPricingType' | 'defaultWaterRate'>

const CONTRACT_FIELDS: [ReadinessCode, keyof BuildingContractProfile][] = [
  ['lessor.full_name', 'lessorFullName'],
  ['lessor.date_of_birth', 'lessorDateOfBirth'],
  ['lessor.permanent_address', 'lessorPermanentAddress'],
  ['lessor.id_number', 'lessorIdNumber'],
  ['lessor.id_issued_date', 'lessorIdIssuedDate'],
  ['lessor.id_issued_place', 'lessorIdIssuedPlace'],
  ['lessor.phone', 'lessorPhone'],
  ['contract.default_term_months', 'defaultTermMonths'],
  ['contract.default_deposit_months', 'defaultDepositMonths'],
  ['terms.notice_days', 'noticeDays'],
  ['terms.deposit_refund_days', 'depositRefundDays'],
  ['terms.renewal_months', 'renewalMonths'],
  ['terms.extra_occupant_fee', 'extraOccupantFee'],
  ['terms.drilling_fee', 'drillingFee'],
  ['terms.fingerprint_reset_fee', 'fingerprintResetFee'],
]

const status = (missing: ReadinessCode[]) => ({ ready: missing.length === 0, missing })

export function computeBuildingReadiness(
  building: ReadinessBuilding,
  contractProfile: BuildingContractProfile | null,
  hasInvoiceProfile: boolean,
): BuildingReadiness {
  const contract: ReadinessCode[] = CONTRACT_FIELDS
    .filter(([, key]) => contractProfile?.[key] == null)
    .map(([code]) => code)
  const billing: ReadinessCode[] = []

  const hasSchedule = building.billingGenerationDay != null && building.paymentDueDay != null
  if (!hasSchedule) {
    contract.push('billing.schedule')
    billing.push('billing.schedule')
  }
  if (building.electricityPricingType !== 'tiered' && building.defaultElectricityRate == null) {
    billing.push('billing.electricity_rate')
  }
  if (building.defaultWaterRate == null) billing.push('billing.water_rate')
  if (!hasInvoiceProfile) {
    contract.push('invoice_profile')
    billing.push('invoice_profile')
  }
  return { contract: status(contract), billing: status(billing) }
}
```

Before implementing, confirm in `server/services/billing/rules.ts` which pricing types read `default_*_rate`; if `tiered` brackets live elsewhere and another type also doesn't use the rate, extend the exemption and the test accordingly.

- [x] **Step 4: Run test** → PASS.

- [x] **Step 5: Commit**

```bash
git add server/services/buildings/readiness.ts tests/server/buildings/readiness.test.ts
git commit -m "feat(buildings): compute contract and billing readiness"
```

---

### Task 4: Capabilities, audit action, repository, service

**Files:**
- Modify: `app/utils/constants/permissions.ts`
- Modify: `app/utils/constants/audit.ts`
- Create: `server/repositories/building-contract-profiles.ts`
- Create: `server/services/buildings/contract-profile.ts`
- Test: `tests/server/buildings/contract-profile-service.test.ts`

**Interfaces:**
- Consumes: Task 2 types/mapper/validator; Task 3 `computeBuildingReadiness`; `BuildingInvoiceProfileRepository.findByBuildingId`; `BuildingRepository.findByIdentifier`; `assertBuildingScope`; `AuditService.append`.
- Produces:
  ```ts
  BuildingContractProfileRepository.findByBuildingId(event, buildingId): Promise<BuildingContractProfileRow | null>
  BuildingContractProfileRepository.upsert(event, buildingId, input: BuildingContractProfileInput, actorId: string): Promise<BuildingContractProfileRow>

  BuildingContractProfileService.get(event, user, buildingIdentifier): Promise<BuildingContractProfile | null>
  BuildingContractProfileService.save(event, user, buildingIdentifier, input: BuildingContractProfileInput): Promise<BuildingContractProfile>
  BuildingContractProfileService.readiness(event, user, buildingIdentifier): Promise<BuildingReadiness>
  // Server-only, used by PR4; never returned to clients.
  BuildingContractProfileService.getUnmaskedForServer(event, buildingId): Promise<BuildingContractProfile | null>
  ```
  `AUDIT_ACTIONS.BUILDING_CONTRACT_PROFILE_UPDATED = 'building.contract_profile.updated'`

- [x] **Step 1: Write the failing service test**

```ts
// tests/server/buildings/contract-profile-service.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findBuilding = vi.fn()
const findProfile = vi.fn()
const upsertProfile = vi.fn()
const findInvoiceProfile = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: findBuilding } }))
vi.mock('../../../server/repositories/building-contract-profiles', () => ({
  BuildingContractProfileRepository: { findByBuildingId: findProfile, upsert: upsertProfile },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { findByBuildingId: findInvoiceProfile },
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const RAW_ID = '012345678901'
const building = {
  id: 'b-1', billingGenerationDay: 1, paymentDueDay: 5, electricityPricingType: 'per_kwh',
  defaultElectricityRate: 3500, waterPricingType: 'per_m3', defaultWaterRate: 15000,
}
const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi, Huế', lessor_id_number: RAW_ID, lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', brand_name: null, default_term_months: 12,
  default_deposit_months: 1, notice_days: 30, deposit_refund_days: 7, renewal_months: 0, extra_occupant_fee: 0,
  drilling_fee: 0, fingerprint_reset_fee: 0, signed_copies: 2, copies_per_party: 1, updated_by: 'o-1',
  created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-11T00:00:00Z',
}
const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (user: AuthUser, cap: string) => {
    const role = String(user.app_metadata?.role)
    if (cap === 'building-contract-profile.read') return ['admin', 'owner', 'manager'].includes(role)
    return ['admin', 'owner'].includes(role)
  })
  findBuilding.mockResolvedValue(building)
  assertBuildingScope.mockResolvedValue(undefined)
  findProfile.mockResolvedValue(row)
  findInvoiceProfile.mockResolvedValue({ building_id: 'b-1' })
})

describe('BuildingContractProfileService.get', () => {
  it('returns full data to owner', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const res = await BuildingContractProfileService.get(ev(), owner, 'b-1')
    expect(res).toMatchObject({ lessorIdNumber: RAW_ID, lessorIdentityMasked: false })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'read')
  })

  it('never sends raw PII to a manager', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const res = await BuildingContractProfileService.get(ev(), manager, 'b-1')
    const json = JSON.stringify(res)
    expect(json).not.toContain(RAW_ID)
    expect(json).not.toContain('1980-01-02')
    expect(json).not.toContain('Lê Lợi')
    expect(res).toMatchObject({ lessorIdentityMasked: true, lessorIdNumber: '*******8901' })
  })

  it('checks scope before reading the profile', async () => {
    assertBuildingScope.mockRejectedValue(Object.assign(new Error('not found'), { statusCode: 404 }))
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.get(ev(), owner, 'b-1')).rejects.toMatchObject({ statusCode: 404 })
    expect(findProfile).not.toHaveBeenCalled()
  })
})

describe('BuildingContractProfileService.save', () => {
  it('forbids managers', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.save(ev(), manager, 'b-1', {} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('upserts and audits only changed field names', async () => {
    upsertProfile.mockResolvedValue({ ...row, lessor_id_number: '987654321' })
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const { buildingContractProfileSchema } = await import('~/utils/validators/building-contract-profile')
    const input = buildingContractProfileSchema.parse({
      ...Object.fromEntries(Object.entries(row).filter(([k]) => !['building_id', 'updated_by', 'created_at', 'updated_at'].includes(k))),
      lessor_id_number: '987654321',
    })

    await BuildingContractProfileService.save(ev(), owner, 'b-1', input)

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
    expect(upsertProfile).toHaveBeenCalledWith(expect.anything(), 'b-1', input, 'o-1')
    const audit = appendAudit.mock.calls[0]![2]
    expect(audit).toMatchObject({ action: 'building.contract_profile.updated', metadata: { changed_fields: ['lessor_id_number'] } })
    expect(audit.before_data).toBeUndefined()
    expect(audit.after_data).toBeUndefined()
    expect(JSON.stringify(audit)).not.toContain('987654321')
    expect(JSON.stringify(audit)).not.toContain(RAW_ID)
  })
})

describe('BuildingContractProfileService.readiness', () => {
  it('uses unmasked data even for managers', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    const r = await BuildingContractProfileService.readiness(ev(), manager, 'b-1')
    expect(r.contract.ready).toBe(true)
  })
})
```

- [x] **Step 2: Run to verify failure** — FAIL.

- [x] **Step 3: Capabilities and audit constant**

In `app/utils/constants/permissions.ts`, inside `OWNER_CAPABILITIES` right after `'building-invoice-profile.write',` add:

```ts
  'building-contract-profile.read',
  'building-contract-profile.write',
  // Full lessor identity (CCCD, date of birth, address); managers only see a masked view.
  'building-contract-profile.pii.read',
```

In the `[ROLES.MANAGER]` list, after `'building-invoice-profile.read',` add `'building-contract-profile.read',`.

In `app/utils/constants/audit.ts`, after `BUILDING_INVOICE_EMAIL_SETTINGS_UPDATED` add:

```ts
  BUILDING_CONTRACT_PROFILE_UPDATED: 'building.contract_profile.updated',
```

If there is a permissions snapshot test (e.g. `tests/**/permissions*.test.ts`), update it in this step.

- [x] **Step 4: Repository**

```ts
// server/repositories/building-contract-profiles.ts
import type { H3Event } from 'h3'
import { db } from '../utils/db'
import type { BuildingContractProfileRow } from '~/utils/mappers/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'

// Cast at the boundary until database.types.ts is regenerated after the cloud migration.
const table = (event: H3Event) => db(event).from('building_contract_profiles' as never)

export const BuildingContractProfileRepository = {
  async findByBuildingId(event: H3Event, buildingId: string): Promise<BuildingContractProfileRow | null> {
    const { data, error } = await table(event).select('*').eq('building_id', buildingId).maybeSingle()
    if (error) throwDbError(error, 'buildingContractProfile.findByBuildingId')
    return data as BuildingContractProfileRow | null
  },

  async upsert(
    event: H3Event,
    buildingId: string,
    input: BuildingContractProfileInput,
    actorId: string,
  ): Promise<BuildingContractProfileRow> {
    const { data, error } = await table(event)
      .upsert({ building_id: buildingId, ...input, updated_by: actorId } as never, { onConflict: 'building_id' })
      .select('*')
      .single()
    if (error) throwDbError(error, 'buildingContractProfile.upsert')
    return data as BuildingContractProfileRow
  },
}
```

`throwDbError` logs via `throwInternal`; confirm `server/utils/errors.ts` `throwInternal` does not log `details` containing row values. If it logs `error.details`/`error.message` from Postgres check violations, those messages contain the failing row for `23514` ("Failing row contains (...)"). Mitigation in this step: catch `error.code === '23514'` before `throwDbError` and call `throwValidationError('Thông tin hợp đồng không hợp lệ')` without passing the error object.

- [x] **Step 5: Service**

```ts
// server/services/buildings/contract-profile.ts
import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingContractProfile, BuildingReadiness } from '~/types/building-contract-profile'
import { mapBuildingContractProfile, maskBuildingContractProfile, type BuildingContractProfileRow } from '~/utils/mappers/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingContractProfileRepository } from '../../repositories/building-contract-profiles'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { assertBuildingScope } from '../../utils/scope'
import { AuditService } from '../audit'
import { computeBuildingReadiness } from './readiness'

const EDITABLE_COLUMNS: (keyof BuildingContractProfileInput)[] = [
  'lessor_full_name', 'lessor_date_of_birth', 'lessor_permanent_address', 'lessor_id_number',
  'lessor_id_issued_date', 'lessor_id_issued_place', 'lessor_phone', 'brand_name',
  'default_term_months', 'default_deposit_months', 'notice_days', 'deposit_refund_days', 'renewal_months',
  'extra_occupant_fee', 'drilling_fee', 'fingerprint_reset_fee', 'signed_copies', 'copies_per_party',
]

async function requireBuilding(event: H3Event, identifier: string) {
  const building = await BuildingRepository.findByIdentifier(event, identifier)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  return building
}

function changedFields(before: BuildingContractProfileRow | null, after: BuildingContractProfileInput): string[] {
  return EDITABLE_COLUMNS.filter((key) => {
    const prev = before?.[key as keyof BuildingContractProfileRow] ?? null
    const next = after[key] ?? null
    return String(prev) !== String(next)
  })
}

function present(user: AuthUser, profile: BuildingContractProfile | null) {
  if (!profile) return null
  return can(user, 'building-contract-profile.pii.read') ? profile : maskBuildingContractProfile(profile)
}

export const BuildingContractProfileService = {
  async get(event: H3Event, user: AuthUser, buildingIdentifier: string): Promise<BuildingContractProfile | null> {
    if (!can(user, 'building-contract-profile.read')) throwForbidden('Không có quyền xem thông tin hợp đồng của tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    const row = await BuildingContractProfileRepository.findByBuildingId(event, building.id)
    return present(user, row ? mapBuildingContractProfile(row) : null)
  },

  async save(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    input: BuildingContractProfileInput,
  ): Promise<BuildingContractProfile> {
    if (!can(user, 'building-contract-profile.write')) throwForbidden('Không có quyền cập nhật thông tin hợp đồng của tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const existing = await BuildingContractProfileRepository.findByBuildingId(event, building.id)
    const saved = await BuildingContractProfileRepository.upsert(event, building.id, input, user.id)

    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.BUILDING_CONTRACT_PROFILE_UPDATED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { changed_fields: changedFields(existing, input) },
    })
    return present(user, mapBuildingContractProfile(saved))!
  },

  async readiness(event: H3Event, user: AuthUser, buildingIdentifier: string): Promise<BuildingReadiness> {
    if (!can(user, 'buildings.read')) throwForbidden('Không có quyền xem tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    const [row, invoiceProfile] = await Promise.all([
      BuildingContractProfileRepository.findByBuildingId(event, building.id),
      BuildingInvoiceProfileRepository.findByBuildingId(event, building.id),
    ])
    return computeBuildingReadiness(building, row ? mapBuildingContractProfile(row) : null, Boolean(invoiceProfile))
  },

  async getUnmaskedForServer(event: H3Event, buildingId: string): Promise<BuildingContractProfile | null> {
    const row = await BuildingContractProfileRepository.findByBuildingId(event, buildingId)
    return row ? mapBuildingContractProfile(row) : null
  },
}
```

`entity_type: 'building'` must be a valid `AuditEntityType`; it is (used by invoice profile).

- [x] **Step 6: Run tests** — `npx vitest run tests/server/buildings/contract-profile-service.test.ts` → PASS.

- [x] **Step 7: Commit**

```bash
git add app/utils/constants/permissions.ts app/utils/constants/audit.ts server/repositories/building-contract-profiles.ts server/services/buildings/contract-profile.ts tests/server/buildings/contract-profile-service.test.ts
git commit -m "feat(buildings): contract profile service with PII masking"
```

---

### Task 5: API routes

**Files:**
- Create: `server/api/buildings/[id]/contract-profile/index.get.ts`
- Create: `server/api/buildings/[id]/contract-profile/index.put.ts`
- Create: `server/api/buildings/[id]/readiness.get.ts`
- Test: `tests/server/buildings/contract-profile-api.test.ts`

**Interfaces:**
- `GET /api/buildings/[id]/contract-profile` → `{ data: BuildingContractProfile | null }`
- `PUT /api/buildings/[id]/contract-profile` (JSON body, snake_case per validator) → `{ data: BuildingContractProfile }`
- `GET /api/buildings/[id]/readiness` → `{ data: BuildingReadiness }`

- [x] **Step 1: Write the failing test**

```ts
// tests/server/buildings/contract-profile-api.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(), getRouterParam: vi.fn(), readBody: vi.fn(),
  get: vi.fn(), save: vi.fn(), readiness: vi.fn(),
}))

vi.mock('../../../server/services/buildings/contract-profile', () => ({
  BuildingContractProfileService: { get: mocks.get, save: mocks.save, readiness: mocks.readiness },
}))
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('requireAuth', mocks.requireAuth)
vi.stubGlobal('getRouterParam', mocks.getRouterParam)
vi.stubGlobal('readBody', mocks.readBody)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuth.mockResolvedValue({ id: 'o-1', app_metadata: { role: 'owner' } })
  mocks.getRouterParam.mockReturnValue('zeno')
})

describe('contract profile API', () => {
  it('GET wraps the nullable profile', async () => {
    mocks.get.mockResolvedValue(null)
    const { default: handler } = await import('../../../server/api/buildings/[id]/contract-profile/index.get')
    await expect(handler({} as never)).resolves.toEqual({ data: null })
    expect(mocks.get).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'zeno')
  })

  it('PUT validates and forwards parsed input', async () => {
    mocks.readBody.mockResolvedValue({ lessor_full_name: 'Nguyễn Văn A', lessor_phone: '0901 234 567' })
    mocks.save.mockResolvedValue({ buildingId: 'b-1' })
    const { default: handler } = await import('../../../server/api/buildings/[id]/contract-profile/index.put')
    await handler({ context: {} } as never)
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'zeno',
      expect.objectContaining({ lessor_full_name: 'Nguyễn Văn A', lessor_phone: '0901234567', signed_copies: 2 }))
  })

  it('PUT rejects invalid id number with 422 and without echo', async () => {
    mocks.readBody.mockResolvedValue({ lessor_id_number: '12AB' })
    const { default: handler } = await import('../../../server/api/buildings/[id]/contract-profile/index.put')
    try {
      await handler({ context: {} } as never)
      throw new Error('expected 422')
    }
    catch (e) {
      expect(e).toMatchObject({ statusCode: 422 })
      expect(JSON.stringify(e)).not.toContain('12AB')
    }
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('GET readiness wraps the result', async () => {
    mocks.readiness.mockResolvedValue({ contract: { ready: false, missing: ['invoice_profile'] }, billing: { ready: true, missing: [] } })
    const { default: handler } = await import('../../../server/api/buildings/[id]/readiness.get')
    await expect(handler({} as never)).resolves.toMatchObject({ data: { contract: { ready: false } } })
  })
})
```

Check how `parseBody` builds its 422 details (`server/utils/**`). If it includes `received` values from Zod issues, the "no echo" assertion will fail; in that case use `safeParse` in the route and call `throwValidationError('Thông tin hợp đồng không hợp lệ', result.error.flatten().fieldErrors)` (field errors contain only messages).

- [x] **Step 2: Run to verify failure** — FAIL.

- [x] **Step 3: Implement routes**

```ts
// server/api/buildings/[id]/contract-profile/index.get.ts
import { BuildingContractProfileService } from '../../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await BuildingContractProfileService.get(event, user, id) }
})
```

```ts
// server/api/buildings/[id]/contract-profile/index.put.ts
import { buildingContractProfileSchema } from '~/utils/validators/building-contract-profile'
import { BuildingContractProfileService } from '../../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = buildingContractProfileSchema.safeParse(await readBody(event))
  if (!result.success) {
    throwValidationError('Thông tin hợp đồng không hợp lệ', result.error.flatten().fieldErrors)
  }
  return { data: await BuildingContractProfileService.save(event, user, id, result.data) }
})
```

```ts
// server/api/buildings/[id]/readiness.get.ts
import { BuildingContractProfileService } from '../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await BuildingContractProfileService.readiness(event, user, id) }
})
```

If `throwValidationError` is not stubbed globally in tests, add `vi.stubGlobal('throwValidationError', …)` like `invoice-profile-api.test.ts`.

- [x] **Step 4: Run tests** → PASS. Run `node scripts/generate-api-inventory.mjs` and include `docs/api-inventory.md` if changed.

- [x] **Step 5: Commit**

```bash
git add server/api/buildings/[id]/contract-profile server/api/buildings/[id]/readiness.get.ts tests/server/buildings/contract-profile-api.test.ts docs/api-inventory.md
git commit -m "feat(api): building contract profile and readiness endpoints"
```

---

### Task 6: Settings bootstrap

**Files:**
- Modify: `app/types/building-settings.ts`
- Modify: `server/services/buildings/settings-bootstrap.ts`
- Test: existing settings-bootstrap test (find with `grep -rl "BuildingSettingsBootstrapService" tests`), or create `tests/server/buildings/settings-bootstrap-contract-profile.test.ts`

**Interfaces:**
- `BuildingSettingsBootstrap` gains `contractProfile: BuildingContractProfile | null` and `readiness: BuildingReadiness`.

- [x] **Step 1: Write failing tests** (in the existing bootstrap test file, add mocks for `BuildingContractProfileService.get` and `.readiness`):

```ts
it('includes contract profile and readiness', async () => {
  contractProfileGet.mockResolvedValue({ buildingId: 'b-1', lessorIdNumber: '*******8901', lessorIdentityMasked: true })
  contractReadiness.mockResolvedValue({ contract: { ready: false, missing: ['invoice_profile'] }, billing: { ready: true, missing: [] } })
  const result = await BuildingSettingsBootstrapService.get(event, manager, 'b-1')
  expect(result.contractProfile).toMatchObject({ lessorIdentityMasked: true })
  expect(result.readiness.contract.ready).toBe(false)
  expect(JSON.stringify(result)).not.toContain('012345678901')
})

it('skips the profile when the role cannot read it', async () => {
  vi.stubGlobal('can', () => false)
  // keep the other mocked services resolving as in the file's existing setup
  const result = await BuildingSettingsBootstrapService.get(event, someoneWithoutCap, 'b-1')
  expect(contractProfileGet).not.toHaveBeenCalled()
  expect(result.contractProfile).toBeNull()
})
```

Adapt variable names to the existing file's mocks.

- [x] **Step 2: Run to verify failure.**

- [x] **Step 3: Implement**

In `app/types/building-settings.ts` import `BuildingContractProfile, BuildingReadiness` from `./building-contract-profile` and add:

```ts
  contractProfile: BuildingContractProfile | null
  readiness: BuildingReadiness
```

In `server/services/buildings/settings-bootstrap.ts`, import `BuildingContractProfileService` and extend the `Promise.all` tuple with:

```ts
      can(user, 'building-contract-profile.read')
        ? BuildingContractProfileService.get(event, user, buildingId)
        : Promise.resolve(null),
      BuildingContractProfileService.readiness(event, user, buildingId),
```

destructure as `contractProfile, readiness` and add both to the returned object.

- [x] **Step 4: Run tests** → PASS.

- [x] **Step 5: Commit**

```bash
git add app/types/building-settings.ts server/services/buildings/settings-bootstrap.ts tests/server/buildings
git commit -m "feat(buildings): include contract profile and readiness in settings bootstrap"
```

---

### Task 7: Client composable + payment-window formatter

**Files:**
- Create: `app/composables/buildings/useBuildingContractProfile.ts`
- Create: `app/utils/format/payment-window.ts`
- Create: `app/utils/constants/readiness.ts`
- Test: `tests/utils/payment-window.test.ts`, `tests/composables/useBuildingContractProfile.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useBuildingContractProfile(buildingIdentifier: MaybeRef<string>, source: {
    data: Readonly<Ref<BuildingContractProfile | null>>
    set: (profile: BuildingContractProfile) => void
    onSaved?: () => Promise<unknown>   // refresh readiness
  }): { profile, saving: Ref<boolean>, error: Ref<string | null>, save(input: BuildingContractProfileInput): Promise<BuildingContractProfile> }

  export interface PaymentWindow { startDay: number; endDay: number; graceDays: number; overdueDay: number | null; sentence: string }
  export function formatPaymentWindow(building: { billingGenerationDay: number | null; paymentDueDay: number | null; gracePeriodDays: number }): PaymentWindow | null

  export const READINESS_LABELS: Record<ReadinessCode, { label: string; anchor: string }>
  ```

- [x] **Step 1: Write failing tests**

```ts
// tests/utils/payment-window.test.ts
import { describe, expect, it } from 'vitest'
import { formatPaymentWindow } from '~/utils/format/payment-window'

describe('formatPaymentWindow', () => {
  it('builds the contract sentence', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 })).toEqual({
      startDay: 1, endDay: 5, graceDays: 5, overdueDay: 10,
      sentence: 'Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 10 không thanh toán, Bên A có quyền chấm dứt hợp đồng.',
    })
  })

  it('uses the due day when there is no grace period', () => {
    expect(formatPaymentWindow({ billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 0 })!.overdueDay).toBe(5)
  })

  it('does not print an impossible day past 31', () => {
    const w = formatPaymentWindow({ billingGenerationDay: 25, paymentDueDay: 28, gracePeriodDays: 5 })!
    expect(w.overdueDay).toBeNull()
    expect(w.sentence).toBe('Thanh toán từ ngày 25 đến ngày 28 hằng tháng; quá 5 ngày sau hạn thanh toán, Bên A có quyền chấm dứt hợp đồng.')
  })

  it('returns null when schedule is incomplete', () => {
    expect(formatPaymentWindow({ billingGenerationDay: null, paymentDueDay: 5, gracePeriodDays: 0 })).toBeNull()
  })
})
```

```ts
// tests/composables/useBuildingContractProfile.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => vi.clearAllMocks())

describe('useBuildingContractProfile', () => {
  it('PUTs JSON, updates the source and refreshes readiness', async () => {
    fetchMock.mockResolvedValue({ data: { buildingId: 'b-1' } })
    const set = vi.fn()
    const onSaved = vi.fn(async () => {})
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const { save } = useBuildingContractProfile('zeno', { data: ref(null), set, onSaved })

    await save({ lessor_full_name: 'A' } as never)

    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/zeno/contract-profile', expect.objectContaining({ method: 'PUT', body: { lessor_full_name: 'A' } }))
    expect(set).toHaveBeenCalledWith({ buildingId: 'b-1' })
    expect(onSaved).toHaveBeenCalled()
  })

  it('exposes a standardized error and rethrows', async () => {
    fetchMock.mockRejectedValue({ data: { error: { message: 'Không có quyền' } } })
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const { save, error } = useBuildingContractProfile('zeno', { data: ref(null), set: vi.fn() })
    await expect(save({} as never)).rejects.toBeTruthy()
    expect(error.value).toBeTruthy()
  })
})
```

If `apiFetch` does not call `$fetch(url, opts)` directly, adapt the assertion to how `tests/composables/buildings.test.ts` asserts calls.

- [x] **Step 2: Run to verify failure.**

- [x] **Step 3: Implement**

```ts
// app/utils/format/payment-window.ts
export interface PaymentWindow {
  startDay: number
  endDay: number
  graceDays: number
  overdueDay: number | null
  sentence: string
}

export function formatPaymentWindow(building: {
  billingGenerationDay: number | null
  paymentDueDay: number | null
  gracePeriodDays: number
}): PaymentWindow | null {
  const { billingGenerationDay: startDay, paymentDueDay: endDay } = building
  if (startDay == null || endDay == null) return null
  const graceDays = building.gracePeriodDays ?? 0
  const candidate = endDay + graceDays
  const overdueDay = candidate <= 31 ? candidate : null
  const tail = overdueDay !== null
    ? `sau ngày ${overdueDay} không thanh toán, Bên A có quyền chấm dứt hợp đồng.`
    : `quá ${graceDays} ngày sau hạn thanh toán, Bên A có quyền chấm dứt hợp đồng.`
  return {
    startDay,
    endDay,
    graceDays,
    overdueDay,
    sentence: `Thanh toán từ ngày ${startDay} đến ngày ${endDay} hằng tháng; ${tail}`,
  }
}
```

```ts
// app/utils/constants/readiness.ts
import type { ReadinessCode } from '~/types/building-contract-profile'

export const READINESS_LABELS: Record<ReadinessCode, { label: string; anchor: string }> = {
  'lessor.full_name': { label: 'Họ tên bên cho thuê', anchor: 'contract-profile' },
  'lessor.date_of_birth': { label: 'Ngày sinh bên cho thuê', anchor: 'contract-profile' },
  'lessor.permanent_address': { label: 'Địa chỉ thường trú bên cho thuê', anchor: 'contract-profile' },
  'lessor.id_number': { label: 'Số CMND/CCCD bên cho thuê', anchor: 'contract-profile' },
  'lessor.id_issued_date': { label: 'Ngày cấp CMND/CCCD', anchor: 'contract-profile' },
  'lessor.id_issued_place': { label: 'Nơi cấp CMND/CCCD', anchor: 'contract-profile' },
  'lessor.phone': { label: 'Số điện thoại bên cho thuê', anchor: 'contract-profile' },
  'contract.default_term_months': { label: 'Thời hạn hợp đồng mặc định', anchor: 'contract-profile' },
  'contract.default_deposit_months': { label: 'Số tháng cọc mặc định', anchor: 'contract-profile' },
  'terms.notice_days': { label: 'Số ngày báo trước', anchor: 'contract-profile' },
  'terms.deposit_refund_days': { label: 'Số ngày hoàn cọc', anchor: 'contract-profile' },
  'terms.renewal_months': { label: 'Số tháng tự gia hạn', anchor: 'contract-profile' },
  'terms.extra_occupant_fee': { label: 'Phí người ở vượt số đăng ký', anchor: 'contract-profile' },
  'terms.drilling_fee': { label: 'Phí khoan tường', anchor: 'contract-profile' },
  'terms.fingerprint_reset_fee': { label: 'Phí làm lại vân tay', anchor: 'contract-profile' },
  'billing.schedule': { label: 'Ngày phát hành hóa đơn và hạn thanh toán', anchor: 'edit' },
  'billing.electricity_rate': { label: 'Đơn giá điện', anchor: 'edit' },
  'billing.water_rate': { label: 'Đơn giá nước', anchor: 'edit' },
  invoice_profile: { label: 'Hồ sơ thanh toán trên hóa đơn', anchor: 'invoice-profile' },
}
```

`anchor: 'edit'` means "link to the building edit page" (`buildingEditPath(building)`); other anchors are `#id` on the settings page.

```ts
// app/composables/buildings/useBuildingContractProfile.ts
import type { ApiSuccess } from '~/types/api'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import type { BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { getApiErrorMessage } from '~/utils/api-error'

export function useBuildingContractProfile(
  buildingIdentifier: MaybeRef<string>,
  source: {
    data: Readonly<Ref<BuildingContractProfile | null>>
    set: (profile: BuildingContractProfile) => void
    onSaved?: () => Promise<unknown>
  },
) {
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function save(input: BuildingContractProfileInput): Promise<BuildingContractProfile> {
    error.value = null
    saving.value = true
    try {
      const response = await apiFetch<ApiSuccess<BuildingContractProfile>>(
        `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/contract-profile`,
        { method: 'PUT', body: input },
      )
      source.set(response.data)
      await source.onSaved?.()
      return response.data
    }
    catch (cause) {
      error.value = getApiErrorMessage(cause, 'Không thể lưu thông tin hợp đồng. Vui lòng thử lại.')
      throw cause
    }
    finally {
      saving.value = false
    }
  }

  return { profile: source.data, saving, error, save }
}
```

- [x] **Step 4: Run tests** → PASS.

- [x] **Step 5: Commit**

```bash
git add app/composables/buildings/useBuildingContractProfile.ts app/utils/format/payment-window.ts app/utils/constants/readiness.ts tests/utils/payment-window.test.ts tests/composables/useBuildingContractProfile.test.ts
git commit -m "feat(buildings): contract profile composable and payment window formatter"
```

---

### Task 8: Settings section UI (UI polish gate)

**Files:**
- Create: `app/components/buildings/BuildingContractProfileSettings.vue`
- Modify: `app/pages/dashboard/buildings/[id]/settings.vue`
- Test: `tests/pages/building-settings-contract-profile.spec.ts`, `tests/components/buildings/BuildingContractProfileSettings.test.ts`

**Interfaces:**
- Component props: `{ profile: BuildingContractProfile | null; building: Building; canEdit: boolean; saving: boolean; error: string | null; editPath: string }`
- Emits: `save: [input: BuildingContractProfileInput]`

- [x] **Step 1: UI polish workflow (no code yet)**

Read `.agents/skills/zeno-house/references/ui-polish-workflow.md`; apply `frontend-design` and Hallmark. Mirror `BuildingInvoiceProfileSettings.vue` structure and density. Decide grouping/layout for the 5 groups, how the masked state reads for managers, the payment-window preview treatment, and mobile layout. Record decisions in `docs/changes/building-contract-defaults/verification.md` → "UI decisions". If a new token/primitive seems necessary, stop and ask (problem, option, affected surfaces, benefit, cost).

- [x] **Step 2: Write failing tests**

```ts
// tests/components/buildings/BuildingContractProfileSettings.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BuildingContractProfileSettings from '~/components/buildings/BuildingContractProfileSettings.vue'

const building = { id: 'b-1', name: 'Zeno', billingGenerationDay: 1, paymentDueDay: 5, gracePeriodDays: 5 } as never
const masked = {
  buildingId: 'b-1', lessorFullName: 'Nguyễn Văn A', lessorDateOfBirth: null, lessorPermanentAddress: null,
  lessorIdNumber: '*******8901', lessorIdIssuedDate: '2021-05-01', lessorIdIssuedPlace: 'Huế', lessorPhone: '0901234567',
  lessorIdentityMasked: true, brandName: null, defaultTermMonths: 12, defaultDepositMonths: 1, noticeDays: 30,
  depositRefundDays: 7, renewalMonths: 0, extraOccupantFee: 0, drillingFee: 0, fingerprintResetFee: 0,
  signedCopies: 2, copiesPerParty: 1, updatedAt: '', updatedBy: null,
}

describe('BuildingContractProfileSettings', () => {
  it('shows the payment window sentence from building schedule', () => {
    const w = mount(BuildingContractProfileSettings, { props: { profile: null, building, canEdit: true, saving: false, error: null, editPath: '/x' } })
    expect(w.text()).toContain('Thanh toán từ ngày 1 đến ngày 5 hằng tháng; sau ngày 10')
  })

  it('renders read-only masked view for managers without a save button', () => {
    const w = mount(BuildingContractProfileSettings, { props: { profile: masked, building, canEdit: false, saving: false, error: null, editPath: '/x' } })
    expect(w.text()).toContain('*******8901')
    expect(w.text()).toContain('Ẩn với vai trò quản lý')
    expect(w.find('[data-test="contract-profile-save"]').exists()).toBe(false)
  })

  it('emits snake_case input on save', async () => {
    const w = mount(BuildingContractProfileSettings, { props: { profile: null, building, canEdit: true, saving: false, error: null, editPath: '/x' } })
    await w.find('[data-test="lessor-full-name"] input').setValue('Nguyễn Văn A')
    await w.find('[data-test="contract-profile-save"]').trigger('click')
    expect(w.emitted('save')![0]![0]).toMatchObject({ lessor_full_name: 'Nguyễn Văn A', signed_copies: 2, copies_per_party: 1 })
  })
})
```

```ts
// tests/pages/building-settings-contract-profile.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/[id]/settings.vue'), 'utf8')

describe('building settings contract profile section', () => {
  it('adds the contract section with readiness badge', () => {
    expect(page).toContain(`id: 'contract-profile'`)
    expect(page).toContain('<section id="contract-profile"')
    expect(page).toContain('<BuildingContractProfileSettings')
    expect(page).toContain('readiness.contract.ready')
  })

  it('gates editing on the write capability', () => {
    expect(page).toContain(`'building-contract-profile.write'`)
  })
})
```

Adjust the mount setup to match existing component tests (global stubs/plugins) — check `tests/components/**` for the shared pattern before writing.

- [x] **Step 3: Run to verify failure.**

- [x] **Step 4: Implement the component**

Script outline (template follows the Step 1 decisions using `UiFormSection`, `UiInput`, `UiAlert`, `UiButton`, `UiBadge`):

```ts
<script setup lang="ts">
import type { Building } from '~/types/buildings'
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileSchema, type BuildingContractProfileInput } from '~/utils/validators/building-contract-profile'
import { formatPaymentWindow } from '~/utils/format/payment-window'

const props = defineProps<{
  profile: BuildingContractProfile | null
  building: Building
  canEdit: boolean
  saving: boolean
  error: string | null
  editPath: string
}>()
const emit = defineEmits<{ save: [input: BuildingContractProfileInput] }>()

const toForm = (p: BuildingContractProfile | null) => ({
  lessor_full_name: p?.lessorFullName ?? '',
  lessor_date_of_birth: p?.lessorDateOfBirth ?? '',
  lessor_permanent_address: p?.lessorPermanentAddress ?? '',
  lessor_id_number: p?.lessorIdentityMasked ? '' : (p?.lessorIdNumber ?? ''),
  lessor_id_issued_date: p?.lessorIdIssuedDate ?? '',
  lessor_id_issued_place: p?.lessorIdIssuedPlace ?? '',
  lessor_phone: p?.lessorPhone ?? '',
  brand_name: p?.brandName ?? '',
  default_term_months: p?.defaultTermMonths ?? null,
  default_deposit_months: p?.defaultDepositMonths ?? null,
  notice_days: p?.noticeDays ?? null,
  deposit_refund_days: p?.depositRefundDays ?? null,
  renewal_months: p?.renewalMonths ?? null,
  extra_occupant_fee: p?.extraOccupantFee ?? null,
  drilling_fee: p?.drillingFee ?? null,
  fingerprint_reset_fee: p?.fingerprintResetFee ?? null,
  signed_copies: p?.signedCopies ?? 2,
  copies_per_party: p?.copiesPerParty ?? 1,
})

const form = reactive(toForm(props.profile))
watch(() => props.profile, value => Object.assign(form, toForm(value)))

const fieldErrors = ref<Record<string, string>>({})
const paymentWindow = computed(() => formatPaymentWindow(props.building))

function submit() {
  fieldErrors.value = {}
  const result = buildingContractProfileSchema.safeParse({ ...form })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  emit('save', result.data)
}
</script>
```

Template requirements (verified by tests):
- `data-test="lessor-full-name"` wrapper on the full-name `UiInput`; `data-test="contract-profile-save"` on the save `UiButton`, rendered only when `canEdit`.
- When `!canEdit`: render values as `UiDefinitionList`; for `lessorIdentityMasked` show the masked id and "Ẩn với vai trò quản lý" for date of birth and address.
- Group 1 description: "Thông tin này in trên hợp đồng, khác với thông tin liên hệ chủ nhà."
- Group 3 hints: notice_days → "Điều 2.5, 4.2, 4.3, 7.6, 8.2"; deposit_refund_days → "Điều 4.5"; renewal_months → "Điều 8.2 (0 = không tự gia hạn)"; extra_occupant_fee → "Điều 3.1"; drilling_fee → "Điều 3.2"; fingerprint_reset_fee → "Điều 3.3".
- Group 5: if `paymentWindow` → show sentence prefixed "Trên hợp đồng:" and three source captions ("Ngày phát hành hóa đơn: {startDay}", "Hạn thanh toán: {endDay}", "Số ngày ân hạn: {graceDays}") plus `NuxtLink :to="editPath"` "Sửa lịch vận hành"; else `UiAlert severity="warning"` "Chưa đủ lịch thanh toán. Cài đặt ngày phát hành hóa đơn và hạn thanh toán trước." with the same link.
- When the owner edits an existing masked-for-others id: owner sees full value (not masked) since owner has `pii.read`; `lessor_id_number: ''` from a masked profile only occurs for roles without edit rights, so no accidental wipe.
- Placeholders as suggestions: notice_days "30", deposit_refund_days "7", renewal_months "6", default_term_months "12", default_deposit_months "1".

- [x] **Step 5: Wire into the settings page**

In `settings.vue`:
1. Add a nav item after `invoice-profile`:

```ts
  {
    id: 'contract-profile',
    label: 'Hợp đồng',
    description: 'Bên cho thuê, điều khoản và lịch thanh toán trên hợp đồng',
    badge: readiness.value?.contract.ready ? 'Đủ thông tin lập HĐ' : `Thiếu ${readiness.value?.contract.missing.length ?? 0} mục`,
    visible: authStore.can('building-contract-profile.read'),
  },
```

(Use whatever capability helper the page/auth store exposes; check how `canEditInvoiceProfile` is computed and mirror it.)

2. Add computed state and composable:

```ts
const readiness = computed(() => settings.value?.readiness ?? null)
const canEditContractProfile = computed(() => authStore.can('building-contract-profile.write'))
const { saving: savingContractProfile, error: contractProfileError, save: saveContractProfile } = useBuildingContractProfile(id, {
  data: computed(() => settings.value?.contractProfile ?? null),
  set: (profile) => {
    if (settingsData.value) {
      settingsData.value = { ...settingsData.value, data: { ...settingsData.value.data, contractProfile: profile } }
    }
  },
  onSaved: () => refreshSettings(),
})

async function handleSaveContractProfile(input: BuildingContractProfileInput) {
  try {
    await saveContractProfile(input)
    toast.success('Đã lưu thông tin hợp đồng của tòa nhà.')
  }
  catch {
    // Error is shown beside the form.
  }
}
```

3. Add the section after `</section>` of `invoice-profile`:

```vue
<section v-if="settings?.contractProfile !== undefined" id="contract-profile" class="scroll-mt-20 space-y-3">
  <header class="flex items-center justify-between gap-2">
    <h2 class="text-sm font-semibold text-ui-accent">Hợp đồng</h2>
    <UiBadge :variant="readiness?.contract.ready ? 'success' : 'warning'">
      {{ readiness?.contract.ready ? 'Đủ thông tin lập HĐ' : `Thiếu ${readiness?.contract.missing.length ?? 0} mục` }}
    </UiBadge>
  </header>
  <UiSection
    title="Thông tin trên hợp đồng"
    description="Áp dụng cho hợp đồng tạo mới. Hợp đồng đã phát hành không thay đổi."
  >
    <UiSurfacePanel density="compact">
      <BuildingContractProfileSettings
        :profile="settings?.contractProfile ?? null"
        :building="settings!.building"
        :can-edit="canEditContractProfile"
        :saving="savingContractProfile"
        :error="contractProfileError"
        :edit-path="buildingEditPath(settings!.building)"
        @save="handleSaveContractProfile"
      />
    </UiSurfacePanel>
  </UiSection>
</section>
```

Add the unsaved-changes guard using the same mechanism the page uses for other sections (search the page for `onBeforeRouteLeave` / `useUnsavedChanges`); if no such mechanism exists for settings sections, skip it and note in `verification.md`.

- [x] **Step 6: Run tests** → PASS.

- [x] **Step 7: Visual QA** (ask before starting a local runtime): owner (empty, partial, complete, save error), manager (masked read-only), schedule missing, mobile 375px. Record in `verification.md`.

- [x] **Step 8: Commit**

```bash
git add app/components/buildings/BuildingContractProfileSettings.vue app/pages/dashboard/buildings/[id]/settings.vue tests/components/buildings/BuildingContractProfileSettings.test.ts tests/pages/building-settings-contract-profile.spec.ts docs/changes/building-contract-defaults/verification.md
git commit -m "feat(buildings): contract profile settings section"
```

---

### Task 9: Building detail readiness block

**Files:**
- Create: `app/components/buildings/BuildingReadinessCard.vue`
- Modify: `app/pages/dashboard/buildings/[id]/index.vue`
- Test: `tests/components/buildings/BuildingReadinessCard.test.ts`

**Interfaces:**
- Props: `{ readiness: BuildingReadiness; settingsPath: string; editPath: string }`
- Page fetches `GET /api/buildings/[id]/readiness` via `useFetch` (lazy, non-blocking).

- [x] **Step 1: Write the failing test**

```ts
// tests/components/buildings/BuildingReadinessCard.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BuildingReadinessCard from '~/components/buildings/BuildingReadinessCard.vue'

const props = (contractMissing: string[], billingMissing: string[]) => ({
  readiness: {
    contract: { ready: contractMissing.length === 0, missing: contractMissing },
    billing: { ready: billingMissing.length === 0, missing: billingMissing },
  } as never,
  settingsPath: '/dashboard/buildings/zeno/settings',
  editPath: '/dashboard/buildings/zeno/edit',
})

describe('BuildingReadinessCard', () => {
  it('shows missing counts and links each item to its anchor', async () => {
    const w = mount(BuildingReadinessCard, { props: props(['lessor.id_number', 'invoice_profile'], ['billing.water_rate']) })
    expect(w.text()).toContain('Lập hợp đồng')
    expect(w.text()).toContain('Thiếu 2 mục')
    await w.find('[data-test="readiness-contract-toggle"]').trigger('click')
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/dashboard/buildings/zeno/settings#contract-profile')
    expect(hrefs).toContain('/dashboard/buildings/zeno/settings#invoice-profile')
  })

  it('collapses to a compact ready state', () => {
    const w = mount(BuildingReadinessCard, { props: props([], []) })
    expect(w.find('[data-test="readiness-compact"]').exists()).toBe(true)
  })
})
```

Use `NuxtLink` stub as in other component tests (render as `<a :href="to">`).

- [x] **Step 2: Run to verify failure.**

- [x] **Step 3: Implement** the card with `UiSurfacePanel`, two rows (label, ✓ or `UiBadge` "Thiếu N mục", toggle button `data-test="readiness-{kind}-toggle"`), expandable list using `READINESS_LABELS` → `anchor === 'edit' ? editPath : \`${settingsPath}#${anchor}\``. When both ready render a single compact line `data-test="readiness-compact"` "Sẵn sàng lập hợp đồng và xuất hóa đơn". No inline `<svg>`; use existing icon components if needed.

- [x] **Step 4: Wire into the detail page** after `BuildingDetailHero`:

```ts
const { data: readinessData } = useFetch<ApiSuccess<BuildingReadiness>>(
  () => `/api/buildings/${encodeURIComponent(id)}/readiness`,
  { lazy: true, server: false },
)
```

```vue
<BuildingReadinessCard
  v-if="readinessData?.data && authStore.canManage"
  class="mt-4"
  :readiness="readinessData.data"
  :settings-path="buildingSettingsPath(building)"
  :edit-path="buildingEditPath(building)"
/>
```

(Use the page's existing `id` / building identifier variable.)

- [x] **Step 5: Run tests** → PASS. Visual QA desktop/mobile; record in `verification.md`.

- [x] **Step 6: Commit**

```bash
git add app/components/buildings/BuildingReadinessCard.vue app/pages/dashboard/buildings/[id]/index.vue tests/components/buildings/BuildingReadinessCard.test.ts docs/changes/building-contract-defaults/verification.md
git commit -m "feat(buildings): readiness card on building detail"
```

---

### Task 10: Full verification and docs

**Files:**
- Create/Modify: `docs/changes/building-contract-defaults/verification.md`
- Modify: `docs/changes/building-contract-defaults/index.md`

- [x] **Step 1: Run** `npm run typecheck && npm test && npm run lint && npm run knowledge:check`. Fix failures; record results.

- [x] **Step 2: Write `verification.md`**

```markdown
---
type: Change Verification
title: "building-contract-defaults-verification"
status: draft
change_state: verification-pending
tags: [change, verification, buildings, pii]
---

# Building contract defaults — verification

## Local (source)
- [ ] typecheck / test / lint / knowledge:check — <date, result>

## PII checks
- [ ] Manager profile response contains no raw id/dob/address (test name + result)
- [ ] Settings bootstrap for manager contains no raw id (test name + result)
- [ ] Audit metadata contains only changed field names
- [ ] 422 responses do not echo values

## UI decisions
- <from Task 8 Step 1>

## Visual QA
- [ ] Owner: empty / partial / complete / save error — desktop + mobile
- [ ] Manager: masked read-only
- [ ] Schedule missing warning
- [ ] Detail page readiness card: missing / ready

## Cloud gates
- [ ] Migration applied — <env, date>
- [ ] `supabase/verification/building_contract_profiles.sql` passed — <output>
- [ ] Cascade check — <result>
- [ ] Types regenerated; repository casts removed — <commit>
```

- [x] **Step 3: Update `index.md`** status to `implementation-review`, link plan and verification.

- [x] **Step 4: Commit**

```bash
git add docs/changes/building-contract-defaults
git commit -m "docs(changes): record PR1 verification evidence"
```

- [ ] **Step 5: Cloud gate (human-run)**: apply migration, run verification script and cascade check, regenerate types, remove `as never` casts in `building-contract-profiles.ts`, re-run typecheck, update `verification.md`. On acceptance: create `docs/capabilities/building-contract-profile.md`, update `buildings-ui.md`, archive to `docs/history/`.
