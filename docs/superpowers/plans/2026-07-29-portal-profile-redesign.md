# Portal Profile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the tenant profile as a compact identity-first dossier and move self-service editing into a dedicated, guarded native-style screen.

**Architecture:** Keep the current tenant bootstrap, profile API, upload APIs, and portal primitives. Add one pure profile-edit mapping utility, one focused unsaved-navigation composable, one presentational dossier component, and one route-level edit page; keep network mutations in the existing portal composables and page orchestration in route files.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript strict, TailwindCSS, Zod 4, Vitest 4, Vue Test Utils, existing `Portal*` components.

## Global Constraints

- Preserve the portal customer-facing theme, Inter typography, semantic tokens, safe areas, and touch-first shell.
- Do not add dependencies, a theme, tokens, fonts, a component library, or a global primitive.
- Do not change the database schema, tenant permissions, `/api/tenant/me`, storage paths, or upload endpoint contracts.
- Do not duplicate room, building, contract, or occupancy data on the profile page.
- Submit only the nine whitelisted profile fields and only when their normalized values changed.
- Client business data continues through `/api/tenant/**`; never query Supabase from browser code.
- Reuse `PortalInput`, `PortalButton`, `PortalCard`, `PortalChip`, `PortalBottomSheet`, `PortalIdentityImageSlot`, `PortalSkeleton`, `PortalEmptyState`, and portal toast behavior.
- Keep Vietnamese source copy fully accented.
- Verify 320, 375, 414, and 768 pixel widths, safe areas, focus visibility, touch targets, overflow, and reduced motion.

---

## File Structure

- Create `app/utils/portal-profile.ts`: pure conversion, normalization, diff, and validation helpers for the profile edit form.
- Create `app/composables/tenant-portal/usePortalUnsavedChanges.ts`: route-leave and browser-unload guard state with a bottom-sheet-friendly interface.
- Create `app/components/portal/PortalProfileDossier.vue`: presentational identity hero and complete textual tenant dossier.
- Modify `app/pages/portal/profile.vue`: route orchestration, header edit action, dossier, identity images, documents, and logout.
- Create `app/pages/portal/profile/edit.vue`: dedicated edit form, save flow, sticky actions, and unsaved-change sheet.
- Create `tests/utils/portal-profile.test.ts`: pure form mapping/diff/validation coverage.
- Create `tests/composables/portal-unsaved-changes.test.ts`: navigation guard resolution coverage.
- Create `tests/components/portal/PortalProfileDossier.spec.ts`: complete-profile, missing-value, and responsive-markup coverage.
- Modify `tests/pages/portal-profile-ui.spec.ts`: assert route-level view/edit separation and portal interaction contracts.
- Modify `openspec/changes/refresh-tenant-portal-ui/tasks.md`: record the new profile redesign tasks and verification.
- Modify `openspec/specs/tenant-portal-ui/spec.md`: specify the dedicated edit route, complete personal dossier, and unsaved-change behavior.
- Modify `docs/features/tenant-portal.md`: document the profile data boundary and edit behavior.

---

### Task 1: Pure Profile Edit Model

**Files:**
- Create: `app/utils/portal-profile.ts`
- Create: `tests/utils/portal-profile.test.ts`

**Interfaces:**
- Consumes: `TenantProfile` and `TenantProfileUpdateInput`.
- Produces:
  - `TenantProfileEditForm`
  - `toTenantProfileEditForm(profile: TenantProfile): TenantProfileEditForm`
  - `buildTenantProfileChanges(current: TenantProfileEditForm, baseline: TenantProfileEditForm): TenantProfileUpdateInput | null`
  - `validateTenantProfileChanges(changes: TenantProfileUpdateInput | null): { data: TenantProfileUpdateInput | null, fieldErrors: Record<string, string[]> }`

- [ ] **Step 1: Write failing form-model tests**

Create `tests/utils/portal-profile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { TenantProfile } from '~/types/tenant-portal'
import {
  buildTenantProfileChanges,
  toTenantProfileEditForm,
  validateTenantProfileChanges,
} from '~/utils/portal-profile'

const profile: TenantProfile = {
  id: 'tenant-1',
  code: 'KH-024',
  status: 'active',
  fullName: 'Nguyễn Thanh Tùng',
  phone: '0901234567',
  email: 'tung@example.com',
  gender: 'male',
  dateOfBirth: '1995-08-12',
  occupation: null,
  permanentAddress: 'Quận 7, TP.HCM',
  idNumber: '079095001234',
  idIssuedDate: '2021-05-10',
  idIssuedPlace: 'Cục CSQLHC',
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
}

describe('portal profile edit model', () => {
  it('maps nullable DTO values to editable strings', () => {
    expect(toTenantProfileEditForm(profile)).toEqual({
      full_name: 'Nguyễn Thanh Tùng',
      phone: '0901234567',
      gender: 'male',
      date_of_birth: '1995-08-12',
      occupation: '',
      permanent_address: 'Quận 7, TP.HCM',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      notes: '',
    })
  })

  it('returns null when normalized values are unchanged', () => {
    const baseline = toTenantProfileEditForm(profile)
    expect(buildTenantProfileChanges({ ...baseline, occupation: '   ' }, baseline)).toBeNull()
  })

  it('returns only changed fields and normalizes optional blanks to null', () => {
    const baseline = toTenantProfileEditForm(profile)
    expect(buildTenantProfileChanges({
      ...baseline,
      phone: ' 0999999999 ',
      permanent_address: '   ',
    }, baseline)).toEqual({
      phone: '0999999999',
      permanent_address: null,
    })
  })

  it('returns field errors for invalid changed values', () => {
    const baseline = toTenantProfileEditForm(profile)
    const changes = buildTenantProfileChanges({ ...baseline, full_name: ' ' }, baseline)
    const result = validateTenantProfileChanges(changes)
    expect(result.data).toBeNull()
    expect(result.fieldErrors.full_name?.[0]).toBe('Họ tên không được trống')
  })
})
```

