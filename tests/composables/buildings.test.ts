import { vi, describe, it, expect, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'

// $fetch is auto-imported in Nuxt; tests stub it as a global
const fetchMock = vi.hoisted(() => vi.fn())
const clearNuxtDataMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('clearNuxtData', clearNuxtDataMock)
vi.stubGlobal('navigateTo', vi.fn(async () => {}))

interface FormShape {
  name: string
  address: string
  description: string
}

beforeEach(() => {
  vi.clearAllMocks()
  if (typeof window !== 'undefined') window.localStorage.clear()
})

describe('useBuildingForm — dirty + draft persistence', () => {
  it('isDirty stays false when nothing changes', async () => {
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const formData = ref<FormShape>({ name: 'Toa A', address: '123', description: '' })
    const initial = { ...formData.value }
    const { isDirty } = useBuildingForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: initial,
    })
    expect(isDirty.value).toBe(false)
  })

  it('isDirty becomes true when a field changes', async () => {
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const formData = ref<FormShape>({ name: 'Toa A', address: '123', description: '' })
    const initial = { ...formData.value }
    const { isDirty } = useBuildingForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: initial,
    })

    formData.value = { ...formData.value, name: 'Toa B' }
    expect(isDirty.value).toBe(true)
  })

  it('autosaves draft to localStorage after debounce', async () => {
    vi.useFakeTimers()
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const formData = ref<FormShape>({ name: 'Toa A', address: '123', description: '' })
    const initial = { ...formData.value }
    useBuildingForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: initial,
    })

    formData.value = { ...formData.value, name: 'Toa B' }
    await nextTick()
    vi.advanceTimersByTime(600)
    await nextTick()

    const stored = window.localStorage.getItem('building-form:create')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toMatchObject({ name: 'Toa B' })
    vi.useRealTimers()
  })

  it('restoreDraft loads previously saved draft into formData', async () => {
    window.localStorage.setItem(
      'building-form:edit:b-1',
      JSON.stringify({ name: 'Bản nháp', address: '999', description: 'note' }),
    )
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const formData = ref<FormShape>({ name: '', address: '', description: '' })
    const { hasDraft, restoreDraft } = useBuildingForm<FormShape>({
      draftKey: { mode: 'edit', id: 'b-1' },
      formData,
      initialSnapshot: { name: '', address: '', description: '' },
    })

    expect(hasDraft.value).toBe(true)
    const draft = restoreDraft()
    expect(draft).toMatchObject({ name: 'Bản nháp' })
    expect(formData.value.name).toBe('Bản nháp')
  })

  it('clearDraft removes the localStorage entry', async () => {
    window.localStorage.setItem('building-form:create', JSON.stringify({ name: 'x', address: 'y', description: '' }))
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const formData = ref<FormShape>({ name: '', address: '', description: '' })
    const { hasDraft, clearDraft } = useBuildingForm<FormShape>({
      draftKey: { mode: 'create' },
      formData,
      initialSnapshot: { name: '', address: '', description: '' },
    })

    expect(hasDraft.value).toBe(true)
    clearDraft()
    expect(window.localStorage.getItem('building-form:create')).toBeNull()
    expect(hasDraft.value).toBe(false)
  })

  it('clears draft after successful submitCreate', async () => {
    window.localStorage.setItem('building-form:create', JSON.stringify({ name: 'x', address: 'y', description: '' }))
    fetchMock.mockResolvedValue({ data: { id: 'new-1' } })

    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const { submitCreate } = useBuildingForm({ draftKey: { mode: 'create' } })

    await submitCreate({
      name: 'Toà mới',
      address: '123 Le Loi',
      status: 'active',
      electricity_pricing_type: 'per_kwh',
      water_pricing_type: 'per_m3',
      grace_period_days: 0,
    })

    expect(window.localStorage.getItem('building-form:create')).toBeNull()
  })
})

