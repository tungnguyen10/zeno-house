---
type: Change Implementation Plan
title: "tenant-quick-create-implementation-plan"
status: draft
change_state: plan-review
tags: [superpowers, change, tenants, contracts, v2]
---

# Tenant Quick Create (V2 PR3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pick an existing tenant or quick-create one inline (name + phone, optional ID fields) from contract creation and occupant flows, reusing change B duplicate handling.

**Architecture:** Client-only. `TenantPicker` wraps `UiCombobox` (`remoteSearch`, `allowCustom`) against `GET /api/tenants?q=`. `TenantQuickCreateDialog` posts to `POST /api/tenants` via `useTenantQuickCreate`, which classifies change B 409 responses. `ContractForm`, `ContractOccupantForm` and `contracts/create.vue` swap their preloaded comboboxes for the picker; `create.vue` resolves `room_id` given as a room code.

**Tech Stack:** Nuxt 3, Vue 3, Zod, Vitest, @vue/test-utils.

**Spec:** [design.md](./design.md)

## Global Constraints

- No backend, API or migration changes.
- No tenant PII in `localStorage`/`sessionStorage`; dialog state cleared on close.
- Reuse `tenantCreateSchema`, `normalizeTenantPhone`, `getApiErrorCode`, `getApiErrorDetails`, `getApiErrorMessage`.
- Out-of-scope duplicate message must be shown verbatim from the server (change B).
- "Thêm khách mới" only with `tenants.create`.
- Vietnamese copy with full diacritics.
- UI: existing primitives; `frontend-design` + Hallmark per `.agents/skills/zeno-house/references/ui-polish-workflow.md`; new tokens/primitives only after evaluation + approval.

## Review Focus

1. **Contract draft restored with a `tenant_id` not in the first search page** — picker must still display the tenant's name. Pinned in Task 3.
2. **Double-click "Lưu" or two tabs** — second response is `TENANT_DUPLICATE`; dialog lands on "Dùng khách này", not a generic error. Pinned in Task 2.
3. **Search string like `0901 234 567`** — prefilled into phone, not name. Pinned in Task 3.
4. **Manager opens picker** — no "Thêm khách mới" row. Pinned in Task 3.
5. **`/dashboard/contracts/create?room_id=<code>`** — room preselected; unknown code leaves room empty without error. Pinned in Task 5.

---

### Task 1: `TenantSummary` type + `useTenantQuickCreate`

**Files:**
- Modify: `app/types/tenants.ts`
- Create: `app/composables/tenants/useTenantQuickCreate.ts`
- Test: `tests/composables/useTenantQuickCreate.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TenantSummary = Pick<Tenant, 'id' | 'code' | 'fullName' | 'phone'>
  export type QuickCreateResult =
    | { kind: 'created'; tenant: TenantSummary }
    | { kind: 'duplicate'; existingTenantId: string; fields: ('phone' | 'id_number')[] }
    | { kind: 'conflict'; message: string }
    | { kind: 'error'; message: string; fieldErrors?: Record<string, string[]> }
  export function useTenantQuickCreate(): { submitting: Ref<boolean>; submit(input: TenantCreateInput): Promise<QuickCreateResult> }
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/composables/useTenantQuickCreate.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

const input = { full_name: 'Nguyễn Văn A', phone: '0901234567' } as never

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

describe('useTenantQuickCreate', () => {
  it('returns created summary', async () => {
    fetchMock.mockResolvedValue({ data: { id: 't-1', code: 'kt-1', fullName: 'Nguyễn Văn A', phone: '0901234567', status: 'active' } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    const res = await useTenantQuickCreate().submit(input)
    expect(res).toEqual({ kind: 'created', tenant: { id: 't-1', code: 'kt-1', fullName: 'Nguyễn Văn A', phone: '0901234567' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants', expect.objectContaining({ method: 'POST', body: input }))
  })

  it('classifies TENANT_DUPLICATE', async () => {
    fetchMock.mockRejectedValue({ statusCode: 409, data: { error: { code: 'TENANT_DUPLICATE', message: 'x', details: { existingTenantId: 't-9', fieldErrors: { phone: ['x'] } } } } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    expect(await useTenantQuickCreate().submit(input)).toEqual({ kind: 'duplicate', existingTenantId: 't-9', fields: ['phone'] })
  })

  it('passes through generic identity conflict message', async () => {
    fetchMock.mockRejectedValue({ statusCode: 409, data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' } } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    expect(await useTenantQuickCreate().submit(input)).toEqual({ kind: 'conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' })
  })

  it('returns field errors on 422', async () => {
    fetchMock.mockRejectedValue({ statusCode: 422, data: { error: { code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ', details: { fieldErrors: { phone: ['Số điện thoại không hợp lệ'] } } } } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    const res = await useTenantQuickCreate().submit(input)
    expect(res).toMatchObject({ kind: 'error', fieldErrors: { phone: ['Số điện thoại không hợp lệ'] } })
  })

  it('never writes to localStorage', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    fetchMock.mockResolvedValue({ data: { id: 't-1', code: 'c', fullName: 'A', phone: 'p', status: 'active' } })
    const { useTenantQuickCreate } = await import('~/composables/tenants/useTenantQuickCreate')
    await useTenantQuickCreate().submit(input)
    expect(spy).not.toHaveBeenCalled()
  })
})
```

