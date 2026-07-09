import { vi, describe, it, expect, beforeEach } from 'vitest'
import { nextTick, ref } from 'vue'

const fetchMock = vi.hoisted(() => vi.fn())
const clearNuxtDataMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('clearNuxtData', clearNuxtDataMock)
vi.stubGlobal('navigateTo', vi.fn(async () => {}))

interface FormShape {
  building_id: string
  room_number: string
  floor: number
  status: 'available' | 'occupied' | 'maintenance' | 'archived'
  monthly_rent: number
  area: string
  description: string
}

function baseForm(): FormShape {
  return {
    building_id: 'b-1',
    room_number: '101',
    floor: 1,
    status: 'available',
    monthly_rent: 3000000,
    area: '',
    description: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  if (typeof window !== 'undefined') window.localStorage.clear()
})

describe('useRoomForm - dirty + draft persistence', () => {
  it('isDirty becomes true when a field changes', async () => {
    const { useRoomForm } = await import('../../app/composables/rooms/useRoomForm')
    const formData = ref<FormShape>(baseForm())
    const initial = { ...formData.value }
    const { isDirty } = useRoomForm<FormShape>({
      draftKey: { mode: 'create', buildingId: 'b-1' },
      formData,
      initialSnapshot: initial,
    })

    formData.value = { ...formData.value, room_number: '102' }
    expect(isDirty.value).toBe(true)
  })

  it('autosaves draft to localStorage after debounce', async () => {
    vi.useFakeTimers()
    const { useRoomForm } = await import('../../app/composables/rooms/useRoomForm')
    const formData = ref<FormShape>(baseForm())
    useRoomForm<FormShape>({
      draftKey: { mode: 'create', buildingId: 'b-1' },
      formData,
      initialSnapshot: { ...formData.value },
    })

    formData.value = { ...formData.value, room_number: 'A201' }
    await nextTick()
    vi.advanceTimersByTime(600)
    await nextTick()

    const stored = window.localStorage.getItem('room-form:create:b-1')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toMatchObject({
      data: { room_number: 'A201' },
    })
    vi.useRealTimers()
  })

  it('restoreDraft loads an envelope draft into formData', async () => {
    window.localStorage.setItem(
      'room-form:edit:r-1',
      JSON.stringify({ savedAt: '2026-06-27T00:00:00.000Z', data: { ...baseForm(), room_number: 'B303' } }),
    )
    const { useRoomForm } = await import('../../app/composables/rooms/useRoomForm')
    const formData = ref<FormShape>(baseForm())
    const { hasDraft, restoreDraft } = useRoomForm<FormShape>({
      draftKey: { mode: 'edit', id: 'r-1' },
      formData,
      initialSnapshot: { ...formData.value },
    })

    expect(hasDraft.value).toBe(true)
    const draft = restoreDraft()
    expect(draft).toMatchObject({ room_number: 'B303' })
    expect(formData.value.room_number).toBe('B303')
  })

  it('clearDraft removes localStorage entry', async () => {
    window.localStorage.setItem('room-form:create:none', JSON.stringify({ data: baseForm(), savedAt: '' }))
    const { useRoomForm } = await import('../../app/composables/rooms/useRoomForm')
    const { hasDraft, clearDraft } = useRoomForm<FormShape>({
      draftKey: { mode: 'create' },
      formData: ref(baseForm()),
      initialSnapshot: baseForm(),
    })

    expect(hasDraft.value).toBe(true)
    clearDraft()
    expect(window.localStorage.getItem('room-form:create:none')).toBeNull()
    expect(hasDraft.value).toBe(false)
  })
})

describe('useRoomBulkActions', () => {
  it('toggle adds then removes ids', async () => {
    const { useRoomBulkActions } = await import('../../app/composables/rooms/useRoomBulkActions')
    const { selectedIds, isSelected, toggle } = useRoomBulkActions()

    toggle('a')
    toggle('b')
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(isSelected('a')).toBe(true)

    toggle('a')
    expect(selectedIds.value).toEqual(['b'])
    expect(isSelected('a')).toBe(false)
  })

  it('selectAll replaces selection and clear empties it', async () => {
    const { useRoomBulkActions } = await import('../../app/composables/rooms/useRoomBulkActions')
    const { selectedIds, toggle, selectAll, clear } = useRoomBulkActions()
    toggle('x')
    selectAll(['a', 'b', 'c'])
    expect(selectedIds.value).toEqual(['a', 'b', 'c'])
    clear()
    expect(selectedIds.value).toEqual([])
  })

  it('runAction returns shape and keeps selection until caller clears', async () => {
    fetchMock.mockResolvedValue({
      data: { succeeded: ['a'], failed: [{ id: 'b', reason: 'has_meter_readings' }] },
    })
    const { useRoomBulkActions } = await import('../../app/composables/rooms/useRoomBulkActions')
    const { selectedIds, selectAll, runAction } = useRoomBulkActions()

    selectAll(['a', 'b'])
    const result = await runAction('delete', { reason: 'Dữ liệu trùng' })
    expect(result.succeeded).toEqual(['a'])
    expect(result.failed).toEqual([{ id: 'b', reason: 'has_meter_readings' }])
    expect(selectedIds.value).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledWith('/api/rooms/bulk', expect.objectContaining({
      method: 'POST',
      body: { action: 'delete', ids: ['a', 'b'], reason: 'Dữ liệu trùng' },
    }))
  })
})

describe('useRoomList helpers', () => {
  it('invalidateRoomListCache clears room list async data key', async () => {
    const { invalidateRoomListCache, ROOM_LIST_ASYNC_KEY } = await import('../../app/composables/rooms/useRoomList')

    invalidateRoomListCache()

    expect(clearNuxtDataMock).toHaveBeenCalledWith(ROOM_LIST_ASYNC_KEY)
  })
})