describe('useBuildingBulkActions', () => {
  it('runAction returns shape and keeps selection until caller clears', async () => {
    fetchMock.mockResolvedValue({
      data: { succeeded: ['a'], failed: [{ id: 'b', reason: 'has_rooms' }] },
    })
    const { useBuildingBulkActions } = await import('../../app/composables/buildings/useBuildingBulkActions')
    const { selectedIds, selectAll, runAction } = useBuildingBulkActions()

    selectAll(['a', 'b'])
    const result = await runAction('delete')
    expect(result.succeeded).toEqual(['a'])
    expect(result.failed).toEqual([{ id: 'b', reason: 'has_rooms' }])
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/bulk', expect.objectContaining({
      method: 'POST',
      body: { action: 'delete', ids: ['a', 'b'] },
    }))
  })

  it('runAction short-circuits when nothing is selected', async () => {
    const { useBuildingBulkActions } = await import('../../app/composables/buildings/useBuildingBulkActions')
    const { runAction } = useBuildingBulkActions()
    const result = await runAction('archive')
    expect(result).toEqual({ succeeded: [], failed: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('useBuildingList helpers', () => {
  it('invalidateBuildingListCache clears building list async data key', async () => {
    const { invalidateBuildingListCache, BUILDING_LIST_ASYNC_KEY } = await import('../../app/composables/buildings/useBuildingList')

    invalidateBuildingListCache()

    expect(clearNuxtDataMock).toHaveBeenCalledWith(BUILDING_LIST_ASYNC_KEY)
  })
})

describe('useBuildingForm.submitCreate (atomic)', () => {
  const body = {
    name: 'Tòa mới', address: '123 Lê Lợi', status: 'active' as const,
    electricity_pricing_type: 'per_kwh' as const, water_pricing_type: 'per_m3' as const, grace_period_days: 0,
    rooms: [{ room_number: 'P101', floor: 2, monthly_rent: 1, area: null }],
  }
  const uncertainMessage = 'Chưa xác nhận được kết quả. Bấm thử lại để kiểm tra và tiếp tục.'

  beforeEach(() => {
    fetchMock.mockReset()
  })

  it('sends one request containing rooms and the exposed uuid request id', async () => {
    fetchMock.mockResolvedValue({ data: { id: 'b-1' }, meta: { room_count: 1 } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm({ draftKey: { mode: 'create' } })

    await form.submitCreate(body)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(form.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(fetchMock).toHaveBeenCalledWith('/api/buildings', expect.objectContaining({
      method: 'POST', body: { ...body, request_id: form.requestId },
    }))
    expect(clearNuxtDataMock).toHaveBeenCalledOnce()
    expect(navigateTo).toHaveBeenCalledWith('/dashboard/buildings')
    expect(form.isLoading.value).toBe(false)
  })

  it('reuses the same request id on retry and gives a new form its own id', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { id: 'b-1' } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm()

    await form.submitCreate(body)
    await form.submitCreate(body)

    expect(form.requestId).toBeDefined()
    expect(fetchMock.mock.calls[0]![1].body.request_id).toBe(form.requestId)
    expect(fetchMock.mock.calls[1]![1].body.request_id).toBe(form.requestId)
    expect(useBuildingForm().requestId).not.toBe(form.requestId)
    expect(form.apiError.value).toBeNull()
  })

  it.each([
    new Error('network'),
    { data: { error: { code: 'INTERNAL', message: 'Timeout' } } },
    { statusCode: 500, data: { error: { code: 'INTERNAL', message: 'Internal', details: { reason: 'DATABASE_ERROR' } } } },
  ])('retains the draft and shows an uncertain result for ambiguous failure %#', async (error) => {
    window.localStorage.setItem('building-form:create', JSON.stringify(body))
    fetchMock.mockRejectedValue(error)
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm({ draftKey: { mode: 'create' } })

    await form.submitCreate(body)

    expect(form.apiError.value).toBe(uncertainMessage)
    expect(form.isLoading.value).toBe(false)
    expect(window.localStorage.getItem('building-form:create')).toBe(JSON.stringify(body))
    expect(form.hasDraft.value).toBe(true)
    expect(clearNuxtDataMock).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('exposes duplicate room numbers from a 409 and clears them before retry', async () => {
    fetchMock.mockRejectedValueOnce({
      statusCode: 409,
      data: { error: { code: 'CONFLICT', message: 'Các mã phòng đã tồn tại: P101', details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P101'] } } },
    }).mockResolvedValueOnce({ data: { id: 'b-1' } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm()

    await form.submitCreate(body)
    expect(form.duplicateRoomNumbers.value).toEqual(['P101'])
    expect(form.apiError.value).toBe('Các mã phòng đã tồn tại: P101')

    await form.submitCreate(body)
    expect(form.duplicateRoomNumbers.value).toEqual([])
    expect(form.apiError.value).toBeNull()
  })

  it.each([403, 409, 422])('preserves useful server messages for HTTP %i without a reason', async (statusCode) => {
    fetchMock.mockRejectedValue({ statusCode, data: { error: { code: 'FORBIDDEN', message: 'Thông tin yêu cầu không hợp lệ.' } } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm()

    await form.submitCreate(body)

    expect(form.apiError.value).toBe('Thông tin yêu cầu không hợp lệ.')
  })

  it('preserves HTTP status from apiFetch cause when FetchError status is not enumerable', async () => {
    const { apiFetch } = await import('../../app/utils/api-fetch')
    const cause = Object.defineProperty(new Error('Forbidden'), 'statusCode', { get: () => 403 })
    Object.assign(cause, { data: { error: { code: 'FORBIDDEN', message: 'Không có quyền tạo tòa nhà.' } } })
    fetchMock.mockRejectedValue(cause)
    const normalized = await apiFetch('/api/buildings').catch(error => error)
    fetchMock.mockRejectedValue(normalized)
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm()

    await form.submitCreate(body)

    expect(form.apiError.value).toBe('Không có quyền tạo tòa nhà.')
  })

  it('validates rooms with the shared schema before making any request', async () => {
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm()

    await form.submitCreate({ ...body, rooms: [{ ...body.rooms[0]!, floor: 0 }] })

    expect(form.errors.value.rooms).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(form.isLoading.value).toBe(false)
  })

  it('omits an empty room selection from building-only creation', async () => {
    fetchMock.mockResolvedValue({ data: { id: 'b-1' } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm()

    await form.submitCreate({ ...body, rooms: [] })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]![1].body.rooms).toBeUndefined()
    expect(fetchMock.mock.calls[0]![1].body.request_id).toBe(form.requestId)
  })

  it('preserves submitUpdate PATCH, draft cleanup and building navigation behavior', async () => {
    window.localStorage.setItem('building-form:edit:b-1', JSON.stringify(body))
    fetchMock.mockResolvedValue({ data: { id: 'b-1', slug: 'toa-moi' } })
    const { useBuildingForm } = await import('../../app/composables/buildings/useBuildingForm')
    const form = useBuildingForm({ draftKey: { mode: 'edit', id: 'b-1' } })

    await form.submitUpdate('b-1', { name: 'Tòa mới' })

    expect(fetchMock).toHaveBeenCalledWith('/api/buildings/b-1', {
      method: 'PATCH',
      body: { name: 'Tòa mới', status: 'active', electricity_pricing_type: 'per_kwh', water_pricing_type: 'per_m3', grace_period_days: 0 },
    })
    expect(window.localStorage.getItem('building-form:edit:b-1')).toBeNull()
    expect(navigateTo).toHaveBeenCalledWith('/dashboard/buildings/toa-moi')
  })
})
