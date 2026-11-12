import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('navigateTo', vi.fn(async () => {}))
vi.stubGlobal('clearNuxtData', vi.fn())

beforeEach(() => vi.clearAllMocks())

describe('useRoomBatchCreate', () => {
  const rooms = [{ room_number: 'P201', floor: 2, monthly_rent: 1, area: null }]

  it('posts with a stable request_id across retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: [], meta: { room_count: 1, replayed: true } })
    const { useRoomBatchCreate } = await import('~/composables/rooms/useRoomBatchCreate')
    const { submit } = useRoomBatchCreate('zeno')
    await submit({ rooms, apply_inventory: true })
    await submit({ rooms, apply_inventory: true })
    const [u1, o1] = fetchMock.mock.calls[0]!
    const [, o2] = fetchMock.mock.calls[1]!
    expect(u1).toBe('/api/buildings/zeno/rooms/batch')
    expect(o1.body.request_id).toBe(o2.body.request_id)
  })

  it('exposes duplicates from 409', async () => {
    fetchMock.mockRejectedValue({ statusCode: 409, data: { error: { message: 'Các mã phòng đã tồn tại: P201', details: { reason: 'ROOM_BATCH_DUPLICATE', duplicate_room_numbers: ['P201'] } } } })
    const { useRoomBatchCreate } = await import('~/composables/rooms/useRoomBatchCreate')
    const { submit, duplicateRoomNumbers } = useRoomBatchCreate('zeno')
    expect(await submit({ rooms, apply_inventory: false })).toBe(false)
    expect(duplicateRoomNumbers.value).toEqual(['P201'])
  })
})
