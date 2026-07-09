import { vi, describe, it, expect, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
const clearNuxtDataMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('clearNuxtData', clearNuxtDataMock)
vi.stubGlobal('navigateTo', vi.fn(async () => {}))

interface FormShape {
  full_name: string
  phone: string
  email: string | null
}

beforeEach(() => {
  vi.clearAllMocks()
  if (typeof window !== 'undefined') window.localStorage.clear()
})

describe('useTenantForm — dirty + draft persistence', () => {
  it('isDirty stays false when nothing changes', async () => {
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const formData = ref<FormShape>({ full_name: 'Nguyen Van A', phone: '0901', email: null })
    const initial = { ...formData.value }
    const { isDirty } = useTenantForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: initial,
    })
    expect(isDirty.value).toBe(false)
  })

  it('isDirty becomes true when a field changes', async () => {
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const formData = ref<FormShape>({ full_name: 'Nguyen Van A', phone: '0901', email: null })
    const initial = { ...formData.value }
    const { isDirty } = useTenantForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: initial,
    })

    formData.value = { ...formData.value, full_name: 'Tran Thi B' }
    expect(isDirty.value).toBe(true)
  })

  it('autosaves draft to localStorage after debounce', async () => {
    vi.useFakeTimers()
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const formData = ref<FormShape>({ full_name: 'A', phone: '0901', email: null })
    const initial = { ...formData.value }
    useTenantForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: initial,
    })

    formData.value = { ...formData.value, full_name: 'B' }
    await nextTick()
    vi.advanceTimersByTime(600)
    await nextTick()

    const stored = window.localStorage.getItem('tenant-form:create')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toMatchObject({ full_name: 'B' })
    vi.useRealTimers()
  })

  it('restoreDraft loads previously saved draft into formData', async () => {
    window.localStorage.setItem(
      'tenant-form:edit:t-1',
      JSON.stringify({ full_name: 'Bản nháp', phone: '0999', email: null }),
    )
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const formData = ref<FormShape>({ full_name: '', phone: '', email: null })
    const { hasDraft, restoreDraft } = useTenantForm<FormShape>({
      draftKey: { mode: 'edit', id: 't-1' },
      formData,
      initialSnapshot: { full_name: '', phone: '', email: null },
    })

    expect(hasDraft.value).toBe(true)
    const draft = restoreDraft()
    expect(draft).toMatchObject({ full_name: 'Bản nháp' })
    expect(formData.value.full_name).toBe('Bản nháp')
  })

  it('clearDraft removes the localStorage entry', async () => {
    window.localStorage.setItem('tenant-form:create', JSON.stringify({ full_name: 'x', phone: 'y', email: null }))
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const formData = ref<FormShape>({ full_name: '', phone: '', email: null })
    const { hasDraft, clearDraft } = useTenantForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: { full_name: '', phone: '', email: null },
    })

    expect(hasDraft.value).toBe(true)
    clearDraft()
    expect(window.localStorage.getItem('tenant-form:create')).toBeNull()
    expect(hasDraft.value).toBe(false)
  })

  it('clears draft after successful submitCreate', async () => {
    window.localStorage.setItem('tenant-form:create', JSON.stringify({ full_name: 'x', phone: 'y' }))
    fetchMock.mockResolvedValue({ data: { id: 'new-1', code: 'nva-2026-0001' } })

    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const { submitCreate } = useTenantForm({ draftKey: { mode: 'create' } })

    await submitCreate({
      full_name: 'Nguyen Van A',
      phone: '0901234567',
    })

    expect(window.localStorage.getItem('tenant-form:create')).toBeNull()
  })
})

describe('useTenantBulkActions', () => {
  it('runAction returns shape and keeps selection until caller clears', async () => {
    fetchMock.mockResolvedValue({
      data: { succeeded: ['a'], failed: [{ id: 'b', reason: 'has_active_contracts' }] },
    })
    const { useTenantBulkActions } = await import('../../app/composables/tenants/useTenantBulkActions')
    const { selectedIds, selectAll, runAction } = useTenantBulkActions()

    selectAll(['a', 'b'])
    const result = await runAction('delete', { reason: 'Nhập trùng hồ sơ' })
    expect(result.succeeded).toEqual(['a'])
    expect(result.failed).toEqual([{ id: 'b', reason: 'has_active_contracts' }])
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledWith('/api/tenants/bulk', expect.objectContaining({
      method: 'POST',
      body: { action: 'delete', ids: ['a', 'b'], reason: 'Nhập trùng hồ sơ' },
    }))
  })

  it('runAction short-circuits when nothing is selected', async () => {
    const { useTenantBulkActions } = await import('../../app/composables/tenants/useTenantBulkActions')
    const { runAction } = useTenantBulkActions()
    const result = await runAction('archive')
    expect(result).toEqual({ succeeded: [], failed: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('useTenantList helpers', () => {
  it('invalidateTenantListCache clears tenant list async data key', async () => {
    const { invalidateTenantListCache, TENANT_LIST_ASYNC_KEY } = await import('../../app/composables/tenants/useTenantList')

    invalidateTenantListCache()

    expect(clearNuxtDataMock).toHaveBeenCalledWith(TENANT_LIST_ASYNC_KEY)
  })
})