Before writing, confirm the exact code string used for out-of-scope conflicts in `server/services/tenants/identity-conflict.ts` (e.g. `TENANT_IDENTITY_CONFLICT`) and use it in the test; the composable treats any 409 other than `TENANT_DUPLICATE` as `conflict`.

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/composables/useTenantQuickCreate.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Add to `app/types/tenants.ts`:

```ts
export type TenantSummary = Pick<Tenant, 'id' | 'code' | 'fullName' | 'phone'>
```

```ts
// app/composables/tenants/useTenantQuickCreate.ts
import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantSummary } from '~/types/tenants'
import type { TenantCreateInput } from '~/utils/validators/tenants'
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from '~/utils/api-error'

export type QuickCreateResult =
  | { kind: 'created'; tenant: TenantSummary }
  | { kind: 'duplicate'; existingTenantId: string; fields: ('phone' | 'id_number')[] }
  | { kind: 'conflict'; message: string }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string[]> }

export function toTenantSummary(tenant: Tenant): TenantSummary {
  return { id: tenant.id, code: tenant.code, fullName: tenant.fullName, phone: tenant.phone }
}

export function useTenantQuickCreate() {
  const submitting = ref(false)

  async function submit(input: TenantCreateInput): Promise<QuickCreateResult> {
    submitting.value = true
    try {
      const res = await apiFetch<ApiSuccess<Tenant>>('/api/tenants', { method: 'POST', body: input })
      return { kind: 'created', tenant: toTenantSummary(res.data) }
    }
    catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      const code = getApiErrorCode(error) as string | undefined
      if (code === 'TENANT_DUPLICATE') {
        const details = getApiErrorDetails<{ existingTenantId: string; fieldErrors?: Record<string, string[]> }>(error)!
        return {
          kind: 'duplicate',
          existingTenantId: details.existingTenantId,
          fields: Object.keys(details.fieldErrors ?? {}) as ('phone' | 'id_number')[],
        }
      }
      if (status === 409) return { kind: 'conflict', message: getApiErrorMessage(error) }
      const details = getApiErrorDetails<{ fieldErrors?: Record<string, string[]> }>(error)
      return {
        kind: 'error',
        message: getApiErrorMessage(error, 'Không thể tạo khách thuê. Vui lòng thử lại.'),
        fieldErrors: details?.fieldErrors,
      }
    }
    finally {
      submitting.value = false
    }
  }

  return { submitting, submit }
}
```

