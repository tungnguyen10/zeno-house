---
type: Implementation Plan
title: "building-onboarding-v2-implementation-plan"
status: draft
change_state: plan-review
tags: [superpowers, change, buildings, settings, contracts, onboarding, v2]
---

# Building onboarding V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "create building → first contract" into one continuous flow through the existing Settings page, fold owner contact into the lessor profile, and remove duplicated readiness/forms.

**Architecture:** One additive migration (`lessor_email` + owner→lessor fold). A new partial-save `PATCH` for the contract profile lets the old single "Hợp đồng" step split into "Bên cho thuê" and "Điều khoản hợp đồng". Settings gains a `?setup=1` mode driven by pure helpers in `building-setup-steps.ts` and a small composable; create/detail/list pages are trimmed to match.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, Tailwind with Zeno House `ui-*` tokens, Zod 4, Supabase (service-role repositories), Vitest.

**Spec:** [design.md](./design.md)

## Global Constraints

- Flow is page/component → composable → `server/api/**` → service → repository → Supabase; no browser table queries.
- Zod validators live in `app/utils/validators/**` and are used on both client and server.
- Do not hand-edit `app/types/database.types.ts`; regenerate it after the migration is applied (Task 12).
- Vietnamese UI copy must carry diacritics; otherwise use English.
- No inline `<svg>` in templates; icons come from `app/assets/icons/` as `Icon*` components.
- UI follows `.agents/skills/zeno-house/references/ui-polish-workflow.md`: existing primitives (`UiButton`, `UiInput`, `UiFormSection`, `UiSurfacePanel`, `UiAlert`, `UiBadge`, `UiDefinitionList`), no new primitive, no new tokens.
- Owner columns `buildings.owner_*` stay in the database in this change; the app stops reading and writing them.
- Suggested contract terms: term 12 months, deposit 1 month, notice 30 days, deposit refund 7 days, renewal 6 months; fees stay empty.
- Required setup steps: `lessor-profile`, `contract-terms`, `basics`, `invoice-profile`. Optional: `service-defaults`, `inventory-template`.
- Commands: narrow `npx vitest run <paths>`, then `npm run typecheck`, `npm test`, `npm run lint`, `npm run knowledge:check`.

## Review Focus

- A `PATCH` body that omits `signed_copies`/`copies_per_party` must not reset them to `2`/`1` (Zod 4 `.partial()` still applies `.default()`): Task 2 tests an absent-key round trip.
- `PATCH` that only lowers `signed_copies` below `copies_per_party * 2` must be rejected after merging with the stored row, not silently written: Task 2 tests the merged copies rule.
- An owner phone like `+84 901 234 567` or `0901.234.567` must migrate as `0901234567`; an unparseable phone must be skipped, not fail the migration: Task 1 verification SQL covers both.
- Opening an old link `settings#contract-profile` must land on the "Bên cho thuê" step, not a blank page: Task 7 tests the hash alias.
- A user who already finished setup and opens `settings?setup=1` again must see the completion state, not be forced through steps: Task 5 tests `nextSetupStepId` on a ready flow returns `null`.

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `supabase/migrations/20261118090000_building_owner_to_lessor.sql` | Add `lessor_email`, fold owner → lessor | 1 |
| `supabase/verification/building_owner_to_lessor.sql` | Rolled-back verification of the fold | 1 |
| `app/utils/validators/building-contract-profile.ts` | `lessor_email`, base object, patch parser | 2 |
| `app/utils/mappers/building-contract-profile.ts`, `app/types/building-contract-profile.ts` | `lessorEmail` DTO | 2 |
| `server/api/buildings/[id]/contract-profile/index.patch.ts` | Partial save endpoint | 2 |
| `server/services/buildings/contract-profile.ts` | `patch()` merge + audit | 2 |
| `app/composables/buildings/useBuildingContractProfile.ts` | `patch()` client call | 2 |
| `app/utils/validators/buildings.ts`, `app/types/building-form.ts`, `app/utils/mappers/building-form.ts`, `app/utils/mappers/buildings.ts`, `app/types/buildings.ts`, `server/repositories/buildings/index.ts` | Drop `owner_*` from the app layer | 3 |
| `app/components/buildings/BuildingForm.vue` | `variant` prop, no owner section | 3, 4 |
| `app/pages/dashboard/buildings/create.vue`, `app/composables/buildings/useBuildingForm.ts` | Slim create, redirect to setup | 4 |
| `app/utils/building-setup-steps.ts`, `app/utils/constants/readiness.ts` | 6-step order, locked steps, `nextSetupStepId`, `summarizeRequiredSteps` | 5 |
| `app/components/buildings/BuildingLessorProfileForm.vue`, `app/components/buildings/BuildingContractTermsForm.vue` | Split forms (replace `BuildingContractProfileSettings.vue`) | 6 |
| `app/components/buildings/settings/steps/LessorProfileStep.vue`, `.../ContractTermsStep.vue` | Step wrappers (replace `ContractStep.vue`) | 6 |
| `app/composables/buildings/useBuildingSetupMode.ts` | `?setup=1` behavior | 7 |
| `app/pages/dashboard/buildings/[id]/settings.vue`, `app/components/buildings/settings/SettingsReadinessCard.vue`, `SettingsStepList.vue` | Wire setup mode, locked steps, completion CTA | 7 |
| `server/repositories/inventory.ts`, `server/services/buildings/settings-bootstrap.ts`, `app/types/building-settings.ts`, `app/components/buildings/settings/steps/InventoryStep.vue`, `app/pages/dashboard/buildings/[id]/rooms/batch.vue` | Rooms without inventory + apply suggestion | 8 |
| `app/pages/dashboard/buildings/[id]/index.vue`, `app/components/buildings/BuildingSetupStrip.vue` | Detail page cleanup (replace `BuildingReadinessCard.vue`) | 9 |
| `app/components/buildings/BuildingCard.vue` | Selection padding fix | 10 |
| `app/pages/dashboard/contracts/create.vue` | `?building_id=` room filter | 11 |
| Docs + cloud rollout | Verification record, capabilities on acceptance | 12 |

---

### Task 1: Migration — `lessor_email` and owner → lessor fold

**Files:**
- Create: `supabase/migrations/20261118090000_building_owner_to_lessor.sql`
- Create: `supabase/verification/building_owner_to_lessor.sql`
- Test: `tests/config/building-owner-to-lessor-migration.test.ts`

**Interfaces:**
- Produces: column `public.building_contract_profiles.lessor_email text` (nullable, ≤ 254, email shape).

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/building-owner-to-lessor-migration.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261118090000_building_owner_to_lessor.sql'), 'utf8')
const flat = sql.replace(/\s+/g, ' ')

