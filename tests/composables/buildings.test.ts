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
  it('toggle adds then removes ids', async () => {
    const { useBuildingBulkActions } = await import('../../app/composables/buildings/useBuildingBulkActions')
    const { selectedIds, isSelected, toggle } = useBuildingBulkActions()

    toggle('a')
    toggle('b')
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(isSelected('a')).toBe(true)

    toggle('a')
    expect(selectedIds.value).toEqual(['b'])
    expect(isSelected('a')).toBe(false)
  })

  it('selectAll replaces selection', async () => {
    const { useBuildingBulkActions } = await import('../../app/composables/buildings/useBuildingBulkActions')
    const { selectedIds, toggle, selectAll } = useBuildingBulkActions()
    toggle('x')
    selectAll(['a', 'b', 'c'])
    expect(selectedIds.value).toEqual(['a', 'b', 'c'])
  })

  it('clear empties the selection', async () => {
    const { useBuildingBulkActions } = await import('../../app/composables/buildings/useBuildingBulkActions')
    const { selectedIds, selectAll, clear } = useBuildingBulkActions()
    selectAll(['a', 'b'])
    clear()
    expect(selectedIds.value).toEqual([])
  })

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
