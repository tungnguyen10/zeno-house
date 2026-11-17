import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())

vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc, from }) }))

const event = () => ({ context: {} }) as never
const input = [
  { name: 'Giường', quantity: 1, condition: 'good' as const, unit_value: null, note: null },
  { name: 'Tủ', quantity: 2, condition: 'used' as const, unit_value: 400000, note: null },
]
const row = (id: string, name: string, sort_order: number) => ({
  id, name, sort_order, quantity: 1, condition: 'good', unit_value: null, note: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('throwDbError', (error: unknown) => { throw error })
})

describe('InventoryRepository atomic replacements', () => {
  it('replaces a building template through one RPC and preserves input order', async () => {
    rpc.mockResolvedValue({ data: [row('t-2', 'Tủ', 1), row('t-1', 'Giường', 0)], error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    const result = await InventoryRepository.replaceTemplate(event(), 'building-1', input)

    expect(rpc).toHaveBeenCalledExactlyOnceWith('replace_inventory_template', {
      p_building_id: 'building-1', p_items: input,
    })
    expect(result.map(r => r.name)).toEqual(['Giường', 'Tủ'])
    expect(from).not.toHaveBeenCalled()
  })

  it('replaces room inventory through one RPC rather than separate DELETE and INSERT', async () => {
    rpc.mockResolvedValue({ data: [row('r-2', 'Tủ', 1), row('r-1', 'Giường', 0)], error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    const result = await InventoryRepository.replaceRoom(event(), 'room-1', input)

    expect(rpc).toHaveBeenCalledExactlyOnceWith('replace_room_inventory', {
      p_room_id: 'room-1', p_items: input,
    })
    expect(result.map(r => r.name)).toEqual(['Giường', 'Tủ'])
    expect(from).not.toHaveBeenCalled()
  })

  it('sends an empty array to the RPC for an atomic clear of either inventory', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.replaceTemplate(event(), 'building-1', [])).resolves.toEqual([])
    await expect(InventoryRepository.replaceRoom(event(), 'room-1', [])).resolves.toEqual([])

    expect(rpc).toHaveBeenNthCalledWith(1, 'replace_inventory_template', { p_building_id: 'building-1', p_items: [] })
    expect(rpc).toHaveBeenNthCalledWith(2, 'replace_room_inventory', { p_room_id: 'room-1', p_items: [] })
    expect(from).not.toHaveBeenCalled()
  })

  it('propagates an RPC failure without starting a separate DELETE', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('SQL validation failed') })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')

    await expect(InventoryRepository.replaceTemplate(event(), 'building-1', input)).rejects.toThrow('SQL validation failed')
    await expect(InventoryRepository.replaceRoom(event(), 'room-1', input)).rejects.toThrow('SQL validation failed')
    expect(from).not.toHaveBeenCalled()
  })
})
