import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())

vi.mock('../../../server/utils/db', () => ({ db: () => ({ rpc, from }) }))

const items = [{ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null }] as never

beforeEach(() => vi.clearAllMocks())

describe('InventoryRepository', () => {
  it('replaces lists through the atomic RPCs, never separate REST writes', async () => {
    rpc.mockResolvedValue({ data: [{ id: 'x' }], error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await InventoryRepository.replaceTemplate({} as never, 'b-1', items)
    await InventoryRepository.replaceRoom({} as never, 'r-1', items)
    expect(rpc).toHaveBeenNthCalledWith(1, 'replace_inventory_template', { p_building_id: 'b-1', p_items: items })
    expect(rpc).toHaveBeenNthCalledWith(2, 'replace_room_inventory', { p_room_id: 'r-1', p_items: items })
    expect(from).not.toHaveBeenCalled()
  })

  it('applies the template through the RPC', async () => {
    rpc.mockResolvedValue({ data: { 'r-1': 3 }, error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.applyTemplate({} as never, 'b-1', ['r-1'], 'replace')).resolves.toEqual({ 'r-1': 3 })
    expect(rpc).toHaveBeenCalledWith('apply_inventory_template', { p_building_id: 'b-1', p_room_ids: ['r-1'], p_mode: 'replace' })
  })

  it.each([
    ['INVENTORY_ROOM_SCOPE', 403],
    ['INVENTORY_ITEMS_LIMIT', 422],
    ['INVENTORY_ITEMS_DUPLICATE', 422],
    ['INVENTORY_ITEMS_INVALID', 422],
    ['INVENTORY_ROOMS_INVALID', 422],
    ['INVENTORY_MODE_INVALID', 422],
    ['BUILDING_NOT_FOUND', 404],
  ])('maps %s to a stable %i error', async (message, statusCode) => {
    rpc.mockResolvedValue({ data: null, error: { message, code: 'P0001' } })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.applyTemplate({} as never, 'b-1', ['r-1'], 'merge')).rejects.toMatchObject({
      statusCode,
      data: { error: expect.objectContaining(statusCode === 422 ? { details: { reason: message } } : {}) },
    })
  })

  it('does not leak unknown database errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rpc.mockResolvedValue({ data: null, error: { message: 'relation x missing', code: '42P01' } })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.replaceRoom({} as never, 'r-1', items)).rejects.toMatchObject({ statusCode: 500 })
  })
})