If `apiFetch` rethrows a normalized error without `statusCode`, read the status the way `app/utils/api-fetch.ts` exposes it and adjust.

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/types/tenants.ts app/composables/tenants/useTenantQuickCreate.ts tests/composables/useTenantQuickCreate.test.ts
git commit -m "feat(tenants): quick create composable with duplicate classification"
```

---

### Task 2: `TenantQuickCreateDialog` (UI polish gate)

**Files:**
- Create: `app/components/tenants/TenantQuickCreateDialog.vue`
- Test: `tests/components/tenants/TenantQuickCreateDialog.test.ts`

**Interfaces:**
- Props: `{ open: boolean; initialName?: string; initialPhone?: string }`
- Emits: `created: [tenant: TenantSummary]`, `close: []`

- [ ] **Step 1: UI polish workflow** — read `.agents/skills/zeno-house/references/ui-polish-workflow.md`; apply `frontend-design` + Hallmark to dialog layout, collapsed section, duplicate card, mobile fullscreen. Record decisions in `docs/changes/tenant-quick-create/verification.md` → "UI decisions".

- [ ] **Step 2: Write the failing test**

```ts
// tests/components/tenants/TenantQuickCreateDialog.test.ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const submit = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('~/composables/tenants/useTenantQuickCreate', async (orig) => ({
  ...(await orig<typeof import('~/composables/tenants/useTenantQuickCreate')>()),
  useTenantQuickCreate: () => ({ submitting: ref(false), submit }),
}))
vi.stubGlobal('$fetch', fetchMock)

import TenantQuickCreateDialog from '~/components/tenants/TenantQuickCreateDialog.vue'

const mountDialog = (props = {}) => mount(TenantQuickCreateDialog, { props: { open: true, ...props }, attachTo: document.body })

beforeEach(() => vi.clearAllMocks())