describe('building owner → lessor migration', () => {
  it('runs in one transaction', () => {
    expect(sql).toMatch(/^begin;/m)
    expect(sql).toMatch(/^commit;/m)
  })

  it('adds a bounded, validated lessor_email column', () => {
    expect(flat).toContain('add column if not exists lessor_email text')
    expect(flat).toContain('length(lessor_email) <= 254')
  })

  it('only fills empty lessor fields and never overwrites', () => {
    expect(flat).toContain('on conflict (building_id) do update set')
    for (const col of ['lessor_full_name', 'lessor_phone', 'lessor_email']) {
      expect(flat).toContain(`${col} = coalesce(public.building_contract_profiles.${col}, excluded.${col})`)
    }
  })

  it('filters values through the existing constraints before copying', () => {
    expect(flat).toContain('between 2 and 100')
    expect(flat).toContain("'^0[0-9]{9}$'")
  })

  it('does not drop or modify buildings.owner_* columns', () => {
    expect(flat).not.toMatch(/alter table public\.buildings/i)
    expect(flat).not.toMatch(/drop column/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/building-owner-to-lessor-migration.test.ts`
Expected: FAIL with `ENOENT` for the migration file.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20261118090000_building_owner_to_lessor.sql
-- Folds building owner contact into the lessor profile (single source). Additive only:
-- buildings.owner_* stay until a later migration removes them.
begin;

alter table public.building_contract_profiles
  add column if not exists lessor_email text
  check (lessor_email is null or (length(lessor_email) <= 254 and lessor_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

with src as (
  select
    b.id as building_id,
    case when length(btrim(b.owner_name)) between 2 and 100 then btrim(b.owner_name) end as full_name,
    case
      when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^0[0-9]{9}$'
        then regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g')
      when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^\+?84[0-9]{9}$'
        then '0' || right(regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g'), 9)
    end as phone,
    case
      when length(btrim(b.owner_email)) <= 254
        and btrim(b.owner_email) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        then lower(btrim(b.owner_email))
    end as email
  from public.buildings b
)
insert into public.building_contract_profiles (building_id, lessor_full_name, lessor_phone, lessor_email)
select building_id, full_name, phone, email
from src
where coalesce(full_name, phone, email) is not null
on conflict (building_id) do update set
  lessor_full_name = coalesce(public.building_contract_profiles.lessor_full_name, excluded.lessor_full_name),
  lessor_phone = coalesce(public.building_contract_profiles.lessor_phone, excluded.lessor_phone),
  lessor_email = coalesce(public.building_contract_profiles.lessor_email, excluded.lessor_email);

commit;
```

- [ ] **Step 4: Write the verification script**

```sql
-- supabase/verification/building_owner_to_lessor.sql
-- Run in the SQL editor as service_role after the migration; rolled back.
begin;

do $$
declare
  v_actor uuid := (select id from auth.users order by created_at limit 1);
  v_a uuid; v_b uuid; v_c uuid;
  v_row public.building_contract_profiles%rowtype;
begin
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, owner_email, created_by)
  values ('OL verify A', 'ol-a-' || substr(gen_random_uuid()::text,1,8), 'ola' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '1 Verify', 'active', 'Nguyễn Văn Chủ', '+84 901 234 567', 'Chu@Example.com', v_actor)
  returning id into v_a;
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, created_by)
  values ('OL verify B', 'ol-b-' || substr(gen_random_uuid()::text,1,8), 'olb' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '2 Verify', 'active', 'X', 'abc', v_actor)
  returning id into v_b;
  insert into public.buildings (name, slug, code, address, status, owner_name, owner_phone, created_by)
  values ('OL verify C', 'ol-c-' || substr(gen_random_uuid()::text,1,8), 'olc' || substr(replace(gen_random_uuid()::text,'-',''),1,6),
          '3 Verify', 'active', 'Chủ Mới', '0901.111.222', v_actor)
  returning id into v_c;
  insert into public.building_contract_profiles (building_id, lessor_full_name) values (v_c, 'Người Ký Cũ');

  -- Re-run the fold body against the fixtures.
  with src as (
    select b.id as building_id,
      case when length(btrim(b.owner_name)) between 2 and 100 then btrim(b.owner_name) end as full_name,
      case
        when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^0[0-9]{9}$' then regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g')
        when regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g') ~ '^\+?84[0-9]{9}$' then '0' || right(regexp_replace(b.owner_phone, '[[:space:].()-]', '', 'g'), 9)
      end as phone,
      case when length(btrim(b.owner_email)) <= 254 and btrim(b.owner_email) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        then lower(btrim(b.owner_email)) end as email
    from public.buildings b where b.id in (v_a, v_b, v_c)
  )
  insert into public.building_contract_profiles (building_id, lessor_full_name, lessor_phone, lessor_email)
  select building_id, full_name, phone, email from src where coalesce(full_name, phone, email) is not null
  on conflict (building_id) do update set
    lessor_full_name = coalesce(public.building_contract_profiles.lessor_full_name, excluded.lessor_full_name),
    lessor_phone = coalesce(public.building_contract_profiles.lessor_phone, excluded.lessor_phone),
    lessor_email = coalesce(public.building_contract_profiles.lessor_email, excluded.lessor_email);

  select * into v_row from public.building_contract_profiles where building_id = v_a;
  if v_row.lessor_full_name <> 'Nguyễn Văn Chủ' or v_row.lessor_phone <> '0901234567' or v_row.lessor_email <> 'chu@example.com' then
    raise exception 'VERIFY 1 failed: normalized copy %', row_to_json(v_row);
  end if;

  if exists (select 1 from public.building_contract_profiles where building_id = v_b) then
    raise exception 'VERIFY 2 failed: invalid owner values created a profile';
  end if;

  select * into v_row from public.building_contract_profiles where building_id = v_c;
  if v_row.lessor_full_name <> 'Người Ký Cũ' or v_row.lessor_phone <> '0901111222' then
    raise exception 'VERIFY 3 failed: overwrite or missing fill %', row_to_json(v_row);
  end if;

  raise notice 'owner → lessor verification passed';
end $$;

select
  count(*) filter (where coalesce(b.owner_name, b.owner_phone, b.owner_email) is not null) as buildings_with_owner,
  count(p.building_id) filter (where p.lessor_full_name is not null) as profiles_with_name,
  count(p.building_id) filter (where p.lessor_email is not null) as profiles_with_email
from public.buildings b
left join public.building_contract_profiles p on p.building_id = b.id;

rollback;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/config/building-owner-to-lessor-migration.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261118090000_building_owner_to_lessor.sql supabase/verification/building_owner_to_lessor.sql tests/config/building-owner-to-lessor-migration.test.ts
git commit -m "feat(db): add lessor_email and fold building owner contact into lessor profile"
```

---

### Task 2: Contract profile — `lessor_email` and partial `PATCH`

**Files:**
- Modify: `app/utils/validators/building-contract-profile.ts`
- Modify: `app/types/building-contract-profile.ts`, `app/utils/mappers/building-contract-profile.ts`
- Modify: `server/services/buildings/contract-profile.ts`
- Create: `server/api/buildings/[id]/contract-profile/index.patch.ts`
- Modify: `app/composables/buildings/useBuildingContractProfile.ts`
- Test: `tests/server/buildings/contract-profile-service.test.ts`, `tests/server/buildings/contract-profile-patch.test.ts`, `tests/composables/useBuildingContractProfile.test.ts`, `tests/utils/building-contract-profile-validator.test.ts`

**Interfaces:**
- Consumes: column `lessor_email` (Task 1).
- Produces:
  - `buildingContractProfileBaseSchema` (Zod object, no cross-field refine)
  - `buildingContractProfileSchema` (base + copies refine, unchanged behavior + `lessor_email`)
  - `parseContractProfilePatch(body: unknown): { success: true, data: BuildingContractProfilePatch } | { success: false, error: z.ZodError }`
  - `type BuildingContractProfilePatch = Partial<BuildingContractProfileInput>`
  - `BuildingContractProfileService.patch(event, user, buildingIdentifier, patch: BuildingContractProfilePatch): Promise<BuildingContractProfile>`
  - `useBuildingContractProfile(...).patch(input: BuildingContractProfilePatch): Promise<BuildingContractProfile>`
  - DTO field `BuildingContractProfile.lessorEmail: string | null`

- [ ] **Step 1: Write the failing validator test**

```ts
// tests/utils/building-contract-profile-validator.test.ts
import { describe, expect, it } from 'vitest'
import { buildingContractProfileSchema, parseContractProfilePatch } from '~/utils/validators/building-contract-profile'

describe('contract profile validators', () => {
  it('accepts and lowercases lessor_email, blank becomes null', () => {
    expect(buildingContractProfileSchema.parse({ lessor_email: ' Chu@Example.com ' }).lessor_email).toBe('chu@example.com')
    expect(buildingContractProfileSchema.parse({ lessor_email: '' }).lessor_email).toBeNull()
  })

  it('rejects a malformed email', () => {
    expect(buildingContractProfileSchema.safeParse({ lessor_email: 'not-an-email' }).success).toBe(false)
  })

  it('patch keeps only the keys present in the body (no defaults injected)', () => {
    const result = parseContractProfilePatch({ notice_days: '30' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ notice_days: 30 })
  })

  it('patch rejects unknown keys', () => {
    expect(parseContractProfilePatch({ owner_name: 'x' }).success).toBe(false)
  })

  it('patch rejects a non-object body', () => {
    expect(parseContractProfilePatch(null).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/utils/building-contract-profile-validator.test.ts`
Expected: FAIL — `parseContractProfilePatch` is not exported.

- [ ] **Step 3: Implement validator changes**

In `app/utils/validators/building-contract-profile.ts`, rename the object to a base schema, add `lessor_email`, re-derive the full schema and add the patch parser:

```ts
const optionalEmail = z.preprocess(
  value => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.preprocess(blankToNull, z.string().max(254, 'Email quá dài').email('Email không hợp lệ').nullable().default(null)),
)

export const buildingContractProfileBaseSchema = z.object({
  // ...all existing fields unchanged...
  lessor_email: optionalEmail,
}).strict()

function copiesRule(value: { signed_copies?: number; copies_per_party?: number }, ctx: z.RefinementCtx) {
  if (value.signed_copies == null || value.copies_per_party == null) return
  if (value.copies_per_party * 2 > value.signed_copies) {
    ctx.addIssue({ code: 'custom', path: ['copies_per_party'], message: 'Tổng số bản hai bên giữ vượt quá số bản ký' })
  }
}

export const buildingContractProfileSchema = buildingContractProfileBaseSchema.superRefine(copiesRule)

export type BuildingContractProfileInput = z.infer<typeof buildingContractProfileSchema>
export type BuildingContractProfilePatch = Partial<BuildingContractProfileInput>

const patchSchema = buildingContractProfileBaseSchema.partial()

// Zod 4 `.partial()` still applies `.default()` to absent keys, so keep only keys the client sent.
export function parseContractProfilePatch(body: unknown) {
  const result = patchSchema.safeParse(body)
  if (!result.success) return result
  const sent = new Set(Object.keys(body as object))
  const data = Object.fromEntries(Object.entries(result.data).filter(([key]) => sent.has(key))) as BuildingContractProfilePatch
  return { success: true as const, data }
}

export { copiesRule as contractProfileCopiesRule }
```

Keep the existing `.strict()` only if the current PUT callers send no extra keys; `BuildingContractProfileSettings.vue` sends exactly the schema keys, so `.strict()` is safe.

- [ ] **Step 4: Run validator test to verify it passes**

Run: `npx vitest run tests/utils/building-contract-profile-validator.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing service test**

```ts
// tests/server/buildings/contract-profile-patch.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'

const findBuilding = vi.fn()
const findProfile = vi.fn()
const upsertProfile = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({ BuildingRepository: { findByIdentifier: findBuilding } }))
vi.mock('../../../server/repositories/building-contract-profiles', () => ({
  BuildingContractProfileRepository: { findByBuildingId: findProfile, upsert: upsertProfile },
}))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({ BuildingInvoiceProfileRepository: { findByBuildingId: vi.fn() } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const row = {
  building_id: 'b-1', lessor_full_name: 'Nguyễn Văn A', lessor_date_of_birth: '1980-01-02',
  lessor_permanent_address: '12 Lê Lợi', lessor_id_number: '012345678901', lessor_id_issued_date: '2021-05-01',
  lessor_id_issued_place: 'Huế', lessor_phone: '0901234567', lessor_email: null, brand_name: null,
  default_term_months: 12, default_deposit_months: 1, notice_days: null, deposit_refund_days: null, renewal_months: null,
  extra_occupant_fee: null, drilling_fee: null, fingerprint_reset_fee: null, signed_copies: 4, copies_per_party: 2,
  updated_by: 'o-1', created_at: 't', updated_at: 't',
}
const owner = { id: 'o-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'm-1', app_metadata: { role: 'manager' } } as AuthUser
const ev = () => ({ context: {} }) as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('can', (user: AuthUser) => String(user.app_metadata?.role) !== 'manager')
  findBuilding.mockResolvedValue({ id: 'b-1' })
  assertBuildingScope.mockResolvedValue(undefined)
  findProfile.mockResolvedValue(row)
  upsertProfile.mockImplementation(async (_e: unknown, _id: string, input: object) => ({ ...row, ...input }))
})

describe('BuildingContractProfileService.patch', () => {
  it('merges the patch over the stored row and keeps untouched fields', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { notice_days: 30 })

    const written = upsertProfile.mock.calls[0]![2]
    expect(written).toMatchObject({ notice_days: 30, lessor_id_number: '012345678901', signed_copies: 4, copies_per_party: 2 })
    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), owner, 'b-1', 'write')
  })

  it('creates a profile from defaults when none exists', async () => {
    findProfile.mockResolvedValue(null)
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { lessor_full_name: 'Chủ Mới' })

    expect(upsertProfile.mock.calls[0]![2]).toMatchObject({ lessor_full_name: 'Chủ Mới', signed_copies: 2, copies_per_party: 1, notice_days: null })
  })

  it('rejects a patch that breaks the copies rule after merging', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.patch(ev(), owner, 'b-1', { signed_copies: 3 }))
      .rejects.toMatchObject({ statusCode: 422 })
    expect(upsertProfile).not.toHaveBeenCalled()
  })

  it('forbids users without write permission', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await expect(BuildingContractProfileService.patch(ev(), manager, 'b-1', { notice_days: 30 })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('audits only the patched field names, never values', async () => {
    const { BuildingContractProfileService } = await import('../../../server/services/buildings/contract-profile')
    await BuildingContractProfileService.patch(ev(), owner, 'b-1', { lessor_email: 'chu@example.com' })

    const audit = appendAudit.mock.calls[0]![2]
    expect(audit.metadata.changed_fields).toEqual(['lessor_email'])
    expect(JSON.stringify(audit)).not.toContain('chu@example.com')
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/server/buildings/contract-profile-patch.test.ts`
Expected: FAIL — `BuildingContractProfileService.patch is not a function`.

- [ ] **Step 7: Implement DTO, mapper and service**

`app/types/building-contract-profile.ts`: add `lessorEmail: string | null` after `lessorPhone`.

`app/utils/mappers/building-contract-profile.ts`: add `lessor_email: string | null` to the row type and `lessorEmail: row.lessor_email ?? null` to the mapper. `maskBuildingContractProfile` leaves `lessorEmail` as is.

`server/services/buildings/contract-profile.ts`:

```ts
import { buildingContractProfileSchema, type BuildingContractProfilePatch } from '~/utils/validators/building-contract-profile'

// Add 'lessor_email' to EDITABLE_COLUMNS.

function rowToInput(row: BuildingContractProfileRow | null): Record<string, unknown> {
  if (!row) return {}
  return Object.fromEntries(EDITABLE_COLUMNS.map(key => [key, row[key as keyof BuildingContractProfileRow] ?? null]))
}

// inside BuildingContractProfileService:
  async patch(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    patch: BuildingContractProfilePatch,
  ): Promise<BuildingContractProfile> {
    if (!can(user, 'building-contract-profile.write')) throwForbidden('Không có quyền cập nhật thông tin hợp đồng của tòa nhà')
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const existing = await BuildingContractProfileRepository.findByBuildingId(event, building.id)
    const merged = buildingContractProfileSchema.safeParse({ ...rowToInput(existing), ...patch })
    if (!merged.success) throwValidationError('Thông tin hợp đồng không hợp lệ', merged.error.flatten().fieldErrors)
    const saved = await BuildingContractProfileRepository.upsert(event, building.id, merged.data, user.id)

    await AuditService.append(event, user, {
      building_id: building.id,
      action: AUDIT_ACTIONS.BUILDING_CONTRACT_PROFILE_UPDATED,
      entity_type: 'building',
      entity_id: building.id,
      metadata: { configured_first_time: !existing, changed_fields: changedFields(existing, merged.data) },
    })
    return present(user, mapBuildingContractProfile(saved))!
  },
```

`numeric` columns come back as strings (`default_deposit_months`, fees); `buildingContractProfileSchema` preprocesses numeric text, so `rowToInput` needs no conversion.

- [ ] **Step 8: Create the endpoint**

```ts
// server/api/buildings/[id]/contract-profile/index.patch.ts
import { parseContractProfilePatch } from '~/utils/validators/building-contract-profile'
import { BuildingContractProfileService } from '../../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = parseContractProfilePatch(await readBody(event))
  if (!result.success) {
    throwValidationError('Thông tin hợp đồng không hợp lệ', result.error.flatten().fieldErrors)
  }
  return { data: await BuildingContractProfileService.patch(event, user, id, result.data) }
})
```

- [ ] **Step 9: Add `patch` to the composable (test first)**

Append to `tests/composables/useBuildingContractProfile.test.ts`:

```ts
  it('PATCHes only the provided fields', async () => {
    fetchMock.mockResolvedValue({ data: { buildingId: 'b-1' } })
    const set = vi.fn()
    const { useBuildingContractProfile } = await import('~/composables/buildings/useBuildingContractProfile')
    const { patch } = useBuildingContractProfile('zeno', { data: ref(null), set })

    await patch({ notice_days: 30 })

    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/zeno/contract-profile', expect.objectContaining({ method: 'PATCH', body: { notice_days: 30 } }))
    expect(set).toHaveBeenCalledWith({ buildingId: 'b-1' })
  })
```

Run: `npx vitest run tests/composables/useBuildingContractProfile.test.ts` → FAIL (`patch` undefined). Then refactor the composable so `save` and `patch` share one request helper:

```ts
  async function send(method: 'PUT' | 'PATCH', body: BuildingContractProfileInput | BuildingContractProfilePatch) {
    error.value = null
    saving.value = true
    try {
      const response = await apiFetch<ApiSuccess<BuildingContractProfile>>(
        `/api/buildings/${encodeURIComponent(toValue(buildingIdentifier))}/contract-profile`,
        { method, body },
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

  const save = (input: BuildingContractProfileInput) => send('PUT', input)
  const patch = (input: BuildingContractProfilePatch) => send('PATCH', input)

  return { profile: source.data, saving, error, save, patch }
```

- [ ] **Step 10: Run all Task 2 tests**

Run: `npx vitest run tests/utils/building-contract-profile-validator.test.ts tests/server/buildings/contract-profile-patch.test.ts tests/server/buildings/contract-profile-service.test.ts tests/server/buildings/contract-profile-api.test.ts tests/composables/useBuildingContractProfile.test.ts`
Expected: PASS. If `contract-profile-service.test.ts` fails on the exact `upsert` input because `lessor_email` was added, add `lessor_email: null` to its `row` fixture.

- [ ] **Step 11: Commit**

```bash
git add app/utils/validators/building-contract-profile.ts app/types/building-contract-profile.ts app/utils/mappers/building-contract-profile.ts server/services/buildings/contract-profile.ts "server/api/buildings/[id]/contract-profile/index.patch.ts" app/composables/buildings/useBuildingContractProfile.ts tests/
git commit -m "feat(buildings): lessor email and partial contract profile PATCH"
```

---

### Task 3: Remove `owner_*` from the building app layer

**Files:**
- Modify: `app/utils/validators/buildings.ts:22-25`
- Modify: `app/types/building-form.ts:6-8`, `app/utils/mappers/building-form.ts:14-16,36-38,58-60`
- Modify: `app/types/buildings.ts:32-34,59-61`, `app/utils/mappers/buildings.ts:27-29`
- Modify: `server/repositories/buildings/index.ts:119-121,446-448`
- Modify: `app/components/buildings/BuildingForm.vue` (remove `owner_*` from `FIELD_IDS` and the "Chủ sở hữu" `UiFormSection`)
- Modify: `app/pages/dashboard/buildings/create.vue:11-13`, `app/pages/dashboard/buildings/index.vue:138-140`
- Test: `tests/utils/building-form-mapper.test.ts`, `tests/utils/building-create-with-rooms-validator.test.ts`, `tests/server/buildings.api.test.ts`, `tests/server/buildings/repository.test.ts`, `tests/server/buildings/create-with-rooms-repository.test.ts`, `tests/server/buildings/owner-service.test.ts`

**Interfaces:**
- Produces: `BuildingFormData` and `Building` without `ownerName/ownerPhone/ownerEmail`; `buildingCreateSchema`/`buildingUpdateSchema` reject `owner_*` keys.

- [ ] **Step 1: Write the failing tests**

Append to `tests/utils/building-create-with-rooms-validator.test.ts`:

```ts
import { buildingCreateSchema, buildingUpdateSchema } from '~/utils/validators/buildings'

describe('building validators without owner contact', () => {
  it('drops owner_* keys from create and update payloads', () => {
    const parsed = buildingCreateSchema.parse({ name: 'Tòa A', address: '12 Đường Số 1', owner_name: 'X' })
    expect(parsed).not.toHaveProperty('owner_name')
    expect(buildingUpdateSchema.parse({ owner_phone: '0901234567' })).not.toHaveProperty('owner_phone')
  })
})
```

Append to `tests/utils/building-form-mapper.test.ts`:

```ts
it('never emits owner fields', () => {
  const payload = buildingFormToApiPayload(emptyBuildingFormData())
  expect(Object.keys(payload).some(key => key.startsWith('owner_'))).toBe(false)
})
```

(Use the file's existing import names for `buildingFormToApiPayload` and the empty-form factory; if the factory is named differently, import the one defined at `app/utils/mappers/building-form.ts:33-40`.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/utils/building-create-with-rooms-validator.test.ts tests/utils/building-form-mapper.test.ts`
Expected: FAIL — `owner_name` still present.

- [ ] **Step 3: Remove the fields**

- Delete the three `owner_*` lines and the `// Owner/contact` comment from `buildingBaseSchema` (Zod objects strip unknown keys by default, which gives the test behavior).
- Delete `ownerName/ownerPhone/ownerEmail` from `BuildingFormData`, from the three mapper blocks, from `Building` and the create/update input types in `app/types/buildings.ts`, from `mapBuilding`.
- In `server/repositories/buildings/index.ts`, delete the `owner_*` lines in `buildInsertPayload` (119-121) and in `update` (446-448).
- In `BuildingForm.vue`, delete the `owner_*` entries of `FIELD_IDS` and the whole `<UiFormSection title="Chủ sở hữu" …>` block.
- In `create.vue` and `index.vue`, delete the `ownerName/ownerPhone/ownerEmail` initializers.
- In the four server test fixtures, delete the `owner_*`/`owner*` keys.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run tests/utils tests/server/buildings tests/server/buildings.api.test.ts && npm run typecheck`
Expected: PASS; typecheck reports no `owner*` errors. `app/pages/dashboard/buildings/[id]/index.vue:212-214` still reads `building.ownerName` — remove those three `UiDefinitionItem` lines now (Task 9 adds the lessor block).

- [ ] **Step 5: Commit**

```bash
git add app/ server/ tests/
git commit -m "refactor(buildings): stop reading and writing owner contact columns"
```

---

### Task 4: Slim create form and redirect to setup

**Files:**
- Modify: `app/components/buildings/BuildingForm.vue`
- Modify: `app/components/buildings/settings/steps/BasicsStep.vue`, `app/pages/dashboard/buildings/index.vue` (quick edit modal) — pass `variant="basics"`
- Modify: `app/pages/dashboard/buildings/create.vue`
- Modify: `app/composables/buildings/useBuildingForm.ts:47-73`
- Test: `tests/pages/buildings-create-quick-rooms.spec.ts`, `tests/composables/useBuildingForm.create-redirect.test.ts`, `tests/components/buildings/BuildingForm.variant.spec.ts`

**Interfaces:**
- Produces: `BuildingForm` prop `variant?: 'create' | 'basics'` (default `'basics'`); `buildingSetupPath(building: BuildingRouteSubject): string` in `app/utils/routes/operational.ts` returning `${buildingSettingsPath(building)}?setup=1`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/components/buildings/BuildingForm.variant.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const form = readFileSync(resolve(process.cwd(), 'app/components/buildings/BuildingForm.vue'), 'utf8')
const create = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/create.vue'), 'utf8')
const basics = readFileSync(resolve(process.cwd(), 'app/components/buildings/settings/steps/BasicsStep.vue'), 'utf8')

describe('BuildingForm variants', () => {
  it('declares a create/basics variant and hides pricing and schedule for create', () => {
    expect(form).toContain("variant?: 'create' | 'basics'")
    expect(form).toContain('v-if="variant === \'basics\'"')
    expect(form).not.toContain('title="Chủ sở hữu"')
  })

  it('create page uses the create variant; basics step uses the basics variant', () => {
    expect(create).toContain('variant="create"')
    expect(basics).toContain('variant="basics"')
  })
})
```

Replace the second test in `tests/pages/buildings-create-quick-rooms.spec.ts`:

```ts
  it('always shows the rooms block and sends rooms via toPayload', () => {
    expect(page).toContain('useQuickRoomPreview({ enabled: true })')
    expect(page).not.toContain('Bật tạo phòng nhanh')
    expect(page).toContain('preview.toPayload()')
    expect(page).toContain('Bên cho thuê, giá điện nước, thanh toán sẽ thiết lập ở bước tiếp theo.')
  })
```

```ts
// tests/composables/useBuildingForm.create-redirect.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const apiFetch = vi.hoisted(() => vi.fn())
const navigateTo = vi.hoisted(() => vi.fn())
const canManage = vi.hoisted(() => ({ value: true }))
const toastSuccess = vi.hoisted(() => vi.fn())

vi.stubGlobal('apiFetch', apiFetch)
vi.stubGlobal('navigateTo', navigateTo)
vi.stubGlobal('clearNuxtData', vi.fn())
vi.stubGlobal('useAuthStore', () => ({ get canManage() { return canManage.value } }))
vi.stubGlobal('useToast', () => ({ success: toastSuccess, error: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  canManage.value = true
  apiFetch.mockResolvedValue({ data: { id: 'b-1', slug: 'toa-a' } })
})

async function submit() {
  const { useBuildingForm } = await import('~/composables/buildings/useBuildingForm')
  const formData = ref({ name: 'Tòa A', address: '12 Đường Số 1' })
  const { submitCreate } = useBuildingForm({ draftKey: { mode: 'create' }, formData, initialSnapshot: ref({ ...formData.value }) } as never)
  await submitCreate({ name: 'Tòa A', address: '12 Đường Số 1' } as never)
}

describe('useBuildingForm.submitCreate redirect', () => {
  it('goes to settings in setup mode for managers', async () => {
    await submit()
    expect(navigateTo).toHaveBeenCalledWith('/dashboard/buildings/toa-a/settings?setup=1')
    expect(toastSuccess).toHaveBeenCalledWith('Đã tạo tòa nhà. Tiếp tục thiết lập để sẵn sàng cho thuê.')
  })

  it('falls back to the building detail page without manage rights', async () => {
    canManage.value = false
    await submit()
    expect(navigateTo).toHaveBeenCalledWith('/dashboard/buildings/toa-a')
  })
})
```

If `useBuildingForm` imports helpers that need more globals (e.g. `useLocalFormDraft`), mirror the stubs already used by `tests/composables/*useBuildingForm*` or `tests/setup.ts`; check `tests/__mocks__` before adding new ones.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/components/buildings/BuildingForm.variant.spec.ts tests/pages/buildings-create-quick-rooms.spec.ts tests/composables/useBuildingForm.create-redirect.test.ts`
Expected: FAIL on all three files.

- [ ] **Step 3: Implement**

`app/utils/routes/operational.ts`:

```ts
export function buildingSetupPath(building: BuildingRouteSubject): string {
  return `${buildingSettingsPath(building)}?setup=1`
}
```

`BuildingForm.vue`: add the prop and wrap the "Tính phí mặc định" and "Lịch vận hành" `UiFormSection`s:

```ts
const props = withDefaults(defineProps<{
  // ...existing props...
  variant?: 'create' | 'basics'
}>(), {
  // ...existing defaults...
  variant: 'basics',
})
```

```vue
<template v-if="variant === 'basics'">
  <UiFormSection title="Tính phí mặc định" …> … </UiFormSection>
  <UiFormSection title="Lịch vận hành"> … </UiFormSection>
</template>
```

Pass `variant="basics"` in `BasicsStep.vue` and in the list page quick-edit `<BuildingForm>`.

`create.vue`:

```ts
const preview = useQuickRoomPreview({ enabled: true })
const submitLabel = computed(() => {
  const count = preview.toPayload().length
  return count > 0 ? `Tạo tòa nhà và ${count} phòng` : 'Tạo tòa nhà'
})

async function onSubmit(data: BuildingFormData) {
  if (preview.duplicateRoomNumbers.value.length > 0) return
  const rooms = preview.toPayload()
  await submitCreate({
    ...buildingFormToApiPayload(data),
    rooms: rooms.length ? rooms : undefined,
  } as Parameters<typeof submitCreate>[0])
}
```

Template changes: header description `"Khai báo tòa nhà và phòng. Bên cho thuê, giá điện nước, thanh toán sẽ thiết lập ở bước tiếp theo."`; `<BuildingForm variant="create" …>`; in `#extras` replace the checkbox + conditional with:

```vue
<UiFormSection
  title="Phòng"
  description="Tạo luôn các phòng theo tầng. Có thể bỏ trống và thêm phòng sau."
>
  <RoomBatchGenerator :preview="preview" />
</UiFormSection>
```

Check `useQuickRoomPreview.toPayload()` returns `[]` for an untouched generator; if it returns generated defaults instead, add a "Chưa tạo phòng" empty choice by setting the generator's room count input to `0` by default in `useQuickRoomPreview` when `enabled` is passed, and cover it in the page spec.

`useBuildingForm.ts` `submitCreate` success branch:

```ts
      const res = await apiFetch<ApiSuccess<Building>>('/api/buildings', { method: 'POST', body: result.data })
      clearDraft()
      clearNuxtData()
      useToast().success('Đã tạo tòa nhà. Tiếp tục thiết lập để sẵn sàng cho thuê.')
      await navigateTo(useAuthStore().canManage ? buildingSetupPath(res.data) : buildingPath(res.data))
```

Import `buildingPath, buildingSetupPath` from `~/utils/routes/operational`.

- [ ] **Step 4: Verify duplicate action bars**

Run: `grep -n "submitLabel\|Huỷ" app/components/buildings/BuildingForm.vue`
If two button groups render at the same breakpoint (no `sm:hidden` / `hidden sm:flex` split), keep one group; if they are a mobile-docked bar and a desktop bar, leave both. Note the finding in the commit message.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/components/buildings tests/pages/buildings-create-quick-rooms.spec.ts tests/composables/useBuildingForm.create-redirect.test.ts tests/pages/building-settings-setup-flow.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/ tests/
git commit -m "feat(buildings): slim create form and continue into setup mode"
```

---

### Task 5: Setup step model — six steps, locked steps, next-step helpers

**Files:**
- Modify: `app/utils/building-setup-steps.ts`
- Modify: `app/utils/constants/readiness.ts`
- Test: `tests/utils/building-setup-steps.test.ts`

**Interfaces:**
- Produces:
  - `type SetupStepId = 'lessor-profile' | 'contract-terms' | 'basics' | 'invoice-profile' | 'service-defaults' | 'inventory-template'`
  - `SetupStep.locked: boolean` (true when the user cannot view the step; still counted when required)
  - `SetupStepsInput.contractProfile` gains `lessorPhone: string | null`
  - `nextSetupStepId(flow: SetupFlow, currentId: SetupStepId | null): SetupStepId | null`
  - `summarizeRequiredSteps(readiness: BuildingReadiness): { requiredTotal: 4, requiredReady: number, ready: boolean, missingLabels: string[], nextStepId: SetupStepId | null }`
  - `REQUIRED_STEP_FOR_CODE(code: ReadinessCode): SetupStepId`

- [ ] **Step 1: Rewrite the failing tests**

Replace the `deriveSetupSteps` describe block in `tests/utils/building-setup-steps.test.ts` (keep `deriveAdvancedSteps` and `countActiveFinanceRules` tests):

```ts
import { deriveSetupSteps, nextSetupStepId, summarizeRequiredSteps, type SetupStepsInput } from '~/utils/building-setup-steps'
import { READINESS_LABELS } from '~/utils/constants/readiness'

function input(overrides: Partial<SetupStepsInput> = {}): SetupStepsInput {
  return {
    readiness: { contract: ready, billing: ready },
    building: { defaultElectricityRate: 3500, defaultWaterRate: 15000, billingGenerationDay: 1, paymentDueDay: 5 },
    contractProfile: { lessorFullName: 'Nguyen Van QA', lessorPhone: '0901234567', defaultTermMonths: 12, defaultDepositMonths: 1 },
    services: { activeCount: 3, unpricedActiveCount: 0 },
    inventory: { itemCount: 4, totalValue: 7_200_000 },
    canViewContractProfile: true,
    canViewInventory: true,
    ...overrides,
  }
}

const newBuilding = () => input({
  readiness: {
    contract: { ready: false, missing: ['lessor.full_name', 'contract.default_term_months', 'terms.notice_days', 'billing.schedule', 'invoice_profile'] },
    billing: { ready: false, missing: ['billing.schedule', 'billing.electricity_rate', 'invoice_profile'] },
  },
  building: { defaultElectricityRate: null, defaultWaterRate: null, billingGenerationDay: null, paymentDueDay: null },
  contractProfile: null,
  services: { activeCount: 0, unpricedActiveCount: 0 },
  inventory: { itemCount: 0, totalValue: 0 },
})

describe('deriveSetupSteps', () => {
  it('lists six steps in setup order with four required', () => {
    const flow = deriveSetupSteps(input())
    expect(flow.steps.map(s => s.id)).toEqual([
      'lessor-profile', 'contract-terms', 'basics', 'invoice-profile', 'service-defaults', 'inventory-template',
    ])
    expect(flow.steps.filter(s => s.required).map(s => s.id)).toEqual(['lessor-profile', 'contract-terms', 'basics', 'invoice-profile'])
    expect(flow).toMatchObject({ ready: true, requiredTotal: 4, requiredReady: 4, nextStepId: null })
  })

  it('splits lessor and contract codes into their own steps', () => {
    const flow = deriveSetupSteps(newBuilding())
    expect(byId(flow, 'lessor-profile')).toMatchObject({ status: 'missing', missingCount: 1 })
    expect(byId(flow, 'contract-terms')).toMatchObject({ status: 'missing', missingCount: 2 })
    expect(byId(flow, 'basics')).toMatchObject({ status: 'missing', missingCount: 2 })
    expect(flow.nextStepId).toBe('lessor-profile')
  })

  it('summarizes the lessor step with name and phone', () => {
    expect(byId(deriveSetupSteps(input()), 'lessor-profile')!.summary).toBe('Nguyen Van QA · 0901234567')
  })

  it('keeps a contract step the user cannot view as locked and still required', () => {
    const flow = deriveSetupSteps({ ...newBuilding(), canViewContractProfile: false })
    expect(byId(flow, 'lessor-profile')).toMatchObject({ locked: true, required: true })
    expect(byId(flow, 'contract-terms')).toMatchObject({ locked: true, required: true })
    expect(flow.requiredTotal).toBe(4)
    expect(flow.nextStepId).toBe('basics')
  })

  it('hides the inventory step without rooms.read', () => {
    expect(deriveSetupSteps(input({ canViewInventory: false })).steps.map(s => s.id)).not.toContain('inventory-template')
  })
})

describe('nextSetupStepId', () => {
  it('prefers the next missing required step after saving the current one', () => {
    const flow = deriveSetupSteps(newBuilding())
    expect(nextSetupStepId(flow, 'lessor-profile')).toBe('contract-terms')
  })

  it('goes to the next optional step in order once required steps are done', () => {
    const flow = deriveSetupSteps(input({ services: { activeCount: 0, unpricedActiveCount: 0 } }))
    expect(nextSetupStepId(flow, 'invoice-profile')).toBe('service-defaults')
    expect(nextSetupStepId(flow, 'service-defaults')).toBe('inventory-template')
  })

  it('returns null after the last step and when everything is done', () => {
    const flow = deriveSetupSteps(input())
    expect(nextSetupStepId(flow, 'inventory-template')).toBeNull()
    expect(nextSetupStepId(flow, null)).toBeNull()
  })

  it('skips locked steps', () => {
    const flow = deriveSetupSteps({ ...newBuilding(), canViewContractProfile: false })
    expect(nextSetupStepId(flow, null)).toBe('basics')
  })
})

describe('summarizeRequiredSteps', () => {
  it('counts four required steps from readiness alone', () => {
    const summary = summarizeRequiredSteps(newBuilding().readiness)
    expect(summary).toMatchObject({ requiredTotal: 4, requiredReady: 0, ready: false, nextStepId: 'lessor-profile' })
    expect(summary.missingLabels[0]).toBe('Bên cho thuê')
  })

  it('is ready when nothing is missing', () => {
    expect(summarizeRequiredSteps({ contract: ready, billing: ready })).toMatchObject({ requiredReady: 4, ready: true, nextStepId: null })
  })
})

describe('READINESS_LABELS anchors', () => {
  it('points every code at a real step id', () => {
    expect(READINESS_LABELS['lessor.full_name'].anchor).toBe('lessor-profile')
    expect(READINESS_LABELS['contract.default_term_months'].anchor).toBe('contract-terms')
    expect(READINESS_LABELS['terms.notice_days'].anchor).toBe('contract-terms')
    expect(READINESS_LABELS['billing.schedule'].anchor).toBe('basics')
    expect(READINESS_LABELS.invoice_profile.anchor).toBe('invoice-profile')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/utils/building-setup-steps.test.ts`
Expected: FAIL — order still starts with `basics`; `nextSetupStepId` not exported.

- [ ] **Step 3: Implement**

`app/utils/constants/readiness.ts`: change every `lessor.*` anchor to `'lessor-profile'` and every `contract.*` / `terms.*` anchor to `'contract-terms'`.

`app/utils/building-setup-steps.ts` — replace the step-id type, contract input shape, contract step block and add helpers:

```ts
export type SetupStepId = 'lessor-profile' | 'contract-terms' | 'basics' | 'invoice-profile' | 'service-defaults' | 'inventory-template'

export interface SetupStep {
  id: SetupStepId
  label: string
  summary: string
  status: SetupStepStatus
  missingCount: number
  required: boolean
  /** Visible in progress but not openable by this user. */
  locked: boolean
}

// SetupStepsInput.contractProfile:
//   { lessorFullName: string | null; lessorPhone: string | null; defaultTermMonths: number | null; defaultDepositMonths: number | null } | null

const REQUIRED_ORDER: SetupStepId[] = ['lessor-profile', 'contract-terms', 'basics', 'invoice-profile']
const STEP_LABELS: Record<SetupStepId, string> = {
  'lessor-profile': 'Bên cho thuê',
  'contract-terms': 'Điều khoản hợp đồng',
  'basics': 'Thông tin và lịch vận hành',
  'invoice-profile': 'Thanh toán trên hóa đơn',
  'service-defaults': 'Dịch vụ mặc định',
  'inventory-template': 'Nội thất mẫu',
}

export function stepForCode(code: ReadinessCode): SetupStepId {
  if (code.startsWith('lessor.')) return 'lessor-profile'
  if (code.startsWith('contract.') || code.startsWith('terms.')) return 'contract-terms'
  if (code === 'invoice_profile') return 'invoice-profile'
  return 'basics'
}

function codesFor(codes: ReadinessCode[], id: SetupStepId) {
  return codes.filter(code => stepForCode(code) === id)
}

function lessorSummary(input: SetupStepsInput, missing: ReadinessCode[]): string {
  if (!input.canViewContractProfile) return 'Cần chủ tòa hoàn tất'
  if (missing.length > 0) return listMissing(missing)
  const profile = input.contractProfile
  return [profile?.lessorFullName, profile?.lessorPhone].filter(Boolean).join(' · ') || 'Đã thiết lập'
}

function termsSummary(input: SetupStepsInput, missing: ReadinessCode[]): string {
  if (!input.canViewContractProfile) return 'Cần chủ tòa hoàn tất'
  if (missing.length > 0) return `Thiếu ${missing.length} mục`
  const profile = input.contractProfile
  const parts: string[] = []
  if (profile?.defaultTermMonths != null) parts.push(`${profile.defaultTermMonths} tháng`)
  if (profile?.defaultDepositMonths != null) parts.push(`Cọc ${profile.defaultDepositMonths} tháng`)
  return parts.join(' · ') || 'Đã thiết lập'
}

function requiredStep(id: SetupStepId, missing: ReadinessCode[], summary: string, locked: boolean): SetupStep {
  return {
    id, label: STEP_LABELS[id], summary, locked, required: true,
    status: missing.length > 0 ? 'missing' : 'ready',
    missingCount: missing.length,
  }
}
```

Inside `deriveSetupSteps`, build steps in this order:

```ts
  const codes = missingCodes(input.readiness)
  const contractLocked = !input.canViewContractProfile
  const steps: SetupStep[] = [
    requiredStep('lessor-profile', codesFor(codes, 'lessor-profile'), lessorSummary(input, codesFor(codes, 'lessor-profile')), contractLocked),
    requiredStep('contract-terms', codesFor(codes, 'contract-terms'), termsSummary(input, codesFor(codes, 'contract-terms')), contractLocked),
    requiredStep('basics', codesFor(codes, 'basics'), basicsSummary(input, codesFor(codes, 'basics')), false),
    {
      ...requiredStep('invoice-profile', codesFor(codes, 'invoice-profile'), '', false),
      summary: codesFor(codes, 'invoice-profile').length > 0 ? 'Chưa cấu hình' : 'Đã cấu hình nhận diện và tài khoản nhận tiền',
    },
  ]
  // service-defaults and inventory-template blocks: unchanged except `locked: false` and labels from STEP_LABELS.

  const required = steps.filter(step => step.required)
  const requiredReady = required.filter(step => step.status === 'ready').length
  const next = required.find(step => step.status === 'missing' && !step.locked)
  return { steps, requiredTotal: required.length, requiredReady, ready: requiredReady === required.length, nextStepId: next?.id ?? null }
```

Delete `contractSummary` and the old trailing `contract-profile` block.

Add the helpers:

```ts
export function nextSetupStepId(flow: SetupFlow, currentId: SetupStepId | null): SetupStepId | null {
  const open = flow.steps.filter(step => !step.locked)
  const missingRequired = open.find(step => step.required && step.status === 'missing' && step.id !== currentId)
  if (missingRequired) return missingRequired.id
  if (currentId === null) return null
  const index = open.findIndex(step => step.id === currentId)
  return open.slice(index + 1).find(step => !step.required)?.id ?? null
}

export function summarizeRequiredSteps(readiness: BuildingReadiness) {
  const codes = missingCodes(readiness)
  const missingSteps = REQUIRED_ORDER.filter(id => codesFor(codes, id).length > 0)
  return {
    requiredTotal: REQUIRED_ORDER.length,
    requiredReady: REQUIRED_ORDER.length - missingSteps.length,
    ready: missingSteps.length === 0,
    missingLabels: missingSteps.map(id => STEP_LABELS[id]),
    nextStepId: missingSteps[0] ?? null,
  }
}
```

In `settings.vue`, pass `lessorPhone: settings.value?.contractProfile?.lessorPhone ?? null` inside `contractProfile` (full wiring happens in Task 7; this keeps typecheck green).

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/utils/building-setup-steps.test.ts && npm run typecheck`
Expected: PASS. Typecheck may flag `#step-contract-profile` consumers; those are rewired in Tasks 6–7 — if typecheck fails only there, proceed and fix in Task 7.

- [ ] **Step 5: Commit**

```bash
git add app/utils/building-setup-steps.ts app/utils/constants/readiness.ts app/pages/dashboard/buildings/[id]/settings.vue tests/utils/building-setup-steps.test.ts
git commit -m "feat(buildings): six-step setup model with locked steps and next-step helpers"
```

---

### Task 6: Split the contract profile UI into two forms

**Files:**
- Create: `app/components/buildings/BuildingLessorProfileForm.vue`
- Create: `app/components/buildings/BuildingContractTermsForm.vue`
- Create: `app/components/buildings/settings/steps/LessorProfileStep.vue`, `app/components/buildings/settings/steps/ContractTermsStep.vue`
- Delete (after both steps are wired in Task 7): `app/components/buildings/BuildingContractProfileSettings.vue`, `app/components/buildings/settings/steps/ContractStep.vue`
- Create: `app/utils/contracts/contract-term-suggestions.ts`
- Test: `tests/utils/contract-term-suggestions.test.ts`, `tests/pages/building-settings-contract-profile.spec.ts` (rewrite)

**Interfaces:**
- Consumes: `useBuildingContractProfile(...).patch` (Task 2), `BuildingContractProfile.lessorEmail` (Task 2).
- Produces:
  - `CONTRACT_TERM_SUGGESTIONS = { default_term_months: 12, default_deposit_months: 1, notice_days: 30, deposit_refund_days: 7, renewal_months: 6 } as const`
  - `contractTermsInitialValues(profile: BuildingContractProfile | null): ContractTermsFormValues`
  - `BuildingLessorProfileForm` props `{ profile, canEdit, saving, error, submitLabel }`, emits `save: [patch: BuildingContractProfilePatch]`
  - `BuildingContractTermsForm` props `{ profile, building, canEdit, saving, error, submitLabel }`, emits `save: [patch: BuildingContractProfilePatch]`
  - `LessorProfileStep` / `ContractTermsStep` props `{ submitLabel?: string }`, emit `saved: []`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/utils/contract-term-suggestions.test.ts
import { describe, expect, it } from 'vitest'
import { CONTRACT_TERM_SUGGESTIONS, contractTermsInitialValues } from '~/utils/contracts/contract-term-suggestions'

describe('contractTermsInitialValues', () => {
  it('prefills suggestions for an empty profile and leaves fees empty', () => {
    expect(contractTermsInitialValues(null)).toMatchObject({
      ...CONTRACT_TERM_SUGGESTIONS,
      extra_occupant_fee: null, drilling_fee: null, fingerprint_reset_fee: null,
      signed_copies: 2, copies_per_party: 1, brand_name: '',
    })
  })

  it('keeps stored values, including zero, over suggestions', () => {
    const values = contractTermsInitialValues({ noticeDays: 0, renewalMonths: 0, defaultTermMonths: 6 } as never)
    expect(values.notice_days).toBe(0)
    expect(values.renewal_months).toBe(0)
    expect(values.default_term_months).toBe(6)
    expect(values.deposit_refund_days).toBe(7)
  })
})
```

Rewrite `tests/pages/building-settings-contract-profile.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('contract profile split into two steps', () => {
  const lessor = read('app/components/buildings/BuildingLessorProfileForm.vue')
  const terms = read('app/components/buildings/BuildingContractTermsForm.vue')

  it('lessor form holds identity and contact only, including email', () => {
    expect(lessor).toContain('title="Danh tính"')
    expect(lessor).toContain('title="Liên hệ"')
    expect(lessor).toContain('lessor_email')
    expect(lessor).not.toContain('notice_days')
    expect(lessor).not.toContain('khác với thông tin liên hệ chủ nhà')
  })

  it('terms form holds no personal data and starts from suggestions', () => {
    for (const pii of ['lessor_id_number', 'lessor_date_of_birth', 'lessor_permanent_address']) expect(terms).not.toContain(pii)
    expect(terms).toContain('contractTermsInitialValues(')
  })

  it('both forms save through PATCH with only their own keys', () => {
    const lessorStep = read('app/components/buildings/settings/steps/LessorProfileStep.vue')
    const termsStep = read('app/components/buildings/settings/steps/ContractTermsStep.vue')
    expect(lessorStep).toContain('patch(')
    expect(termsStep).toContain('patch(')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/utils/contract-term-suggestions.test.ts tests/pages/building-settings-contract-profile.spec.ts`
Expected: FAIL — files missing.

- [ ] **Step 3: Implement the suggestions helper**

```ts
// app/utils/contracts/contract-term-suggestions.ts
import type { BuildingContractProfile } from '~/types/building-contract-profile'

export const CONTRACT_TERM_SUGGESTIONS = {
  default_term_months: 12,
  default_deposit_months: 1,
  notice_days: 30,
  deposit_refund_days: 7,
  renewal_months: 6,
} as const

export function contractTermsInitialValues(p: BuildingContractProfile | null) {
  return {
    brand_name: p?.brandName ?? '',
    default_term_months: p?.defaultTermMonths ?? CONTRACT_TERM_SUGGESTIONS.default_term_months,
    default_deposit_months: (p?.defaultDepositMonths ?? CONTRACT_TERM_SUGGESTIONS.default_deposit_months) as number | null,
    notice_days: p?.noticeDays ?? CONTRACT_TERM_SUGGESTIONS.notice_days,
    deposit_refund_days: p?.depositRefundDays ?? CONTRACT_TERM_SUGGESTIONS.deposit_refund_days,
    renewal_months: p?.renewalMonths ?? CONTRACT_TERM_SUGGESTIONS.renewal_months,
    extra_occupant_fee: p?.extraOccupantFee ?? null,
    drilling_fee: p?.drillingFee ?? null,
    fingerprint_reset_fee: p?.fingerprintResetFee ?? null,
    signed_copies: p?.signedCopies ?? 2,
    copies_per_party: p?.copiesPerParty ?? 1,
  }
}

export type ContractTermsFormValues = ReturnType<typeof contractTermsInitialValues>
```

- [ ] **Step 4: Build `BuildingLessorProfileForm.vue`**

Move the lessor part of `BuildingContractProfileSettings.vue` (lines 18-24 of `toForm`, the read-only `UiDefinitionList`, the editable lessor grid, `displayIdNumber/displayDob/displayAddress`) into the new component, regrouped:

```vue
<script setup lang="ts">
import type { BuildingContractProfile } from '~/types/building-contract-profile'
import { buildingContractProfileBaseSchema, type BuildingContractProfilePatch } from '~/utils/validators/building-contract-profile'

const props = withDefaults(defineProps<{
  profile: BuildingContractProfile | null
  canEdit: boolean
  saving: boolean
  error: string | null
  submitLabel?: string
}>(), { submitLabel: 'Lưu' })
const emit = defineEmits<{ save: [patch: BuildingContractProfilePatch] }>()

const LESSOR_KEYS = [
  'lessor_full_name', 'lessor_date_of_birth', 'lessor_id_number', 'lessor_id_issued_date',
  'lessor_id_issued_place', 'lessor_phone', 'lessor_email', 'lessor_permanent_address',
] as const
const lessorSchema = buildingContractProfileBaseSchema.pick(Object.fromEntries(LESSOR_KEYS.map(k => [k, true])) as Record<typeof LESSOR_KEYS[number], true>)

const toForm = (p: BuildingContractProfile | null) => ({
  lessor_full_name: p?.lessorFullName ?? '',
  lessor_date_of_birth: p?.lessorDateOfBirth ?? '',
  lessor_id_number: p?.lessorIdentityMasked ? '' : (p?.lessorIdNumber ?? ''),
  lessor_id_issued_date: p?.lessorIdIssuedDate ?? '',
  lessor_id_issued_place: p?.lessorIdIssuedPlace ?? '',
  lessor_phone: p?.lessorPhone ?? '',
  lessor_email: p?.lessorEmail ?? '',
  lessor_permanent_address: p?.lessorPermanentAddress ?? '',
})
const form = reactive(toForm(props.profile))
watch(() => props.profile, value => Object.assign(form, toForm(value)))
const fieldErrors = ref<Record<string, string>>({})

const HIDDEN = 'Ẩn với vai trò quản lý'

function submit() {
  fieldErrors.value = {}
  const result = lessorSchema.safeParse({ ...form })
  if (!result.success) {
    for (const issue of result.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  emit('save', result.data)
}
</script>

<template>
  <div class="space-y-5">
    <UiAlert v-if="error" severity="danger">{{ error }}</UiAlert>
    <template v-if="!canEdit">
      <UiAlert severity="info">Chỉ chủ nhà và admin có thể cập nhật. Số CMND/CCCD được che.</UiAlert>
      <UiDefinitionList>
        <UiDefinitionItem label="Họ tên">{{ profile?.lessorFullName ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Số điện thoại">{{ profile?.lessorPhone ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Email">{{ profile?.lessorEmail ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Ngày sinh">{{ profile?.lessorIdentityMasked ? HIDDEN : (profile?.lessorDateOfBirth ?? '—') }}</UiDefinitionItem>
        <UiDefinitionItem label="Số CMND/CCCD">{{ profile?.lessorIdNumber ?? '—' }}</UiDefinitionItem>
        <UiDefinitionItem label="Địa chỉ thường trú">{{ profile?.lessorIdentityMasked ? HIDDEN : (profile?.lessorPermanentAddress ?? '—') }}</UiDefinitionItem>
      </UiDefinitionList>
    </template>
    <template v-else>
      <UiFormSection title="Danh tính" description="Người ký hợp đồng. Thông tin này in trên hợp đồng.">
        <div class="grid gap-3 sm:grid-cols-2">
          <div data-test="lessor-full-name">
            <UiInput v-model="form.lessor_full_name" label="Họ tên" :error="fieldErrors.lessor_full_name" />
          </div>
          <UiInput v-model="form.lessor_date_of_birth" label="Ngày sinh" type="date" :error="fieldErrors.lessor_date_of_birth" />
          <UiInput v-model="form.lessor_id_number" label="Số CMND/CCCD" :error="fieldErrors.lessor_id_number" />
          <UiInput v-model="form.lessor_id_issued_date" label="Ngày cấp" type="date" :error="fieldErrors.lessor_id_issued_date" />
          <div class="sm:col-span-2">
            <UiInput v-model="form.lessor_id_issued_place" label="Nơi cấp" :error="fieldErrors.lessor_id_issued_place" />
          </div>
        </div>
      </UiFormSection>
      <UiFormSection title="Liên hệ">
        <div class="grid gap-3 sm:grid-cols-2">
          <UiInput v-model="form.lessor_phone" label="Số điện thoại" type="tel" :error="fieldErrors.lessor_phone" />
          <UiInput v-model="form.lessor_email" label="Email (tùy chọn)" type="email" :error="fieldErrors.lessor_email" />
          <div class="sm:col-span-2">
            <UiInput v-model="form.lessor_permanent_address" label="Địa chỉ thường trú" :error="fieldErrors.lessor_permanent_address" />
          </div>
        </div>
      </UiFormSection>
      <div class="flex justify-end border-t border-ui-border pt-4">
        <UiButton data-test="lessor-profile-save" :loading="saving" :disabled="saving" @click="submit">{{ submitLabel }}</UiButton>
      </div>
    </template>
  </div>
</template>
```

`buildingContractProfileBaseSchema` is `.strict()`; `.pick()` keeps strictness, and the picked fields keep their `.default(null)`, so a blank field is sent as `null` (intended: clearing a field in this form clears it).

- [ ] **Step 5: Build `BuildingContractTermsForm.vue`**

Move the rest of `BuildingContractProfileSettings.vue` into it: deposit unit/presets logic (lines 46-81), "Mặc định cho hợp đồng mới", "Điều khoản", "Bản ký", "Lịch thanh toán (chỉ đọc)". Changes:

- `const form = reactive(contractTermsInitialValues(props.profile))` and `watch(() => props.profile, v => Object.assign(form, contractTermsInitialValues(v)))`.
- Validation: `buildingContractProfileBaseSchema.pick({ brand_name: true, default_term_months: true, default_deposit_months: true, notice_days: true, deposit_refund_days: true, renewal_months: true, extra_occupant_fee: true, drilling_fee: true, fingerprint_reset_fee: true, signed_copies: true, copies_per_party: true }).superRefine(contractProfileCopiesRule)`.
- "Bản ký" and "Lịch thanh toán trên hợp đồng (chỉ đọc)" go inside one `<details>` element styled with existing classes (`rounded-lg border border-ui-border`, summary `text-sm font-medium text-ui-primary`), collapsed by default, summary text "Bản ký và lịch thanh toán".
- The "Sửa lịch vận hành" link points to `#basics` (same page) instead of `editPath`; drop the `editPath` prop.
- When `profile` is null or the step is still missing, show above the form: `<UiAlert severity="info">Đã điền sẵn giá trị thường dùng. Xem lại rồi lưu.</UiAlert>` (only if `!profile?.updatedAt`).
- Read-only view (`!canEdit`): `UiDefinitionList` of the same fields.
- Submit button label from `submitLabel` prop, `data-test="contract-terms-save"`.

- [ ] **Step 6: Build the two step wrappers**

```vue
<!-- app/components/buildings/settings/steps/LessorProfileStep.vue -->
<script setup lang="ts">
import type { BuildingContractProfilePatch } from '~/utils/validators/building-contract-profile'

withDefaults(defineProps<{ submitLabel?: string }>(), { submitLabel: 'Lưu' })
const emit = defineEmits<{ saved: [] }>()
const source = useBuildingSettingsSource()
const authStore = useAuthStore()
const toast = useToast()

const { saving, error, patch } = useBuildingContractProfile(source.id, {
  data: computed(() => source.settings.value?.contractProfile ?? null),
  set: (profile) => {
    if (source.settingsData.value) {
      source.settingsData.value = { ...source.settingsData.value, data: { ...source.settingsData.value.data, contractProfile: profile } }
    }
  },
  onSaved: () => source.refresh(),
})

async function onSave(input: BuildingContractProfilePatch) {
  try {
    await patch(input)
    toast.success('Đã lưu bên cho thuê.')
    emit('saved')
  }
  catch { /* error is shown beside the form */ }
}
</script>

<template>
  <BuildingLessorProfileForm
    :profile="source.settings.value?.contractProfile ?? null"
    :can-edit="authStore.can('building-contract-profile.write') && authStore.can('building-contract-profile.pii.read')"
    :saving="saving"
    :error="error"
    :submit-label="submitLabel"
    @save="onSave"
  />
</template>
```

`ContractTermsStep.vue` is identical except: it renders `BuildingContractTermsForm` with `:building="source.building.value"`, `:can-edit="authStore.can('building-contract-profile.write')"`, and the toast is `'Đã lưu điều khoản hợp đồng.'`.

Confirm `building-contract-profile.pii.read` exists in the permission map (`grep -rn "pii.read" app/utils server/utils`); the service already uses it.

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/utils/contract-term-suggestions.test.ts tests/pages/building-settings-contract-profile.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/components/buildings app/utils/contracts/contract-term-suggestions.ts tests/
git commit -m "feat(buildings): split contract profile into lessor and terms forms with suggested terms"
```

---

### Task 7: Settings setup mode

**Files:**
- Create: `app/composables/buildings/useBuildingSetupMode.ts`
- Modify: `app/pages/dashboard/buildings/[id]/settings.vue`
- Modify: `app/components/buildings/settings/SettingsReadinessCard.vue`
- Modify: `app/components/buildings/settings/SettingsStepList.vue`
- Modify: `app/components/buildings/settings/steps/BasicsStep.vue`, `InvoiceProfileStep.vue`, `InventoryStep.vue` (accept `submitLabel`)
- Delete: `app/components/buildings/BuildingContractProfileSettings.vue`, `app/components/buildings/settings/steps/ContractStep.vue`
- Test: `tests/composables/useBuildingSetupMode.test.ts`, `tests/pages/building-settings-setup-flow.spec.ts` (update)

**Interfaces:**
- Consumes: `deriveSetupSteps`, `nextSetupStepId`, `SetupFlow`, `SetupStepId` (Task 5); `LessorProfileStep`, `ContractTermsStep` (Task 6); `buildingPath` (existing).
- Produces:
  - `useBuildingSetupMode(options: { flow: Ref<SetupFlow>, openStep: (id: SetupStepId | null) => void }) => { active: ComputedRef<boolean>, submitLabel: ComputedRef<string>, afterSave: (id: SetupStepId) => void, skip: (id: SetupStepId) => void, exit: () => Promise<void> }`
  - `SettingsReadinessCard` new props `setupMode?: boolean`, `createContractPath: string`, `buildingPath?: string`; emits `exit-setup`
  - `SettingsStepList` renders `step.locked` rows as non-expandable
  - `resolveStepHash(hash: string): string` exported from `app/utils/building-setup-steps.ts` (`'contract-profile' → 'lessor-profile'`, otherwise identity)

- [ ] **Step 1: Write the failing composable test**

```ts
// tests/composables/useBuildingSetupMode.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { deriveSetupSteps } from '~/utils/building-setup-steps'

const route = vi.hoisted(() => ({ query: {} as Record<string, string>, hash: '' }))
const router = vi.hoisted(() => ({ replace: vi.fn() }))
vi.stubGlobal('useRoute', () => route)
vi.stubGlobal('useRouter', () => router)

const missing = { ready: false, missing: ['lessor.full_name', 'terms.notice_days', 'billing.schedule', 'invoice_profile'] as never }
const flow = ref(deriveSetupSteps({
  readiness: { contract: missing, billing: { ready: false, missing: ['billing.schedule', 'invoice_profile'] } },
  building: null, contractProfile: null,
  services: { activeCount: 0, unpricedActiveCount: 0 }, inventory: { itemCount: 0, totalValue: 0 },
  canViewContractProfile: true, canViewInventory: true,
}))

beforeEach(() => {
  vi.clearAllMocks()
  route.query = { setup: '1' }
})

describe('useBuildingSetupMode', () => {
  it('is active only with ?setup=1 and relabels save buttons', async () => {
    const { useBuildingSetupMode } = await import('~/composables/buildings/useBuildingSetupMode')
    const mode = useBuildingSetupMode({ flow, openStep: vi.fn() })
    expect(mode.active.value).toBe(true)
    expect(mode.submitLabel.value).toBe('Lưu và tiếp')

    route.query = {}
    const off = useBuildingSetupMode({ flow, openStep: vi.fn() })
    expect(off.active.value).toBe(false)
    expect(off.submitLabel.value).toBe('Lưu')
  })

  it('opens the next step after saving in setup mode and closes otherwise', async () => {
    const openStep = vi.fn()
    const { useBuildingSetupMode } = await import('~/composables/buildings/useBuildingSetupMode')
    useBuildingSetupMode({ flow, openStep }).afterSave('lessor-profile')
    expect(openStep).toHaveBeenCalledWith('contract-terms')

    route.query = {}
    const closer = vi.fn()
    useBuildingSetupMode({ flow, openStep: closer }).afterSave('lessor-profile')
    expect(closer).toHaveBeenCalledWith(null)
  })

  it('skip moves on without saving; exit drops the query', async () => {
    const openStep = vi.fn()
    const { useBuildingSetupMode } = await import('~/composables/buildings/useBuildingSetupMode')
    const mode = useBuildingSetupMode({ flow, openStep })
    mode.skip('service-defaults')
    expect(openStep).toHaveBeenCalled()
    await mode.exit()
    expect(router.replace).toHaveBeenCalledWith({ query: {}, hash: '' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/composables/useBuildingSetupMode.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the composable**

```ts
// app/composables/buildings/useBuildingSetupMode.ts
import { nextSetupStepId, type SetupFlow, type SetupStepId } from '~/utils/building-setup-steps'

export function useBuildingSetupMode(options: { flow: Ref<SetupFlow>, openStep: (id: SetupStepId | null) => void }) {
  const route = useRoute()
  const router = useRouter()
  const active = computed(() => route.query.setup === '1')
  const submitLabel = computed(() => (active.value ? 'Lưu và tiếp' : 'Lưu'))

  function advance(from: SetupStepId) {
    options.openStep(nextSetupStepId(options.flow.value, from))
  }

  function afterSave(id: SetupStepId) {
    if (active.value) advance(id)
    else options.openStep(null)
  }

  function skip(id: SetupStepId) {
    advance(id)
  }

  async function exit() {
    const { setup: _setup, ...query } = route.query
    await router.replace({ query, hash: '' })
  }

  return { active, submitLabel, afterSave, skip, exit }
}
```

`afterSave` runs after `settingsSource.refresh()` resolves (the step components already await `onSaved`), so `flow` reflects the saved step.

- [ ] **Step 4: Update the page spec (failing)**

In `tests/pages/building-settings-setup-flow.spec.ts` replace the order test and add setup-mode checks:

```ts
  it('has a slot for each step in the new order', () => {
    const order = ['lessor-profile', 'contract-terms', 'basics', 'invoice-profile', 'service-defaults', 'inventory-template']
    const positions = order.map(id => page.indexOf(`<template #step-${id}>`))
    expect(positions.every(position => position > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(page).not.toContain('<ContractStep')
  })

  it('wires setup mode: relabelled saves, skip for optional steps, completion CTA with building_id', () => {
    expect(page).toContain('useBuildingSetupMode(')
    expect(page).toContain(':submit-label="setupMode.submitLabel.value"')
    expect(page).toContain('setupMode.skip(')
    expect(page).toContain('/dashboard/contracts/create?building_id=')
    expect(page).toContain('Thiết lập tòa nhà')
  })

  it('aliases the old contract-profile hash', () => {
    expect(page).toContain('resolveStepHash(')
  })
```

Run: `npx vitest run tests/pages/building-settings-setup-flow.spec.ts` → FAIL.

- [ ] **Step 5: Implement page + cards**

`app/utils/building-setup-steps.ts`:

```ts
const STEP_HASH_ALIASES: Record<string, SetupStepId> = { 'contract-profile': 'lessor-profile' }
export function resolveStepHash(hash: string): string {
  return STEP_HASH_ALIASES[hash] ?? hash
}
```

`settings.vue` script changes:

```ts
import { buildingPath } from '~/utils/routes/operational'
import { deriveSetupSteps, nextSetupStepId, resolveStepHash, type SetupStepId } from '~/utils/building-setup-steps'

// contractProfile input gains lessorPhone:
//   contractProfile: settings.value?.contractProfile
//     ? { ...pick lessorFullName, lessorPhone, defaultTermMonths, defaultDepositMonths }
//     : null,

const setupMode = useBuildingSetupMode({
  flow: setupFlow,
  openStep: (stepId) => {
    requestOpenStep(stepId)
    if (stepId) scrollToStep(stepId)
  },
})

const createContractPath = computed(() => {
  if (!building.value) return '/dashboard/contracts/create'
  const params = new URLSearchParams({ building_id: building.value.id })
  const vacant = settings.value?.vacantRoomIds ?? []
  if (vacant.length === 1) params.set('room_id', vacant[0]!)
  return `/dashboard/contracts/create?${params.toString()}`
})
```

`vacantRoomIds` is added to the bootstrap in Task 8; until then use `settings.value?.vacantRoomIds ?? []` with the optional type added in Task 8 Step 3. Do Task 8 Step 3 (type only) now if typecheck requires it.

In `applyHash`, use `const hash = resolveStepHash(route.hash?.slice(1) ?? '')`.

`handleBasicsSaved` becomes:

```ts
async function handleBasicsSaved() {
  await settingsSource.refresh()
  basicsDirty.value = false
  toast.success('Đã lưu thông tin tòa nhà.')
  setupMode.afterSave('basics')
}
```

Template:

```vue
<UiPageHeader
  :title="setupMode.active.value ? 'Thiết lập tòa nhà' : 'Cài đặt tòa nhà'"
  :description="setupMode.active.value ? `${building?.name ?? ''} · Hoàn tất 4 bước bắt buộc để lập hợp đồng` : building?.name"
  :back-to="building ? buildingPath(building) : `/dashboard/buildings/${id}`"
  back-label="Quay lại tòa nhà"
/>

<SettingsReadinessCard
  :flow="setupFlow"
  :setup-mode="setupMode.active.value"
  :create-contract-path="createContractPath"
  :building-path="building ? buildingPath(building) : undefined"
  @open-step="openStep"
  @exit-setup="setupMode.exit()"
/>

<SettingsStepList :steps="setupFlow.steps" :open-id="openStepId" @update:open-id="requestOpenStep">
  <template #step-lessor-profile>
    <LessorProfileStep :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('lessor-profile')" />
  </template>
  <template #step-contract-terms>
    <ContractTermsStep :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('contract-terms')" />
  </template>
  <template #step-basics>
    <BasicsStep v-if="building" :building="building" :submit-label="setupMode.submitLabel.value"
      @saved="handleBasicsSaved" @cancel="requestOpenStep(null)" @update:dirty="basicsDirty = $event" />
  </template>
  <template #step-invoice-profile>
    <InvoiceProfileStep :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('invoice-profile')" />
  </template>
  <template #step-service-defaults>
    <ServicesStep />
    <div v-if="setupMode.active.value" class="flex justify-end">
      <UiButton size="sm" data-test="setup-services-next" @click="setupMode.skip('service-defaults')">Tiếp</UiButton>
    </div>
  </template>
  <template #step-inventory-template>
    <InventoryStep :template="inventoryTemplate" :building-id="building?.id ?? id" :can-edit="canEditInventoryTemplate"
      :submit-label="setupMode.submitLabel.value" @saved="setupMode.afterSave('inventory-template')" />
    <div v-if="setupMode.active.value" class="flex justify-end">
      <UiButton size="sm" variant="ghost" data-test="setup-inventory-skip" @click="setupMode.skip('inventory-template')">Bỏ qua</UiButton>
    </div>
  </template>
</SettingsStepList>
```

`BasicsStep`, `InvoiceProfileStep`, `InventoryStep`: add `submitLabel?: string` prop (default `'Lưu'`) and pass it to their existing save button / `BuildingForm :submit-label`.

`SettingsReadinessCard.vue`:

```vue
<script setup lang="ts">
import type { SetupFlow, SetupStepId } from '~/utils/building-setup-steps'

const props = withDefaults(defineProps<{
  flow: SetupFlow
  createContractPath: string
  setupMode?: boolean
  buildingPath?: string
}>(), { setupMode: false })
const emit = defineEmits<{ 'open-step': [id: SetupStepId], 'exit-setup': [] }>()
// nextStep and percent unchanged
</script>

<template>
  <UiSurfacePanel as="section" density="compact" data-test="setup-readiness">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold" :class="flow.ready ? 'text-status-success' : 'text-ui-primary'">
          {{ flow.ready ? 'Sẵn sàng lập hợp đồng' : 'Chưa sẵn sàng lập hợp đồng' }}
        </h2>
        <p class="mt-0.5 text-xs text-ui-muted" data-test="setup-progress">
          {{ flow.requiredReady }}/{{ flow.requiredTotal }} bước bắt buộc đã xong
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <template v-if="flow.ready">
          <NuxtLink v-if="setupMode && buildingPath" :to="buildingPath">
            <UiButton size="sm" variant="secondary">Xem tòa nhà</UiButton>
          </NuxtLink>
          <NuxtLink :to="createContractPath" data-test="setup-create-contract">
            <UiButton size="sm">{{ setupMode ? 'Lập hợp đồng đầu tiên' : 'Lập hợp đồng' }}</UiButton>
          </NuxtLink>
        </template>
        <UiButton v-else-if="nextStep" size="sm" data-test="setup-next" @click="emit('open-step', nextStep.id)">
          Tiếp tục: {{ nextStep.label }}
        </UiButton>
        <UiButton v-if="setupMode" size="sm" variant="ghost" data-test="setup-exit" @click="emit('exit-setup')">
          Thoát thiết lập
        </UiButton>
      </div>
    </div>
    <!-- progress bar unchanged -->
  </UiSurfacePanel>
</template>
```

Using `UiButton` inside `NuxtLink` matches the detail page pattern and removes the hand-styled link.

`SettingsStepList.vue`: for `step.locked`, render the header without the toggle button:

```vue
<button
  type="button"
  :disabled="step.locked"
  :aria-disabled="step.locked"
  :class="clsx('flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40', step.locked && 'cursor-not-allowed opacity-70')"
  …
  @click="!step.locked && toggle(step.id)"
>
```

and badge text `'Cần chủ tòa'` when `step.locked` (add to `statusLabel`: `if ('locked' in step && step.locked) return 'Cần chủ tòa'`). `StepListItem` gains optional `locked?: boolean`.

Delete `BuildingContractProfileSettings.vue` and `ContractStep.vue`; remove their imports. Run `grep -rn "BuildingContractProfileSettings\|ContractStep" app tests` and fix remaining references.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/composables/useBuildingSetupMode.test.ts tests/pages/building-settings-setup-flow.spec.ts tests/pages/building-settings-contract-profile.spec.ts tests/utils/building-setup-steps.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/ tests/
git commit -m "feat(buildings): settings setup mode with save-and-next and first-contract CTA"
```

---

### Task 8: Rooms without inventory and vacant rooms in the bootstrap

**Files:**
- Modify: `server/repositories/inventory.ts`
- Modify: `server/services/buildings/settings-bootstrap.ts`
- Modify: `app/types/building-settings.ts`
- Modify: `app/components/buildings/settings/steps/InventoryStep.vue`
- Modify: `app/pages/dashboard/buildings/[id]/rooms/batch.vue`
- Test: `tests/server/inventory/inventory-repository.test.ts`, `tests/server/buildings/settings-bootstrap.test.ts`, `tests/pages/building-inventory-pages.spec.ts`

**Interfaces:**
- Produces:
  - `InventoryRepository.roomOccupancyForSetup(event, buildingId): Promise<{ roomIdsWithoutInventory: string[], vacantRoomIds: string[] }>`
  - `BuildingSettingsBootstrap.roomIdsWithoutInventory: string[]`, `BuildingSettingsBootstrap.vacantRoomIds: string[]`

- [ ] **Step 1: Write the failing repository test**

Append to `tests/server/inventory/inventory-repository.test.ts` (the file mocks `db` with `{ rpc, from }`):

```ts
describe('InventoryRepository.roomOccupancyForSetup', () => {
  function chain(result: unknown) {
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'in']) c[m] = () => c
    c.then = (resolve: (v: unknown) => void) => resolve(result)
    return c
  }

  it('returns rooms with no inventory rows and rooms that are available', async () => {
    from.mockImplementation((table: string) => chain(table === 'rooms'
      ? { data: [{ id: 'r-1', status: 'available' }, { id: 'r-2', status: 'occupied' }, { id: 'r-3', status: 'available' }], error: null }
      : { data: [{ room_id: 'r-2' }], error: null }))
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    const res = await InventoryRepository.roomOccupancyForSetup(event(), 'b-1')
    expect(res).toEqual({ roomIdsWithoutInventory: ['r-1', 'r-3'], vacantRoomIds: ['r-1', 'r-3'] })
  })

  it('skips the inventory query when the building has no rooms', async () => {
    from.mockImplementation(() => chain({ data: [], error: null }))
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    expect(await InventoryRepository.roomOccupancyForSetup(event(), 'b-1')).toEqual({ roomIdsWithoutInventory: [], vacantRoomIds: [] })
    expect(from).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/inventory/inventory-repository.test.ts`
Expected: FAIL — method missing.

- [ ] **Step 3: Implement repository, type and bootstrap**

```ts
// server/repositories/inventory.ts (inside InventoryRepository)
  async roomOccupancyForSetup(event: H3Event, buildingId: string): Promise<{ roomIdsWithoutInventory: string[], vacantRoomIds: string[] }> {
    const { data: rooms, error } = await db(event).from('rooms').select('id, status').eq('building_id', buildingId).neq('status', 'archived')
    if (error) throwDbError(error, 'inventory.roomOccupancyForSetup.rooms')
    const list = (rooms ?? []) as { id: string, status: string }[]
    if (list.length === 0) return { roomIdsWithoutInventory: [], vacantRoomIds: [] }
    const { data: items, error: itemsError } = await db(event).from('room_inventory_items').select('room_id').in('room_id', list.map(r => r.id))
    if (itemsError) throwDbError(itemsError, 'inventory.roomOccupancyForSetup.items')
    const withItems = new Set(((items ?? []) as { room_id: string }[]).map(i => i.room_id))
    return {
      roomIdsWithoutInventory: list.filter(r => !withItems.has(r.id)).map(r => r.id),
      vacantRoomIds: list.filter(r => r.status === 'available').map(r => r.id),
    }
  },
```

`app/types/building-settings.ts`: add `roomIdsWithoutInventory: string[]` and `vacantRoomIds: string[]`.

`server/services/buildings/settings-bootstrap.ts`: import `InventoryRepository` from `'../../repositories/inventory'`; add to `Promise.all`:

```ts
      can(user, 'rooms.read')
        ? InventoryRepository.roomOccupancyForSetup(event, buildingId)
        : Promise.resolve({ roomIdsWithoutInventory: [], vacantRoomIds: [] }),
```

and spread the result into the return object.

In `tests/server/buildings/settings-bootstrap.test.ts`, add `roomOccupancy: vi.fn()` to `mocks`, `vi.mock('../../../server/repositories/inventory', () => ({ InventoryRepository: { roomOccupancyForSetup: mocks.roomOccupancy } }))`, default `mocks.roomOccupancy.mockResolvedValue({ roomIdsWithoutInventory: ['r-1'], vacantRoomIds: ['r-1'] })`, and assert:

```ts
  it('includes rooms without inventory and vacant rooms', async () => {
    const { BuildingSettingsBootstrapService } = await import('../../../server/services/buildings/settings-bootstrap')
    const res = await BuildingSettingsBootstrapService.get({} as never, {} as never, 'toa-a')
    expect(res).toMatchObject({ roomIdsWithoutInventory: ['r-1'], vacantRoomIds: ['r-1'] })
    expect(mocks.roomOccupancy).toHaveBeenCalledWith(expect.anything(), 'building-1')
  })
```

- [ ] **Step 4: Apply suggestion in `InventoryStep.vue`**

Add, below the editor, shown after a successful save when the template has items and `roomIdsWithoutInventory.length > 0`:

```vue
<UiAlert v-if="showApplySuggestion" severity="info" data-test="inventory-apply-suggestion">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <span>{{ pendingRooms.length }} phòng chưa có nội thất.</span>
    <UiButton size="sm" variant="secondary" :loading="applying" @click="applyToPending">
      Áp dụng cho {{ pendingRooms.length }} phòng
    </UiButton>
  </div>
</UiAlert>
```

```ts
const source = useBuildingSettingsSource()
const pendingRooms = computed(() => source.settings.value?.roomIdsWithoutInventory ?? [])
const justSaved = ref(false)
const showApplySuggestion = computed(() => justSaved.value && props.template.items.value.length > 0 && pendingRooms.value.length > 0)
const applying = ref(false)

async function applyToPending() {
  applying.value = true
  try {
    await apiFetch(`/api/buildings/${encodeURIComponent(props.buildingId)}/inventory-template/apply`, {
      method: 'POST',
      body: { room_ids: pendingRooms.value, mode: 'merge' },
    })
    await source.refresh()
    toast.success('Đã áp dụng nội thất mẫu.')
    justSaved.value = false
  }
  catch (e) {
    toast.error(getApiErrorMessage(e, 'Không thể áp dụng nội thất mẫu.'))
  }
  finally {
    applying.value = false
  }
}
```

Set `justSaved.value = true` right before the existing `emit('saved')`. In setup mode `afterSave` would immediately move to the next step and hide the suggestion; to keep it visible, in setup mode emit `saved` only when there are no pending rooms, otherwise wait until the user applies or presses the page-level "Bỏ qua". Check the apply endpoint body field names in `server/api/buildings/[id]/inventory-template/apply.post.ts` and its validator; use those exact names. `apply_inventory_template` caps `room_ids` at 200; if `pendingRooms` exceeds 200, send the first 200 and keep the alert for the remainder.

- [ ] **Step 5: Batch page link**

In `app/pages/dashboard/buildings/[id]/rooms/batch.vue`, change the "Thiết lập nội thất mẫu" link target to `` `${buildingSettingsPath(building)}#inventory-template` `` (use the page's existing building variable). Add to `tests/pages/building-inventory-pages.spec.ts`:

```ts
  it('batch page links straight to the inventory template step', () => {
    expect(read('app/pages/dashboard/buildings/[id]/rooms/batch.vue')).toContain('#inventory-template')
  })
```

(use the spec's existing `read` helper name).

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/server/inventory tests/server/buildings/settings-bootstrap.test.ts tests/pages/building-inventory-pages.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/ app/ tests/
git commit -m "feat(buildings): suggest applying the inventory template to rooms without items"
```

---

### Task 9: Building detail page cleanup

**Files:**
- Create: `app/components/buildings/BuildingSetupStrip.vue`
- Modify: `app/pages/dashboard/buildings/[id]/index.vue`
- Modify: `app/components/buildings/BuildingDetailHero.vue`
- Delete: `app/components/buildings/BuildingReadinessCard.vue`
- Test: `tests/pages/building-detail-setup.spec.ts`

**Interfaces:**
- Consumes: `summarizeRequiredSteps` (Task 5), `buildingSetupPath` (Task 4), `GET /api/buildings/[id]/contract-profile` (existing).
- Produces: `BuildingSetupStrip` props `{ readiness: BuildingReadiness, setupPath: string, createContractPath: string }`.

- [ ] **Step 1: Write the failing spec**

```ts
// tests/pages/building-detail-setup.spec.ts
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const page = read('app/pages/dashboard/buildings/[id]/index.vue')
const strip = read('app/components/buildings/BuildingSetupStrip.vue')

describe('building detail setup and cleanup', () => {
  it('replaces the readiness card with the setup strip', () => {
    expect(existsSync(resolve(process.cwd(), 'app/components/buildings/BuildingReadinessCard.vue'))).toBe(false)
    expect(page).toContain('<BuildingSetupStrip')
    expect(strip).toContain('summarizeRequiredSteps(')
    expect(strip).toContain('Tiếp tục thiết lập')
  })

  it('header actions are Thêm phòng and Cài đặt only', () => {
    expect(page).toContain('>Cài đặt<')
    expect(page).not.toContain('>Chỉnh sửa<')
    expect(page).not.toMatch(/>\s*Dịch vụ\s*</)
  })

  it('shows lessor contact instead of owner contact and does not repeat address or description', () => {
    expect(page).toContain('label="Bên cho thuê"')
    expect(page).not.toContain('ownerName')
    expect(page).not.toContain('label="Địa chỉ" :value="building.address"')
    expect(page).not.toContain('label="Mô tả"')
  })

  it('hero no longer repeats the building name', () => {
    expect(read('app/components/buildings/BuildingDetailHero.vue')).not.toContain('{{ building.name }}')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/pages/building-detail-setup.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the strip**

```vue
<!-- app/components/buildings/BuildingSetupStrip.vue -->
<script setup lang="ts">
import type { BuildingReadiness } from '~/types/building-contract-profile'
import { summarizeRequiredSteps } from '~/utils/building-setup-steps'

const props = defineProps<{ readiness: BuildingReadiness, setupPath: string, createContractPath: string }>()
const summary = computed(() => summarizeRequiredSteps(props.readiness))
</script>

<template>
  <UiSurfacePanel as="section" density="compact" data-test="building-setup-strip">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="min-w-0 text-sm" :class="summary.ready ? 'text-status-success' : 'text-ui-primary'">
        <template v-if="summary.ready">Sẵn sàng lập hợp đồng</template>
        <template v-else>
          Thiết lập {{ summary.requiredReady }}/{{ summary.requiredTotal }}
          <span class="text-ui-muted"> · Còn thiếu: {{ summary.missingLabels.join(', ') }}</span>
        </template>
      </p>
      <NuxtLink :to="summary.ready ? createContractPath : setupPath">
        <UiButton size="sm" :variant="summary.ready ? 'secondary' : 'primary'">
          {{ summary.ready ? 'Lập hợp đồng' : 'Tiếp tục thiết lập' }}
        </UiButton>
      </NuxtLink>
    </div>
  </UiSurfacePanel>
</template>
```

- [ ] **Step 4: Update the detail page and hero**

- Header actions: keep "Thêm phòng"; replace "Dịch vụ" and "Chỉnh sửa" with one `NuxtLink :to="buildingSettingsPath(building)"` + `<UiButton variant="secondary" size="sm">Cài đặt</UiButton>`. Remove the `buildingEditPath` import.
- Replace `<BuildingReadinessCard …/>` with:

```vue
<BuildingSetupStrip
  v-if="readinessData?.data && authStore.canManage"
  class="mt-4"
  :readiness="readinessData.data"
  :setup-path="buildingSetupPath(building)"
  :create-contract-path="`/dashboard/contracts/create?building_id=${building.id}`"
/>
```

- Lessor contact: fetch lazily when allowed:

```ts
const { data: contractProfileData } = useFetch<ApiSuccess<BuildingContractProfile | null>>(
  () => `/api/buildings/${encodeURIComponent(id)}/contract-profile`,
  { lazy: true, server: false, immediate: authStore.can('building-contract-profile.read') },
)
const lessor = computed(() => contractProfileData.value?.data ?? null)
```

- "Thông tin tổng quan" list: keep "Ngày tạo"; remove "Địa chỉ" and "Mô tả" (hero shows them); add

```vue
<UiDefinitionItem v-if="lessor?.lessorFullName" label="Bên cho thuê">
  {{ lessor.lessorFullName }}<span v-if="lessor.lessorPhone" class="text-ui-muted"> · {{ lessor.lessorPhone }}</span><span v-if="lessor.lessorEmail" class="text-ui-muted"> · {{ lessor.lessorEmail }}</span>
</UiDefinitionItem>
```

- The "Quản lý dịch vụ" button in the services panel points to `` `${buildingSettingsPath(building)}#service-defaults` ``.
- `BuildingDetailHero.vue`: delete the `<h2>{{ building.name }}</h2>` line (the page title already shows it); keep address and description.
- Delete `BuildingReadinessCard.vue`; `grep -rn BuildingReadinessCard app tests` must return nothing.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/pages/building-detail-setup.spec.ts tests/pages tests/components/buildings && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/ tests/
git commit -m "feat(buildings): detail page setup strip, lessor contact and trimmed header"
```

---

### Task 10: `BuildingCard` selection padding

**Files:**
- Modify: `app/components/buildings/BuildingCard.vue:46-47`
- Test: `tests/components/buildings/BuildingCard.selection.spec.ts`

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/buildings/BuildingCard.selection.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const card = readFileSync(resolve(process.cwd(), 'app/components/buildings/BuildingCard.vue'), 'utf8')

describe('BuildingCard selection mode', () => {
  it('keeps the checkbox gutter at every breakpoint', () => {
    // `sm:p-4` sets padding-left at sm+, so the gutter must be repeated at sm.
    expect(card).toContain("selectable ? 'pl-12 sm:pl-12' : ''")
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/buildings/BuildingCard.selection.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Change line 47 to `selectable ? 'pl-12 sm:pl-12' : '',`.

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/components/buildings/BuildingCard.selection.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/buildings/BuildingCard.vue tests/components/buildings/BuildingCard.selection.spec.ts
git commit -m "fix(buildings): keep the selection checkbox from covering the card title"
```

---

### Task 11: Contract create — filter rooms by `?building_id=`

**Files:**
- Modify: `app/pages/dashboard/contracts/create.vue`
- Test: `tests/pages/contract-create-page.spec.ts`

**Interfaces:**
- Consumes: `/api/rooms?building_id=` (existing `trimmedOptionalString` in `app/utils/validators/rooms.ts:25`).

- [ ] **Step 1: Write the failing test**

Append to `tests/pages/contract-create-page.spec.ts`:

```ts
  it('filters available rooms by building_id from the query and lets the user clear it', () => {
    expect(page).toContain("const buildingFilter = ref(typeof route.query.building_id === 'string' ? route.query.building_id : '')")
    expect(page).toContain('...(buildingFilter.value ? { building_id: buildingFilter.value } : {})')
    expect(page).toContain('Xem phòng của mọi tòa')
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/pages/contract-create-page.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Below `const route = useRoute()`:

```ts
const buildingFilter = ref(typeof route.query.building_id === 'string' ? route.query.building_id : '')
```

Rooms query:

```ts
  query: computed(() => ({
    available: 'true',
    limit: 200,
    ...(roomSearch.value ? { q: roomSearch.value } : {}),
    ...(buildingFilter.value ? { building_id: buildingFilter.value } : {}),
  })),
```

Under the room `UiCombobox` in the Room section:

```vue
<button
  v-if="buildingFilter"
  type="button"
  class="mt-2 text-xs text-ui-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent/40"
  @click="buildingFilter = ''"
>
  Xem phòng của mọi tòa
</button>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/pages/contract-create-page.spec.ts tests/pages/contract-create-docx.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/pages/dashboard/contracts/create.vue tests/pages/contract-create-page.spec.ts
git commit -m "feat(contracts): filter available rooms by building from the setup CTA"
```

---

### Task 12: Full verification, cloud rollout, docs

**Files:**
- Create: `docs/changes/building-onboarding-v2/verification.md`
- Modify: `docs/changes/building-onboarding-v2/index.md`, `docs/changes/index.md`
- Modify (after acceptance only): `docs/capabilities/buildings-ui.md`, `docs/capabilities/buildings-api.md`
- Modify (after migration applied): `app/types/database.types.ts` (regenerated)

- [ ] **Step 1: Full local suite**

Run: `npm run typecheck && npm test && npm run lint && npm run knowledge:check`
Expected: all pass; lint may keep the pre-existing `AppAiDevChat.vue` `vue/no-v-html` warning.

- [ ] **Step 2: Cloud migration gate (user-approved)**

Ask the user before each production action:

1. `supabase db push --remote --dry-run` → expect only `20261118090000_building_owner_to_lessor.sql`.
2. `supabase db push --remote` after approval.
3. User runs `supabase/verification/building_owner_to_lessor.sql` in the SQL editor; record the three counts.
4. `supabase gen types --remote --schema public`, format with the same prettier flags as the last regeneration (`--no-semi --trailing-comma all --print-width 80`), confirm the only diff is `lessor_email`, then `npm run typecheck`.

- [ ] **Step 3: Browser verification**

On localhost with a fresh test building, at 390, 768 and 1280 px, light and dark:

- Create building with 0 rooms and with 6 rooms → lands on `settings?setup=1`, "Bên cho thuê" open.
- "Lưu và tiếp" walks lessor → terms (prefilled 12/1/30/7/6) → basics → invoice → services ("Tiếp") → inventory ("Bỏ qua" or save + apply suggestion).
- Completion: "Lập hợp đồng đầu tiên" opens contract create filtered to the building; with one vacant room, the room is preselected.
- Leave halfway, open the detail page → strip shows "Thiết lập x/4" and resumes.
- Old link `settings#contract-profile` opens "Bên cho thuê".
- Manager account: lessor step read-only with masked PII; terms step read-only.
- Buildings list selection mode: checkbox does not cover names.
- States: loading bootstrap, save error keeps typed data, saving disables the button, focus-visible on "Lưu và tiếp", reduced motion on step scroll.

Record findings and fixes in `verification.md`.

- [ ] **Step 4: Docs**

Write `verification.md` (OKF frontmatter `type: Verification Record`, `change_state: verification-pending` until accepted). Update `index.md` status. After the user accepts behavior: update `buildings-ui.md` (six-step setup, setup mode, create form, detail strip) and `buildings-api.md` (`PATCH contract-profile`, bootstrap fields, owner fields no longer accepted), set `building-settings-setup-flow` capability text to the 4-required-step model, then move the bundle to `docs/history/<date>-building-onboarding-v2/`.

Run: `npm run knowledge:check` → PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/ app/types/database.types.ts
git commit -m "docs(buildings): onboarding v2 verification and rollout evidence"
```

---

## Spec coverage

| Spec section | Task |
| --- | --- |
| 4.1 `lessor_email` | 1, 2 |
| 4.2 owner → lessor fold | 1 |
| 4.3 stop using `owner_*` | 3 |
| 4.4 partial save | 2 |
| 4.5 permissions | 2, 6, 7 |
| 5 create form + redirect | 3, 4 |
| 6.1 six steps | 5, 7 |
| 6.2 setup mode | 7 |
| 6.3 locked steps | 5, 7 |
| 6.4 inventory apply suggestion | 8 |
| 6.5 helpers + composable | 5, 7 |
| 7 readiness, detail page, `BuildingCard` | 5, 9, 10 |
| 7b UI/UX (split forms, suggestions, create, detail, batch link, contract filter, states) | 4, 6, 8, 9, 11, 12 |
| 8 tests | every task |
| 10 rollout | 12 |
