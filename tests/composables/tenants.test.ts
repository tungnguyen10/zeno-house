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

describe('tenant identity error presentation', () => {
  const input = { full_name: 'Khách Giả Lập', phone: '0900000000' }
  const generic = 'Không thể tạo hồ sơ với thông tin này; liên hệ quản trị viên'

  it.each(['create', 'update'] as const)('shows authorized duplicate field errors on %s', async (operation) => {
    fetchMock.mockRejectedValue({ data: { error: { code: 'TENANT_DUPLICATE', message: 'Thông tin bị trùng', details: { fieldErrors: { phone: ['Số điện thoại đã tồn tại'] }, existingTenantId: 'other-tenant' } } } })
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const form = useTenantForm()
    await (operation === 'create' ? form.submitCreate(input) : form.submitUpdate('tenant-1', input))
    expect(form.errors.value).toEqual({ phone: ['Số điện thoại đã tồn tại'] })
    expect(form.apiError.value).toBe('Thông tin bị trùng')
    expect(form.isLoading.value).toBe(false)
  })

  it('clears prior duplicate errors and only shows the generic banner for a restricted conflict', async () => {
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const form = useTenantForm()
    form.errors.value = { phone: ['Old error'] }
    fetchMock.mockRejectedValue({ data: { error: { code: 'TENANT_IDENTITY_CONFLICT', message: generic } } })
    await form.submitCreate(input)
    expect(form.errors.value).toEqual({})
    expect(form.apiError.value).toBe(generic)
  })

  it('shows the retry wait for a rate limited form submission', async () => {
    fetchMock.mockRejectedValue({ data: { error: { code: 'RATE_LIMITED', message: 'Too many requests', details: { retryAfterSeconds: 42 } } } })
    const { useTenantForm } = await import('../../app/composables/tenants/useTenantForm')
    const form = useTenantForm()
    await form.submitUpdate('tenant-1', input)
    expect(form.errors.value).toEqual({})
    expect(form.apiError.value).toBe('Bạn đã thử quá nhiều lần, vui lòng thử lại sau. Thử lại sau 42 giây.')
  })

  it('shows the retry wait for a rate limited bulk import', async () => {
    fetchMock.mockRejectedValue({ data: { error: { code: 'RATE_LIMITED', details: { retryAfterSeconds: 60 } } } })
    const { useTenantBulkCreate } = await import('../../app/composables/tenants/useTenantBulkCreate')
    const bulk = useTenantBulkCreate()
    bulk.rows.value = [{ line: 2, ...input }]
    expect(await bulk.submit()).toBeNull()
    expect(bulk.submitError.value).toBe('Bạn đã thử quá nhiều lần, vui lòng thử lại sau. Thử lại sau 60 giây.')
    expect(bulk.isSubmitting.value).toBe(false)
  })
})

describe('tenant bulk normalized preview duplicates', () => {
  it('flags separator and +84 variants of the same phone without replacing raw preview values', async () => {
    const { useTenantBulkCreate } = await import('../../app/composables/tenants/useTenantBulkCreate')
    const bulk = useTenantBulkCreate()
    bulk.rows.value = [
      { line: 2, full_name: 'Khách Giả Lập A', phone: '0900 000 000' },
      { line: 3, full_name: 'Khách Giả Lập B', phone: '+84900000000' },
    ]
    expect(bulk.previewRows.value.map(row => row.fieldErrors.phone)).toEqual([
      ['Số điện thoại bị trùng trong file nhập'], ['Số điện thoại bị trùng trong file nhập'],
    ])
    expect(bulk.previewRows.value.map(row => row.phone)).toEqual(['0900 000 000', '+84900000000'])
    expect(bulk.validRows.value).toBe(0)
    expect(bulk.canSubmit.value).toBe(false)
  })

  it('flags passport space and case variants as the same identity', async () => {
    const { useTenantBulkCreate } = await import('../../app/composables/tenants/useTenantBulkCreate')
    const bulk = useTenantBulkCreate()
    bulk.rows.value = [
      { line: 2, full_name: 'Khách Giả Lập A', phone: '0900000000', id_number: 'b 123 4567' },
      { line: 3, full_name: 'Khách Giả Lập B', phone: '0900000001', id_number: 'B1234567' },
    ]
    expect(bulk.previewRows.value.map(row => row.fieldErrors.id_number)).toEqual([
      ['Số CMND/CCCD bị trùng trong file nhập'], ['Số CMND/CCCD bị trùng trong file nhập'],
    ])
    expect(bulk.previewRows.value[0]?.id_number).toBe('b 123 4567')
  })
})