- [ ] **Step 2: Run the focused test and confirm red**

Run:

```bash
npx vitest run tests/utils/portal-profile.test.ts
```

Expected: FAIL because `~/utils/portal-profile` does not exist.

- [ ] **Step 3: Implement the pure edit model**

Create `app/utils/portal-profile.ts`:

```ts
import type { TenantGender, TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'

export interface TenantProfileEditForm {
  full_name: string
  phone: string
  gender: TenantGender | null
  date_of_birth: string
  occupation: string
  permanent_address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  notes: string
}

const OPTIONAL_TEXT_FIELDS = [
  'occupation',
  'permanent_address',
  'emergency_contact_name',
  'emergency_contact_phone',
  'notes',
] as const

export function toTenantProfileEditForm(profile: TenantProfile): TenantProfileEditForm {
  return {
    full_name: profile.fullName,
    phone: profile.phone,
    gender: profile.gender,
    date_of_birth: profile.dateOfBirth ?? '',
    occupation: profile.occupation ?? '',
    permanent_address: profile.permanentAddress ?? '',
    emergency_contact_name: profile.emergencyContactName ?? '',
    emergency_contact_phone: profile.emergencyContactPhone ?? '',
    notes: profile.notes ?? '',
  }
}

function normalized(form: TenantProfileEditForm): TenantProfileUpdateInput {
  const result: TenantProfileUpdateInput = {
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    gender: form.gender,
    date_of_birth: form.date_of_birth.trim() || null,
  }
  for (const field of OPTIONAL_TEXT_FIELDS) {
    result[field] = form[field].trim() || null
  }
  return result
}

export function buildTenantProfileChanges(
  current: TenantProfileEditForm,
  baseline: TenantProfileEditForm,
): TenantProfileUpdateInput | null {
  const next = normalized(current)
  const previous = normalized(baseline)
  const changes = Object.fromEntries(
    Object.entries(next).filter(([key, value]) => (
      value !== previous[key as keyof TenantProfileUpdateInput]
    )),
  ) as TenantProfileUpdateInput
  return Object.keys(changes).length > 0 ? changes : null
}

export function validateTenantProfileChanges(changes: TenantProfileUpdateInput | null) {
  if (!changes) return { data: null, fieldErrors: {} }
  const parsed = tenantProfileUpdateSchema.safeParse(changes)
  if (parsed.success) return { data: parsed.data, fieldErrors: {} }
  return {
    data: null,
    fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
  }
}
```

- [ ] **Step 4: Run the focused test and confirm green**

Run:

```bash
npx vitest run tests/utils/portal-profile.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the edit model**

```bash
git add app/utils/portal-profile.ts tests/utils/portal-profile.test.ts
git commit -m "feat(portal): add profile edit model"
```

---

### Task 2: Unsaved Navigation Guard

**Files:**
- Create: `app/composables/tenant-portal/usePortalUnsavedChanges.ts`
- Create: `tests/composables/portal-unsaved-changes.test.ts`

**Interfaces:**
- Consumes: `Readonly<Ref<boolean>>` dirty state.
- Produces:
  - `discardOpen: Ref<boolean>`
  - `guardRouteLeave(): true | Promise<boolean>`
  - `keepEditing(): void`
  - `discardChanges(): void`
  - `allowNextLeave(): void`
  - `onDiscardSheetUpdate(open: boolean): void`
  - `onBeforeUnload(event: BeforeUnloadEvent): void`

- [ ] **Step 1: Write failing guard tests**

Create `tests/composables/portal-unsaved-changes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { usePortalUnsavedChanges } from '~/composables/tenant-portal/usePortalUnsavedChanges'

