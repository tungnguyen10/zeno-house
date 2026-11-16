import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => vi.clearAllMocks())

describe('useInventoryTemplate', () => {
  it('saves items via PUT and applies via POST', async () => {
    fetchMock.mockResolvedValueOnce({ data: [{ id: 't-1', name: 'Giường' }] })
      .mockResolvedValueOnce({ data: { appliedRooms: 2, addedItems: 3 } })
    const { useInventoryTemplate } = await import('~/composables/inventory/useInventoryTemplate')
    const t = useInventoryTemplate('zeno', { initial: [] })
    await t.save([{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }])
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/buildings/zeno/inventory-template')
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'PUT', body: { items: [{ name: 'Giường' }] } })
    expect(t.items.value).toHaveLength(1)
    const res = await t.apply({ room_ids: ['r-1', 'r-2'], mode: 'merge' })
    expect(res).toEqual({ appliedRooms: 2, addedItems: 3 })
  })
})
