import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
beforeEach(() => vi.clearAllMocks())

describe('useRoomInventory', () => {
  it('saves via PUT /api/rooms/{id}/inventory', async () => {
    fetchMock.mockResolvedValue({ data: [{ id: 'i-1', name: 'Giường' }] })
    const { useRoomInventory } = await import('~/composables/inventory/useRoomInventory')
    const r = useRoomInventory('p101', { roomId: 'r-1', buildingId: 'b-1', initial: [] })
    await r.save([{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }])
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/rooms/p101/inventory')
    expect(r.items.value).toHaveLength(1)
  })

  it('applyTemplate merges for this room only', async () => {
    fetchMock.mockResolvedValueOnce({ data: { appliedRooms: 1, addedItems: 2 } }).mockResolvedValueOnce({ data: [] })
    const { useRoomInventory } = await import('~/composables/inventory/useRoomInventory')
    const r = useRoomInventory('p101', { roomId: 'r-1', buildingId: 'b-1', initial: [] })
    await r.applyTemplate()
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/buildings/b-1/inventory-template/apply')
    expect(fetchMock.mock.calls[0]![1].body).toEqual({ room_ids: ['r-1'], mode: 'merge' })
  })
})