describe('usePortalUnsavedChanges', () => {
  it('allows clean navigation immediately', () => {
    const guard = usePortalUnsavedChanges(ref(false))
    expect(guard.guardRouteLeave()).toBe(true)
    expect(guard.discardOpen.value).toBe(false)
  })

  it('blocks dirty navigation until the tenant confirms discard', async () => {
    const guard = usePortalUnsavedChanges(ref(true))
    const decision = guard.guardRouteLeave()
    expect(guard.discardOpen.value).toBe(true)
    guard.discardChanges()
    await expect(decision).resolves.toBe(true)
  })

  it('keeps the tenant on the form when the sheet closes', async () => {
    const guard = usePortalUnsavedChanges(ref(true))
    const decision = guard.guardRouteLeave()
    guard.onDiscardSheetUpdate(false)
    await expect(decision).resolves.toBe(false)
  })

  it('marks hard refresh as unsafe only while dirty', () => {
    const dirty = ref(true)
    const guard = usePortalUnsavedChanges(dirty)
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    guard.onBeforeUnload(event)
    expect(event.defaultPrevented).toBe(true)
    dirty.value = false
    const cleanEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    guard.onBeforeUnload(cleanEvent)
    expect(cleanEvent.defaultPrevented).toBe(false)
  })
})
```

- [ ] **Step 2: Run the guard test and confirm red**

Run:

```bash
npx vitest run tests/composables/portal-unsaved-changes.test.ts
```

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement the guard state**

Create `app/composables/tenant-portal/usePortalUnsavedChanges.ts`:

```ts
import type { Ref } from 'vue'

export function usePortalUnsavedChanges(dirty: Readonly<Ref<boolean>>) {
  const discardOpen = ref(false)
  let resolveLeave: ((allow: boolean) => void) | null = null
  let bypassOnce = false

  function resolvePending(allow: boolean) {
    const resolve = resolveLeave
    resolveLeave = null
    discardOpen.value = false
    resolve?.(allow)
  }

  function guardRouteLeave(): true | Promise<boolean> {
    if (bypassOnce) {
      bypassOnce = false
      return true
    }
    if (!dirty.value) return true
    discardOpen.value = true
    return new Promise<boolean>((resolve) => {
      resolveLeave = resolve
    })
  }

  function keepEditing() {
    resolvePending(false)
  }

  function discardChanges() {
    resolvePending(true)
  }

  function allowNextLeave() {
    bypassOnce = true
  }

  function onDiscardSheetUpdate(open: boolean) {
    if (open) discardOpen.value = true
    else keepEditing()
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value || bypassOnce) return
    event.preventDefault()
    event.returnValue = ''
  }

  return {
    discardOpen,
    guardRouteLeave,
    keepEditing,
    discardChanges,
    allowNextLeave,
    onDiscardSheetUpdate,
    onBeforeUnload,
  }
}
```

- [ ] **Step 4: Run the guard test and confirm green**

Run:

```bash
npx vitest run tests/composables/portal-unsaved-changes.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the guard**

```bash
git add app/composables/tenant-portal/usePortalUnsavedChanges.ts tests/composables/portal-unsaved-changes.test.ts
git commit -m "feat(portal): guard unsaved profile changes"
```

---

### Task 3: Identity-First Dossier Component

**Files:**
- Create: `app/components/portal/PortalProfileDossier.vue`
- Create: `tests/components/portal/PortalProfileDossier.spec.ts`

**Interfaces:**
- Consumes: `profile: TenantProfile`.
- Produces: a presentational identity hero, complete personal/contact/emergency/notes surface, and read-only verified identity surface.
- Does not fetch, mutate, navigate, or own upload behavior.

- [ ] **Step 1: Write failing dossier tests**

Create `tests/components/portal/PortalProfileDossier.spec.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TenantProfile } from '~/types/tenant-portal'
import PortalProfileDossier from '~/components/portal/PortalProfileDossier.vue'

const profile: TenantProfile = {
  id: 'tenant-1',
  code: 'KH-024',
  status: 'active',
  fullName: 'Nguyễn Thanh Tùng',
  phone: '0901234567',
  email: 'tung@example.com',
  gender: 'male',
  dateOfBirth: '1995-08-12',
  occupation: 'Kỹ sư',
  permanentAddress: 'Quận 7, TP.HCM',
  idNumber: '079095001234',
  idIssuedDate: '2021-05-10',
  idIssuedPlace: 'Cục CSQLHC',
  emergencyContactName: 'Nguyễn Văn B',
  emergencyContactPhone: '0912345678',
  notes: 'Liên hệ ngoài giờ hành chính.',
}

const stubs = {
  PortalCard: { template: '<section><slot /></section>' },
  PortalChip: { template: '<span><slot /></span>' },
}

describe('PortalProfileDossier', () => {
  it('renders every tenant profile field without housing data', () => {
    const wrapper = mount(PortalProfileDossier, {
      props: { profile },
      global: { stubs },
    })
    for (const value of [
      profile.fullName,
      profile.code,
      profile.phone,
      profile.email,
      'Nam',
      '12/08/1995',
      profile.occupation,
      profile.permanentAddress,
      profile.idNumber,
      '10/05/2021',
      profile.idIssuedPlace,
      profile.emergencyContactName,
      profile.emergencyContactPhone,
      profile.notes,
    ]) {
      expect(wrapper.text()).toContain(value)
    }
    expect(wrapper.text()).not.toContain('Phòng')
    expect(wrapper.text()).not.toContain('Hợp đồng')
  })

  it('uses an explicit missing-value label', () => {
    const wrapper = mount(PortalProfileDossier, {
      props: { profile: { ...profile, occupation: null, notes: null } },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Chưa cập nhật')
  })

  it('labels verified identity as read-only management data', () => {
    const wrapper = mount(PortalProfileDossier, {
      props: { profile },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('Định danh đã xác minh')
    expect(wrapper.text()).toContain('Liên hệ ban quản lý')
    expect(wrapper.find('input').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the dossier test and confirm red**

Run:

```bash
npx vitest run tests/components/portal/PortalProfileDossier.spec.ts
```

Expected: FAIL because `PortalProfileDossier.vue` does not exist.

- [ ] **Step 3: Implement the dossier component**

Create `app/components/portal/PortalProfileDossier.vue` with:

```vue
<script setup lang="ts">
import type { TenantGender, TenantProfile } from '~/types/tenant-portal'