describe('TenantQuickCreateDialog', () => {
  it('prefills and keeps ID section collapsed', () => {
    const w = mountDialog({ initialPhone: '0901234567' })
    expect((w.find('[data-test="qc-phone"] input').element as HTMLInputElement).value).toBe('0901234567')
    expect(w.find('[data-test="qc-id-number"]').exists()).toBe(false)
  })

  it('blocks submit without name', async () => {
    const w = mountDialog({ initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    expect(submit).not.toHaveBeenCalled()
    expect(w.text()).toContain('Họ tên không được trống')
  })

  it('emits created on success', async () => {
    submit.mockResolvedValue({ kind: 'created', tenant: { id: 't-1', code: 'c', fullName: 'A', phone: '0901234567' } })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    expect(w.emitted('created')![0]![0]).toMatchObject({ id: 't-1' })
  })

  it('offers existing tenant on duplicate and disables when busy', async () => {
    submit.mockResolvedValue({ kind: 'duplicate', existingTenantId: 't-9', fields: ['phone'] })
    fetchMock.mockResolvedValue({ data: { id: 't-9', code: 'kt-9', fullName: 'Trần B', phone: '0901234567', status: 'active', hasActiveContract: true } })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Trần B')
    expect(w.find('[data-test="qc-use-existing"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Khách đang ở theo hợp đồng khác')
  })

  it('uses existing tenant when free', async () => {
    submit.mockResolvedValue({ kind: 'duplicate', existingTenantId: 't-9', fields: ['id_number'] })
    fetchMock.mockResolvedValue({ data: { id: 't-9', code: 'kt-9', fullName: 'Trần B', phone: '0909', status: 'active', hasActiveContract: false } })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="qc-use-existing"]').trigger('click')
    expect(w.emitted('created')![0]![0]).toEqual({ id: 't-9', code: 'kt-9', fullName: 'Trần B', phone: '0909' })
  })

  it('shows generic conflict without action', async () => {
    submit.mockResolvedValue({ kind: 'conflict', message: 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên' })
    const w = mountDialog({ initialName: 'A', initialPhone: '0901234567' })
    await w.find('[data-test="qc-submit"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('liên hệ quản trị viên')
    expect(w.find('[data-test="qc-use-existing"]').exists()).toBe(false)
  })

  it('resets state when closed and reopened', async () => {
    const w = mountDialog({ initialName: 'A' })
    await w.setProps({ open: false })
    await w.setProps({ open: true, initialName: '' })
    expect((w.find('[data-test="qc-name"] input').element as HTMLInputElement).value).toBe('')
  })
})
```

If `UiModal` teleports, query via `document.body` (follow existing modal component tests).

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement**

Script core:

```ts
<script setup lang="ts">
import type { Tenant, TenantSummary } from '~/types/tenants'
import { tenantCreateSchema } from '~/utils/validators/tenants'
import { toTenantSummary, useTenantQuickCreate } from '~/composables/tenants/useTenantQuickCreate'

const props = defineProps<{ open: boolean; initialName?: string; initialPhone?: string }>()
const emit = defineEmits<{ created: [tenant: TenantSummary]; close: [] }>()

const blank = () => ({
  full_name: props.initialName ?? '', phone: props.initialPhone ?? '',
  id_number: '', date_of_birth: '', id_issued_date: '', id_issued_place: '', permanent_address: '',
})
const form = reactive(blank())
const showIdentity = ref(false)
const fieldErrors = ref<Record<string, string>>({})
const stage = ref<'form' | 'duplicate' | 'conflict'>('form')
const message = ref<string | null>(null)
const existing = ref<Tenant | null>(null)
const { submitting, submit } = useTenantQuickCreate()

watch(() => props.open, (open) => {
  if (!open) return
  Object.assign(form, blank())
  showIdentity.value = false
  fieldErrors.value = {}
  stage.value = 'form'
  message.value = null
  existing.value = null
})

const existingBusy = computed(() => Boolean(existing.value?.hasActiveContract || existing.value?.activeAssignment))

async function onSubmit() {
  fieldErrors.value = {}
  message.value = null
  const nullIfEmpty = (v: string) => (v.trim() === '' ? null : v.trim())
  const parsed = tenantCreateSchema.safeParse({
    full_name: form.full_name.trim(), phone: form.phone,
    id_number: nullIfEmpty(form.id_number), date_of_birth: nullIfEmpty(form.date_of_birth),
    id_issued_date: nullIfEmpty(form.id_issued_date), id_issued_place: nullIfEmpty(form.id_issued_place),
    permanent_address: nullIfEmpty(form.permanent_address),
  })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors.value[String(issue.path[0])] = issue.message
    return
  }
  const result = await submit(parsed.data)
  if (result.kind === 'created') emit('created', result.tenant)
  else if (result.kind === 'duplicate') {
    stage.value = 'duplicate'
    const res = await apiFetch<{ data: Tenant }>(`/api/tenants/${result.existingTenantId}`)
    existing.value = res.data
  }
  else if (result.kind === 'conflict') { stage.value = 'conflict'; message.value = result.message }
  else {
    message.value = result.message
    for (const [k, v] of Object.entries(result.fieldErrors ?? {})) fieldErrors.value[k] = v[0]!
  }
}

function useExisting() {
  if (existing.value && !existingBusy.value) emit('created', toTenantSummary(existing.value))
}
</script>
```

Template requirements: `UiModal :open="open" title="Thêm khách mới" mobile-fullscreen @close="emit('close')"`; `data-test` hooks `qc-name`, `qc-phone` (`inputmode="tel"`), `qc-id-number` (`inputmode="numeric"`, only rendered when `showIdentity`), `qc-submit`, `qc-use-existing`; toggle button "Thông tin giấy tờ (không bắt buộc)"; duplicate card shows `existing.fullName`, `existing.phone`, `existing.code`, field text ("Số điện thoại" / "Số CCCD") and the busy reason; conflict stage shows `UiAlert severity="warning"` with `message` and only a "Đóng" button.

- [ ] **Step 5: Run tests** → PASS.

- [ ] **Step 6: Commit**

```bash
git add app/components/tenants/TenantQuickCreateDialog.vue tests/components/tenants/TenantQuickCreateDialog.test.ts docs/changes/tenant-quick-create/verification.md
git commit -m "feat(tenants): quick create dialog with duplicate handling"
```

---

### Task 3: `TenantPicker`

**Files:**
- Create: `app/components/tenants/TenantPicker.vue`
- Test: `tests/components/tenants/TenantPicker.test.ts`

**Interfaces:**
- Props: `{ modelValue: string | null; label?: string; excludeTenantIds?: string[]; excludeContractId?: string; disabled?: boolean; error?: string; required?: boolean; id?: string }`
- Emits: `update:modelValue: [id: string | null]`, `selected: [tenant: TenantSummary | null]`
- Exposes for tests: `search(q: string)` is internal; tests drive via `UiCombobox` events.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/tenants/TenantPicker.test.ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.mock('~/stores/auth', () => ({ useAuthStore: () => ({ can }) }))

import TenantPicker from '~/components/tenants/TenantPicker.vue'

const t = (id: string, fullName: string, phone = '0900000000') => ({ id, code: id, fullName, phone, status: 'active' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  can.mockReturnValue(true)
  fetchMock.mockResolvedValue({ data: [t('t-1', 'An'), t('t-2', 'Bình')] })
})

async function typeQuery(w: ReturnType<typeof mount>, q: string) {
  w.findComponent({ name: 'UiCombobox' }).vm.$emit('search', q)
  vi.advanceTimersByTime(260)
  await flushPromises()
}

describe('TenantPicker', () => {
  it('searches server-side with debounce and excludes ids', async () => {
    const w = mount(TenantPicker, { props: { modelValue: null, excludeTenantIds: ['t-2'] } })
    await typeQuery(w, 'an')
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants', expect.objectContaining({ query: expect.objectContaining({ q: 'an', available: true, limit: 20 }) }))
    expect(w.findComponent({ name: 'UiCombobox' }).props('options').map((o: { id: string }) => o.id)).toEqual(['t-1'])
  })

  it('hides quick create without tenants.create', async () => {
    can.mockReturnValue(false)
    const w = mount(TenantPicker, { props: { modelValue: null } })
    expect(w.findComponent({ name: 'UiCombobox' }).props('allowCustom')).toBe(false)
  })

  it('opens dialog with phone prefilled for phone-like query', async () => {
    const w = mount(TenantPicker, { props: { modelValue: null } })
    const combo = w.findComponent({ name: 'UiCombobox' })
    const option = combo.props('createOption')('0901 234 567')
    combo.vm.$emit('update:modelValue', option)
    await flushPromises()
    const dialog = w.findComponent({ name: 'TenantQuickCreateDialog' })
    expect(dialog.props()).toMatchObject({ open: true, initialPhone: '0901 234 567', initialName: '' })
  })

  it('opens dialog with name prefilled otherwise and selects created tenant', async () => {
    const w = mount(TenantPicker, { props: { modelValue: null } })
    const combo = w.findComponent({ name: 'UiCombobox' })
    combo.vm.$emit('update:modelValue', combo.props('createOption')('Nguyễn Văn A'))
    await flushPromises()
    const dialog = w.findComponent({ name: 'TenantQuickCreateDialog' })
    expect(dialog.props('initialName')).toBe('Nguyễn Văn A')
    dialog.vm.$emit('created', { id: 't-9', code: 'c', fullName: 'Nguyễn Văn A', phone: '0901234567' })
    await flushPromises()
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['t-9'])
    expect(w.emitted('selected')!.at(-1)![0]).toMatchObject({ id: 't-9' })
  })

  it('loads summary for a preset id not in results (draft restore)', async () => {
    fetchMock.mockImplementation(async (url: string) => (url === '/api/tenants/t-7' ? { data: t('t-7', 'Chi') } : { data: [] }))
    const w = mount(TenantPicker, { props: { modelValue: 't-7' } })
    await flushPromises()
    expect(w.findComponent({ name: 'UiCombobox' }).props('modelValue')).toMatchObject({ id: 't-7', fullName: 'Chi' })
  })
})
```

Check `UiCombobox`'s event name for search text when `remoteSearch` is on (e.g. `search` / `update:query`) and use it in the test and component.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
<script setup lang="ts">
import type { ApiSuccess } from '~/types/api'
import type { Tenant, TenantSummary } from '~/types/tenants'
import { normalizeTenantPhone } from '~/utils/tenant-identity'
import { toTenantSummary } from '~/composables/tenants/useTenantQuickCreate'

const NEW_ID = '__new__'

const props = withDefaults(defineProps<{
  modelValue: string | null
  label?: string
  excludeTenantIds?: string[]
  excludeContractId?: string
  disabled?: boolean
  error?: string
  required?: boolean
  id?: string
}>(), { label: 'Khách thuê', excludeTenantIds: () => [] })
const emit = defineEmits<{ 'update:modelValue': [id: string | null]; selected: [tenant: TenantSummary | null] }>()

const authStore = useAuthStore()
const canCreate = computed(() => authStore.can('tenants.create'))
const results = ref<TenantSummary[]>([])
const loading = ref(false)
const selected = ref<TenantSummary | null>(null)
const dialog = reactive({ open: false, name: '', phone: '' })
let timer: ReturnType<typeof setTimeout> | undefined

const options = computed(() => {
  const excluded = new Set(props.excludeTenantIds)
  return results.value.filter(o => !excluded.has(o.id))
})

async function runSearch(q: string) {
  loading.value = true
  try {
    const res = await apiFetch<ApiSuccess<Tenant[]>>('/api/tenants', {
      query: { q: q || undefined, available: true, limit: 20, excludeContractId: props.excludeContractId || undefined },
    })
    results.value = res.data.map(toTenantSummary)
  }
  finally {
    loading.value = false
  }
}

function onSearch(q: string) {
  clearTimeout(timer)
  timer = setTimeout(() => runSearch(q), 250)
}

watch(() => props.modelValue, async (id) => {
  if (!id) { selected.value = null; return }
  if (selected.value?.id === id) return
  const hit = results.value.find(r => r.id === id)
  if (hit) { selected.value = hit; return }
  const res = await apiFetch<ApiSuccess<Tenant>>(`/api/tenants/${id}`)
  selected.value = toTenantSummary(res.data)
}, { immediate: true })

function createOption(query: string): TenantSummary {
  return { id: NEW_ID, code: '', fullName: query, phone: '' }
}

function onChoose(option: TenantSummary | null) {
  if (option?.id === NEW_ID) {
    const isPhone = normalizeTenantPhone(option.fullName) !== null
    dialog.name = isPhone ? '' : option.fullName
    dialog.phone = isPhone ? option.fullName : ''
    dialog.open = true
    return
  }
  select(option)
}

function select(tenant: TenantSummary | null) {
  selected.value = tenant
  emit('update:modelValue', tenant?.id ?? null)
  emit('selected', tenant)
}

function onCreated(tenant: TenantSummary) {
  dialog.open = false
  select(tenant)
}

onMounted(() => runSearch(''))
</script>

<template>
  <div>
    <UiCombobox
      :id="id"
      :model-value="selected"
      :options="options"
      :option-key="o => o.id"
      :option-label="o => `${o.fullName} — ${o.phone}`"
      :label="label"
      placeholder="Tìm và chọn khách thuê..."
      search-placeholder="Tìm theo tên hoặc số điện thoại..."
      remote-search
      :allow-custom="canCreate"
      :create-option="createOption"
      custom-option-label="Thêm khách mới:"
      :loading="loading"
      :disabled="disabled"
      :required="required"
      :error="error"
      empty-message="Không tìm thấy khách thuê"
      @search="onSearch"
      @update:model-value="onChoose"
    />
    <TenantQuickCreateDialog
      :open="dialog.open"
      :initial-name="dialog.name"
      :initial-phone="dialog.phone"
      @created="onCreated"
      @close="dialog.open = false"
    />
  </div>
</template>
```

- [ ] **Step 4: Run tests** → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/components/tenants/TenantPicker.vue tests/components/tenants/TenantPicker.test.ts
git commit -m "feat(tenants): server-search tenant picker with inline quick create"
```

---

### Task 4: Wire into `ContractForm` and `ContractOccupantForm`

**Files:**
- Modify: `app/components/contracts/ContractForm.vue`
- Modify: `app/components/contracts/ContractOccupantForm.vue`
- Test: `tests/pages/contract-create-tenant-picker.spec.ts`, update existing tests that assert the occupant submit payload or mock `/api/tenants` for these components.

**Interfaces:**
- `ContractForm` new prop `excludeTenantIds?: string[]`.
- `ContractOccupantForm` submit payload becomes `ContractOccupantAddInput & { tenantName: string }`.

- [ ] **Step 1: Write failing source test**

```ts
// tests/pages/contract-create-tenant-picker.spec.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('tenant picker integration', () => {
  it('ContractForm uses TenantPicker and no longer preloads tenants', () => {
    const src = read('app/components/contracts/ContractForm.vue')
    expect(src).toContain('<TenantPicker')
    expect(src).not.toMatch(/useFetch<ApiSuccess<Tenant\[\]>>\('\/api\/tenants'/)
  })

  it('ContractOccupantForm uses TenantPicker and emits tenantName', () => {
    const src = read('app/components/contracts/ContractOccupantForm.vue')
    expect(src).toContain('<TenantPicker')
    expect(src).toContain('tenantName')
  })

  it('create page no longer preloads all tenants', () => {
    expect(read('app/pages/dashboard/contracts/create.vue')).not.toContain('allTenantsData')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**
  - `ContractForm.vue`: remove `tenantsData`/`availableTenants`; add `const selectedTenantSummary = ref<TenantSummary | null>(null)`; replace the tenant `UiCombobox` with:

```vue
<TenantPicker
  id="contract-tenant"
  :model-value="modelValue.tenant_id || null"
  :exclude-tenant-ids="excludeTenantIds"
  :exclude-contract-id="excludeContractId"
  required
  :disabled="loading"
  :error="errorFor('tenant_id')"
  @update:model-value="id => update('tenant_id', id ?? '')"
  @selected="t => selectedTenantSummary = t"
/>
```

  In the read-only relation block, use `selectedTenantSummary`; when it is null but `modelValue.tenant_id` is set, load once via `apiFetch(\`/api/tenants/${id}\`)` (edit page case).
  - `ContractOccupantForm.vue`: remove `useFetch('/api/tenants')`; keep `form.tenant_id`; add `tenantName = ref('')`; replace combobox with `<TenantPicker :model-value="form.tenant_id || null" :exclude-tenant-ids="excludeTenantIds" required :disabled="loading" :error="fieldErrors.tenant_id" @update:model-value="id => form.tenant_id = id ?? ''" @selected="t => tenantName = t?.fullName ?? ''" />`; include `tenantName: tenantName.value` in the submit payload. The `available` prop becomes unused — remove it and its call-site attributes.

- [ ] **Step 4: Run** `npx vitest run tests/pages/contract-create-tenant-picker.spec.ts tests/components/contracts tests/pages` and fix affected existing tests (replace `/api/tenants` list mocks with picker stubs where needed).

- [ ] **Step 5: Commit**

```bash
git add app/components/contracts/ContractForm.vue app/components/contracts/ContractOccupantForm.vue tests
git commit -m "feat(contracts): use TenantPicker for primary tenant and occupants"
```

---

### Task 5: `contracts/create.vue` — occupant names + room code prefill

**Files:**
- Modify: `app/pages/dashboard/contracts/create.vue`
- Create: `app/utils/contracts/resolve-room-query.ts`
- Test: `tests/utils/resolve-room-query.test.ts`

**Interfaces:**
- `resolveRoomQuery(value: unknown, fetchRoom: (code: string) => Promise<{ id: string } | null>): Promise<string>` — returns uuid or `''`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/resolve-room-query.test.ts
import { describe, expect, it, vi } from 'vitest'
import { resolveRoomQuery } from '~/utils/contracts/resolve-room-query'

const UUID = '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'

describe('resolveRoomQuery', () => {
  it('keeps a uuid without fetching', async () => {
    const fetchRoom = vi.fn()
    expect(await resolveRoomQuery(UUID, fetchRoom)).toBe(UUID)
    expect(fetchRoom).not.toHaveBeenCalled()
  })

  it('resolves a room code', async () => {
    expect(await resolveRoomQuery('zeno-p101', async () => ({ id: UUID }))).toBe(UUID)
  })

  it('returns empty for unknown code or errors', async () => {
    expect(await resolveRoomQuery('nope', async () => null)).toBe('')
    expect(await resolveRoomQuery('boom', async () => { throw new Error('x') })).toBe('')
  })

  it('returns empty for missing/array values', async () => {
    expect(await resolveRoomQuery(undefined, vi.fn())).toBe('')
    expect(await resolveRoomQuery(['a', 'b'], vi.fn())).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// app/utils/contracts/resolve-room-query.ts
import { isUuid } from '~/utils/format/slug'

export async function resolveRoomQuery(
  value: unknown,
  fetchRoom: (code: string) => Promise<{ id: string } | null>,
): Promise<string> {
  if (typeof value !== 'string' || value.trim() === '') return ''
  if (isUuid(value)) return value
  try {
    return (await fetchRoom(value))?.id ?? ''
  }
  catch {
    return ''
  }
}
```

In `create.vue`:
- Initialize `room_id: ''`; on setup run:

```ts
const roomFromQuery = await resolveRoomQuery(route.query.room_id, async (code) => {
  const res = await apiFetch<ApiSuccess<{ id: string }>>(`/api/rooms/${encodeURIComponent(code)}`)
  return res.data
})
if (roomFromQuery && !formData.value.room_id) formData.value.room_id = roomFromQuery
```

  (place before `initialSnapshot` is captured so the prefilled room does not mark the form dirty; confirm `GET /api/rooms/[id]` resolves by code via `findByIdentifier`).
- Remove `allTenantsData`, `allTenants`; in `handleAddPendingOccupant` use `input.tenantName`.
- Pass `:exclude-tenant-ids="pendingOccupants.map(o => o.tenant_id)"` to `ContractForm`.

- [ ] **Step 4: Run tests** → PASS, including `tests/pages/contract-create-tenant-picker.spec.ts` and existing contract-create tests.

- [ ] **Step 5: Visual QA** (ask before starting a local runtime): picker search, quick create (success, duplicate free/busy, generic conflict), roommate add, room "Tạo hợp đồng" prefill, manager view, mobile. Record in `verification.md`.

- [ ] **Step 6: Commit**

```bash
git add app/pages/dashboard/contracts/create.vue app/utils/contracts/resolve-room-query.ts tests/utils/resolve-room-query.test.ts docs/changes/tenant-quick-create/verification.md
git commit -m "fix(contracts): resolve room code prefill; occupant names from picker"
```

---

### Task 6: Guard test for basic-access search + verification

**Files:**
- Modify: existing tenants API test (find with `grep -rl "basicTenant\|accessLevel" tests/server`)
- Create/Modify: `docs/changes/tenant-quick-create/verification.md`, update `docs/changes/tenant-v2/spec-and-implementation-plan.md` (link line)

- [ ] **Step 1: Add the guard test** in the tenants list test file:

```ts
it('search results for basic-access tenants omit identity fields', async () => {
  // Arrange a list call with q='an' where the authorization context resolves to 'basic' for the row
  // (reuse the file's existing helpers for basic access).
  const res = await listHandler(makeEvent({ query: { q: 'an', available: 'true', limit: '20' } })) as { data: Record<string, unknown>[] }
  for (const row of res.data.filter(r => r.accessLevel === 'basic')) {
    expect(row).not.toHaveProperty('idNumber')
    expect(row).not.toHaveProperty('dateOfBirth')
    expect(row).not.toHaveProperty('permanentAddress')
  }
})
```

Adapt to the file's helper names; the assertion is what matters.

- [ ] **Step 2: Run** `npm run typecheck && npm test && npm run lint && npm run knowledge:check`.

- [ ] **Step 3: Write `verification.md`**

```markdown
---
type: Change Verification
title: "tenant-quick-create-verification"
status: draft
change_state: verification-pending
tags: [change, verification, tenants]
---

# Tenant quick create — verification

## Local (source)
- [ ] typecheck / test / lint / knowledge:check — <date, result>

## UI decisions
- <from Task 2 Step 1>

## Visual QA
- [ ] Picker search / empty / loading — desktop + mobile
- [ ] Quick create success; duplicate (free, busy); generic conflict
- [ ] Roommate add in create wizard and contract detail
- [ ] Room "Tạo hợp đồng" preselects room
- [ ] Manager: no "Thêm khách mới"

## Privacy
- [ ] No tenant fields in localStorage after quick create (devtools check)
```

- [ ] **Step 4:** In `docs/changes/tenant-v2/spec-and-implementation-plan.md`, under the "Tách change" note, append: `Change A → [tenant-quick-create](../tenant-quick-create/index.md).`

- [ ] **Step 5: Commit**

```bash
git add tests/server docs/changes/tenant-quick-create docs/changes/tenant-v2/spec-and-implementation-plan.md
git commit -m "test(tenants): guard basic-access search; docs for PR3"
```