const props = defineProps<{ profile: TenantProfile }>()

const genderLabels: Record<TenantGender, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
}

const missing = 'Chưa cập nhật'
const valueOf = (value: string | null | undefined) => value?.trim() || missing
const dateOf = (value: string | null) => {
  if (!value) return missing
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
const initials = computed(() => {
  const words = props.profile.fullName.trim().split(/\s+/)
  return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toUpperCase()
})
const statusLabel = computed(() => props.profile.status === 'active' ? 'Đang thuê' : 'Đã lưu trữ')
</script>

<template>
  <div class="space-y-5">
    <PortalCard>
      <div class="flex min-w-0 items-center gap-4">
        <span class="flex size-16 shrink-0 items-center justify-center rounded-full bg-smoke-blue portal-type-heading text-theme">
          {{ initials }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="portal-type-heading break-words text-title">{{ profile.fullName }}</p>
          <p class="portal-type-caption mt-1 break-all text-body">{{ profile.code }} · {{ valueOf(profile.email) }}</p>
          <PortalChip class="mt-2" :tone="profile.status === 'active' ? 'success' : 'neutral'">
            {{ statusLabel }}
          </PortalChip>
        </div>
      </div>
    </PortalCard>

    <section aria-labelledby="profile-personal-heading">
      <h2 id="profile-personal-heading" class="portal-type-heading mb-2 px-1 text-title">Hồ sơ cá nhân</h2>
      <PortalCard :padded="false">
        <div
          v-for="(group, groupIndex) in personalGroups"
          :key="group.title"
          :class="groupIndex > 0 ? 'border-t border-border-light' : undefined"
        >
          <h3 class="bg-smoke px-4 py-2 portal-type-label text-body">{{ group.title }}</h3>
          <dl class="divide-y divide-border-light">
            <div
              v-for="[label, value] in group.rows"
              :key="label"
              class="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(7rem,40%)_minmax(0,1fr)] sm:gap-4"
            >
              <dt class="portal-type-caption text-body">{{ label }}</dt>
              <dd class="min-w-0 whitespace-pre-line break-words portal-type-body font-medium text-title sm:text-right">
                {{ value }}
              </dd>
            </div>
          </dl>
        </div>
      </PortalCard>
    </section>

    <section aria-labelledby="profile-identity-heading">
      <h2 id="profile-identity-heading" class="portal-type-heading mb-2 px-1 text-title">Định danh đã xác minh</h2>
      <PortalCard :padded="false">
        <p class="border-b border-border-light bg-smoke px-4 py-3 portal-type-caption text-body">
          Thông tin này do ban quản lý xác minh. Liên hệ ban quản lý nếu cần điều chỉnh.
        </p>
        <dl class="divide-y divide-border-light">
          <div
            v-for="[label, value] in identityRows"
            :key="label"
            class="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(7rem,40%)_minmax(0,1fr)] sm:gap-4"
          >
            <dt class="portal-type-caption text-body">{{ label }}</dt>
            <dd class="min-w-0 break-words portal-type-body font-medium text-title sm:text-right">
              {{ value }}
            </dd>
          </div>
        </dl>
      </PortalCard>
    </section>
  </div>
</template>
```

Define the two explicit row collections before the template:

```ts
const personalGroups = computed(() => [
  {
    title: 'Thông tin cá nhân',
    rows: [
      ['Họ và tên', props.profile.fullName],
      ['Giới tính', props.profile.gender ? genderLabels[props.profile.gender] : missing],
      ['Ngày sinh', dateOf(props.profile.dateOfBirth)],
      ['Nghề nghiệp', valueOf(props.profile.occupation)],
    ],
  },
  {
    title: 'Liên hệ',
    rows: [
      ['Số điện thoại', props.profile.phone],
      ['Email', valueOf(props.profile.email)],
      ['Địa chỉ thường trú', valueOf(props.profile.permanentAddress)],
    ],
  },
  {
    title: 'Liên hệ khẩn cấp',
    rows: [
      ['Người liên hệ', valueOf(props.profile.emergencyContactName)],
      ['Số điện thoại', valueOf(props.profile.emergencyContactPhone)],
    ],
  },
  {
    title: 'Ghi chú',
    rows: [['Nội dung', valueOf(props.profile.notes)]],
  },
])

const identityRows = computed(() => [
  ['Số CCCD/CMND', valueOf(props.profile.idNumber)],
  ['Ngày cấp', dateOf(props.profile.idIssuedDate)],
  ['Nơi cấp', valueOf(props.profile.idIssuedPlace)],
])
```

- [ ] **Step 4: Run the dossier test and confirm green**

Run:

```bash
npx vitest run tests/components/portal/PortalProfileDossier.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the dossier**

```bash
git add app/components/portal/PortalProfileDossier.vue tests/components/portal/PortalProfileDossier.spec.ts
git commit -m "feat(portal): add profile dossier"
```

---

### Task 4: Redesign the Profile View Route

**Files:**
- Modify: `app/pages/portal/profile.vue`
- Modify: `tests/pages/portal-profile-ui.spec.ts`

**Interfaces:**
- Consumes: `PortalProfileDossier`, `usePortalProfile`, `usePortalIdentityImages`, `usePortalDocuments`, `usePortalToast`, and `useAuth`.
- Produces: `/portal/profile` as a view-only personal dossier with media/document management and a header link to `/portal/profile/edit`.

- [ ] **Step 1: Replace inline-edit assertions with route-separation assertions**

Update `tests/pages/portal-profile-ui.spec.ts` to name the existing route source explicitly:

```ts
const viewPage = readFileSync(resolve('app/pages/portal/profile.vue'), 'utf8')
```

For the view route, assert:

```ts
it('renders the dossier and routes editing to a dedicated screen', () => {
  expect(viewPage).toContain('<PortalProfileDossier :profile="profile"')
  expect(viewPage).toContain('<Teleport to="#portal-header-action">')
  expect(viewPage).toContain('to="/portal/profile/edit"')
  expect(viewPage).not.toContain('mode === \'view\'')
  expect(viewPage).not.toContain('@submit.prevent="onSave"')
})

it('keeps identity images, documents, and logout on the profile view', () => {
  expect(viewPage).toContain('<PortalIdentityImageSlot')
  expect(viewPage).toContain('docs.documents.value')
  expect(viewPage).toContain('Đăng xuất')
})
```

Keep the upload progress, file-input, keyboard focus, loading, and error assertions, but point them
to `viewPage`. Move edit-form assertions to Task 5.

- [ ] **Step 2: Run the page test and confirm red**

Run:

```bash
npx vitest run tests/pages/portal-profile-ui.spec.ts
```

Expected: FAIL because the view route still contains inline edit mode.

- [ ] **Step 3: Refactor `profile.vue` into view-only orchestration**

Remove:

- `mode`
- `form`
- `openEdit`
- `cancelEdit`
- `toggleGender`
- `normalize`
- `onSave`
- inline detail section construction
- inline edit form template

Keep the upload/document/logout functions. Because `PortalButton` renders only `<button>`, implement
the header action with a `NuxtLink` using the existing portal button visual contract instead of
adding a one-use `to` prop:

```vue
<NuxtLink
  v-if="profileStatus === 'success' && profile"
  to="/portal/profile/edit"
  class="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-theme px-3 text-sm font-semibold text-[color:var(--portal-bg)] transition-colors hover:bg-theme/90 active:bg-theme/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40 motion-reduce:transition-none"
>
  <IconPencilSquare class="h-4 w-4" aria-hidden="true" />
  Chỉnh sửa
</NuxtLink>
```

Render the loaded content in this order:

```vue
<PortalProfileDossier :profile="profile" />
<section aria-labelledby="profile-identity-images-heading" class="space-y-3">
  <h2 id="profile-identity-images-heading" class="portal-type-heading px-1 text-title">
    Ảnh định danh
  </h2>
  <PortalCard class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <PortalIdentityImageSlot
      label="Mặt trước"
      :signed-url="identity.images.value.frontSignedUrl"
      :uploading="identity.uploading.value.front"
      :progress="identity.progress.value.front"
      @select="file => onIdentitySelect('front', file)"
      @remove="onIdentityRemove('front')"
      @error="toast.error"
    />
    <PortalIdentityImageSlot
      label="Mặt sau"
      :signed-url="identity.images.value.backSignedUrl"
      :uploading="identity.uploading.value.back"
      :progress="identity.progress.value.back"
      @select="file => onIdentitySelect('back', file)"
      @remove="onIdentityRemove('back')"
      @error="toast.error"
    />
  </PortalCard>
</section>
<section aria-labelledby="profile-documents-heading" class="space-y-3">
  <div class="flex items-center justify-between gap-3 px-1">
    <h2 id="profile-documents-heading" class="portal-type-heading text-title">Tài liệu</h2>
    <PortalButton variant="ghost" size="sm" :loading="docs.uploading.value" @click="pickDocument">
      <IconPlus class="h-4 w-4" aria-hidden="true" />
      Tải lên
    </PortalButton>
  </div>
  <progress
    v-if="docs.uploading.value"
    class="portal-progress"
    :value="docs.progress.value"
    max="100"
  >
    {{ docs.progress.value }}%
  </progress>
  <PortalSkeleton v-if="docs.status.value === 'pending'" variant="card" class="h-20" />
  <PortalEmptyState
    v-else-if="docs.error.value"
    tone="error"
    title="Không tải được tài liệu"
    action-label="Thử lại"
    @action="docs.refresh"
  />
  <PortalCard v-else-if="docs.documents.value.length === 0">
    <p class="portal-type-body text-body">Chưa có tài liệu nào.</p>
  </PortalCard>
  <PortalCard v-else :padded="false">
    <ul class="divide-y divide-border-light">
      <li v-for="document in docs.documents.value" :key="document.id" class="flex min-h-14 items-center gap-3 px-4 py-3">
        <a :href="document.signedUrl" target="_blank" rel="noopener" class="min-w-0 flex-1">
          <p class="truncate portal-type-body font-medium text-title">{{ document.name }}</p>
          <p class="portal-type-caption text-body">{{ formatBytes(document.size) }}</p>
        </a>
        <PortalButton
          variant="ghost"
          size="md"
          icon-only
          aria-label="Xóa tài liệu"
          @click="onDocumentRemove(document.id)"
        >
          <IconTrash class="h-4 w-4" aria-hidden="true" />
        </PortalButton>
      </li>
    </ul>
  </PortalCard>
</section>
<PortalButton variant="ghost" block class="text-portal-danger" @click="onLogout">
  <IconLogOut class="h-4 w-4" aria-hidden="true" />
  Đăng xuất
</PortalButton>
```

Use `sm:grid-cols-2` for the two identity slots. Keep document rows at 44 pixels or taller. Keep the
single hidden native file input and all existing MIME/size checks.

- [ ] **Step 4: Run focused profile tests**

Run:

```bash
npx vitest run tests/pages/portal-profile-ui.spec.ts tests/components/portal/PortalProfileDossier.spec.ts tests/components/portal/PortalIdentityImageSlot.spec.ts
```

Expected: all tests PASS except edit-route assertions intentionally added in Task 5.

- [ ] **Step 5: Commit the profile view**

```bash
git add app/pages/portal/profile.vue tests/pages/portal-profile-ui.spec.ts
git commit -m "feat(portal): redesign profile dossier view"
```

---

### Task 5: Dedicated Profile Edit Route

**Files:**
- Create: `app/pages/portal/profile/edit.vue`
- Modify: `tests/pages/portal-profile-ui.spec.ts`
- Modify: `tests/composables/tenant-portal.test.ts`

**Interfaces:**
- Consumes:
  - `toTenantProfileEditForm`
  - `buildTenantProfileChanges`
  - `validateTenantProfileChanges`
  - `usePortalUnsavedChanges`
  - `usePortalProfile.save(input): Promise<boolean>`
- Produces: `/portal/profile/edit` with changed-only save, field errors, optimistic reconciliation, sticky actions, and guarded navigation.

- [ ] **Step 1: Add failing edit-route assertions**

Add the edit route source beside `viewPage`, then append the assertions:

```ts
const editPage = readFileSync(resolve('app/pages/portal/profile/edit.vue'), 'utf8')
```

```ts
it('uses a dedicated edit route with the nine whitelisted fields', () => {
  expect(editPage).toContain("setChrome({ title: 'Chỉnh sửa hồ sơ', back: '/portal/profile' })")
  expect(editPage.match(/<PortalInput/g)).toHaveLength(8)
  expect(editPage).toContain('GENDER_OPTIONS')
  expect(editPage).toContain(':aria-pressed="form.gender === option.value"')
  expect(editPage).not.toContain('v-model="form.email"')
  expect(editPage).not.toContain('v-model="form.id_number"')
})

it('shares save state between header and sticky actions', () => {
  expect(editPage).toContain('<Teleport to="#portal-header-action">')
  expect(editPage).toContain('@submit.prevent="onSave"')
  expect(editPage).toContain(':disabled="!canSave"')
  expect(editPage).toContain('portal-safe-bottom')
})

it('guards dirty navigation with a portal bottom sheet', () => {
  expect(editPage).toContain('onBeforeRouteLeave(guard.guardRouteLeave)')
  expect(editPage).toContain("window.addEventListener('beforeunload', guard.onBeforeUnload)")
  expect(editPage).toContain('<PortalBottomSheet')
  expect(editPage).toContain('Bỏ thay đổi?')
  expect(editPage).toContain('Tiếp tục chỉnh sửa')
  expect(editPage).toContain('Bỏ thay đổi')
})
```

Extend the existing `usePortalProfile` test:

```ts
it('sends a changed-only whitelist payload through PATCH /api/tenant/me', async () => {
  fetchData = { data: { profile: baseProfile, contract: null, invoices: [], invoiceMeta: {} } }
  fetchMock.mockResolvedValue({ data: { ...baseProfile, occupation: null } })
  const { usePortalProfile } = await import('../../app/composables/tenant-portal/usePortalProfile')
  const { save } = usePortalProfile()
  await save({ occupation: null })
  expect(fetchMock).toHaveBeenCalledWith('/api/tenant/me', {
    method: 'PATCH',
    body: { occupation: null },
  })
})
```

- [ ] **Step 2: Run the edit-related tests and confirm red**

Run:

```bash
npx vitest run tests/pages/portal-profile-ui.spec.ts tests/composables/tenant-portal.test.ts
```

Expected: page test FAIL because `app/pages/portal/profile/edit.vue` does not exist.

- [ ] **Step 3: Create the dedicated edit page**

Create `app/pages/portal/profile/edit.vue` with this script structure:

```vue
<script setup lang="ts">
import type { TenantGender } from '~/types/tenant-portal'
import type { TenantProfileEditForm } from '~/utils/portal-profile'
import {
  buildTenantProfileChanges,
  toTenantProfileEditForm,
  validateTenantProfileChanges,
} from '~/utils/portal-profile'

definePageMeta({
  layout: 'tenant',
  pageTransition: { name: 'portal-page', mode: 'out-in' },
})

const { setChrome } = usePortalChrome()
setChrome({ title: 'Chỉnh sửa hồ sơ', back: '/portal/profile' })

const toast = usePortalToast()
const {
  profile,
  status: profileStatus,
  error: profileError,
  refresh,
  save,
  saving,
  apiError,
} = usePortalProfile()

const baseline = ref<TenantProfileEditForm | null>(null)
const form = reactive<TenantProfileEditForm>({
  full_name: '',
  phone: '',
  gender: null,
  date_of_birth: '',
  occupation: '',
  permanent_address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
})
const fieldErrors = ref<Record<string, string[]>>({})

watch(profile, (value) => {
  if (!value || baseline.value) return
  const initial = toTenantProfileEditForm(value)
  Object.assign(form, initial)
  baseline.value = initial
}, { immediate: true })

const changes = computed(() => baseline.value
  ? buildTenantProfileChanges(form, baseline.value)
  : null)
const validation = computed(() => validateTenantProfileChanges(changes.value))
const dirty = computed(() => changes.value !== null)
const canSave = computed(() => (
  dirty.value
  && !saving.value
  && validation.value.data !== null
))

const guard = usePortalUnsavedChanges(dirty)
onBeforeRouteLeave(guard.guardRouteLeave)
onMounted(() => window.addEventListener('beforeunload', guard.onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', guard.onBeforeUnload))

const GENDER_OPTIONS: Array<{ value: TenantGender, label: string }> = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

async function onSave() {
  fieldErrors.value = validation.value.fieldErrors
  if (!validation.value.data) return
  const ok = await save(validation.value.data)
  if (!ok) return
  guard.allowNextLeave()
  toast.success('Đã cập nhật hồ sơ.')
  await navigateTo('/portal/profile')
}

function cancelEdit() {
  void navigateTo('/portal/profile')
}
</script>
```

The template must:

- render `PortalSkeleton` while bootstrap is pending
- render `PortalEmptyState` with retry for bootstrap error/missing profile
- teleport a small `Lưu` `PortalButton` into `#portal-header-action`
- use one `<form @submit.prevent="onSave">`
- render the eight `PortalInput` instances and one gender segmented control
- show the read-only login/identity management notice
- show `apiError` with `role="alert"`
- render a sticky `portal-safe-bottom` action surface with `Hủy` and `Lưu thay đổi`
- render `PortalBottomSheet` with explicit continuation/discard actions

Use:

```vue
<PortalBottomSheet
  :model-value="guard.discardOpen.value"
  title="Bỏ thay đổi?"
  @update:model-value="guard.onDiscardSheetUpdate"
>
  <p class="portal-type-body text-body">Các thay đổi hồ sơ chưa lưu sẽ bị mất.</p>
  <div class="mt-5 grid gap-3 sm:grid-cols-2">
    <PortalButton variant="secondary" block @click="guard.keepEditing">
      Tiếp tục chỉnh sửa
    </PortalButton>
    <PortalButton variant="danger" block @click="guard.discardChanges">
      Bỏ thay đổi
    </PortalButton>
  </div>
</PortalBottomSheet>
```

- [ ] **Step 4: Run all focused profile tests**

Run:

```bash
npx vitest run tests/utils/portal-profile.test.ts tests/composables/portal-unsaved-changes.test.ts tests/composables/tenant-portal.test.ts tests/components/portal/PortalProfileDossier.spec.ts tests/components/portal/PortalIdentityImageSlot.spec.ts tests/pages/portal-profile-ui.spec.ts
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the edit route**

```bash
git add app/pages/portal/profile/edit.vue tests/pages/portal-profile-ui.spec.ts tests/composables/tenant-portal.test.ts
git commit -m "feat(portal): add dedicated profile edit flow"
```

---

### Task 6: OpenSpec, Documentation, and Verification

**Files:**
- Modify: `openspec/changes/refresh-tenant-portal-ui/tasks.md`
- Modify: `openspec/specs/tenant-portal-ui/spec.md`
- Modify: `docs/features/tenant-portal.md`

**Interfaces:**
- Consumes: the completed dossier and edit flow from Tasks 1–5.
- Produces: accepted behavior documentation and verification evidence.

- [ ] **Step 1: Add the accepted requirement scenarios**

Append to the profile requirement in `openspec/specs/tenant-portal-ui/spec.md`:

```markdown
#### Scenario: Complete personal dossier
- **WHEN** a tenant opens `/portal/profile`
- **THEN** the portal shows every field in the tenant profile DTO, identity images, and tenant documents
- **AND** missing optional values are identified as not yet updated
- **AND** room, building, contract, and occupancy details are not duplicated

#### Scenario: Dedicated self-service edit screen
- **WHEN** a tenant chooses `Chỉnh sửa`
- **THEN** the portal opens `/portal/profile/edit`
- **AND** only the nine whitelisted self-service fields are editable
- **AND** the update payload contains only normalized changed fields

#### Scenario: Unsaved profile changes
- **WHEN** a tenant attempts in-app navigation with unsaved profile changes
- **THEN** a portal bottom sheet offers to continue editing or discard the changes
- **AND** closing the sheet preserves the form
```

- [ ] **Step 2: Update active tasks and feature documentation**

Append this section to `openspec/changes/refresh-tenant-portal-ui/tasks.md`:

```markdown
## 8. Tenant profile dossier and dedicated edit flow

- [x] 8.1 Redesign `/portal/profile` as an identity-first dossier without room or contract duplication
- [x] 8.2 Add `/portal/profile/edit` with changed-only whitelist submission and shared save state
- [x] 8.3 Guard dirty navigation with a portal bottom sheet and browser unload protection
- [x] 8.4 Verify focused tests, portal regression, typecheck, lint, OpenSpec, responsive widths, and reduced motion
```

Add to `docs/features/tenant-portal.md` under data boundaries:

```markdown
## Profile experience

`/portal/profile` is the complete personal dossier and does not repeat housing or contract data.
The tenant edits the nine self-service fields on `/portal/profile/edit`; email and verified identity
fields remain read-only. The client sends only normalized changed fields. In-app navigation with
dirty values requires explicit discard confirmation, while hard refresh and tab close use the
browser unload guard.
```

- [ ] **Step 3: Validate OpenSpec**

Run:

```bash
openspec validate refresh-tenant-portal-ui --strict
```

Expected: change `refresh-tenant-portal-ui` is valid.

- [ ] **Step 4: Run narrow and broad automated verification**

Run:

```bash
npx vitest run tests/utils/portal-profile.test.ts tests/composables/portal-unsaved-changes.test.ts tests/composables/tenant-portal.test.ts tests/components/portal/PortalProfileDossier.spec.ts tests/components/portal/PortalIdentityImageSlot.spec.ts tests/pages/portal-profile-ui.spec.ts
npm run typecheck
npx vitest run tests/components tests/pages
npm run lint
```

Expected:

- focused profile tests PASS
- typecheck exits 0
- component/page portal tests PASS
- lint exits 0

- [ ] **Step 5: Run the visual polish pass**

Start the existing project only after explicit user approval if no local runtime is already running.
Use the in-app browser against `/portal/profile` and `/portal/profile/edit`.

Verify:

- 320, 375, 414, and 768 pixel widths
- light and dark portal themes
- populated and missing optional values
- bootstrap loading/error/retry
- identity images empty/populated/uploading/error
- documents empty/populated/uploading/error
- clean, dirty, invalid, saving, API-error, success, and unsaved-exit form states
- keyboard focus order and visible rings
- no horizontal scroll or action-bar overlap
- reduced-motion behavior

Fix every material hierarchy, spacing, copy, overflow, focus, or touch-target finding, then rerun the
focused tests and typecheck.

- [ ] **Step 6: Commit docs and final polish**

```bash
git add openspec/changes/refresh-tenant-portal-ui/tasks.md openspec/specs/tenant-portal-ui/spec.md docs/features/tenant-portal.md app tests
git commit -m "docs(portal): specify profile dossier flow"
```
