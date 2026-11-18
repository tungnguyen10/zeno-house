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

  it('replaces handover inventory through one RPC and preserves input order', async () => {
    rpc.mockResolvedValue({ data: [row('c-2', 'Tủ', 1), row('c-1', 'Giường', 0)], error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    const result = await InventoryRepository.replaceContract(event(), 'contract-1', input)

    expect(rpc).toHaveBeenCalledExactlyOnceWith('replace_contract_inventory', {
      p_contract_id: 'contract-1', p_items: input,
    })
    expect(result.map(r => r.name)).toEqual(['Giường', 'Tủ'])
    expect(from).not.toHaveBeenCalled()
  })

  it('clears handover inventory atomically with an empty array', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.replaceContract(event(), 'contract-1', [])).resolves.toEqual([])
    expect(rpc).toHaveBeenCalledExactlyOnceWith('replace_contract_inventory', { p_contract_id: 'contract-1', p_items: [] })
    expect(from).not.toHaveBeenCalled()
  })

  it('maps the issued-document lock to a conflict without a separate DELETE', async () => {
    const throwConflict = vi.fn((message: string, details?: unknown) => { throw Object.assign(new Error(message), { details }) })
    vi.stubGlobal('throwConflict', throwConflict)
    rpc.mockResolvedValue({ data: null, error: { message: 'CONTRACT_INVENTORY_LOCKED', code: '23514' } })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')

    await expect(InventoryRepository.replaceContract(event(), 'contract-1', input)).rejects.toMatchObject({
      details: { reason: 'CONTRACT_INVENTORY_LOCKED' },
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('applies a template through the typed RPC', async () => {
    rpc.mockResolvedValue({ data: { 'room-1': 2 }, error: null })
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.applyTemplate(event(), 'building-1', ['room-1'], 'merge')).resolves.toEqual({ 'room-1': 2 })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('apply_inventory_template', {
      p_building_id: 'building-1', p_room_ids: ['room-1'], p_mode: 'merge',
    })
  })
})

describe('InventoryRepository.roomOccupancyForSetup', () => {
  const calls: { method: string, args: unknown[] }[] = []
  function chain(result: unknown) {
    calls.length = 0
    const c: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq']) c[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return c }
    c.then = (resolve: (v: unknown) => void) => resolve(result)
    return c
  }

  it('reads one row per room with an embedded item count', async () => {
    from.mockImplementation(() => chain({
      data: [
        { id: 'r-1', status: 'available', room_inventory_items: [{ count: 0 }] },
        { id: 'r-2', status: 'occupied', room_inventory_items: [{ count: 3 }] },
        { id: 'r-3', status: 'available', room_inventory_items: [] },
        { id: 'r-4', status: 'maintenance', room_inventory_items: [{ count: 0 }] },
      ],
      error: null,
    }))
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    const res = await InventoryRepository.roomOccupancyForSetup(event(), 'b-1')

    expect(res).toEqual({ roomIdsWithoutInventory: ['r-1', 'r-3', 'r-4'], vacantRoomIds: ['r-1', 'r-3'] })
    expect(from).toHaveBeenCalledExactlyOnceWith('rooms')
    expect(calls).toContainEqual({ method: 'select', args: ['id, status, room_inventory_items(count)'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['building_id', 'b-1'] })
    expect(calls).toContainEqual({ method: 'neq', args: ['status', 'archived'] })
  })

  it('returns empty lists for a building without rooms', async () => {
    from.mockImplementation(() => chain({ data: [], error: null }))
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    expect(await InventoryRepository.roomOccupancyForSetup(event(), 'b-1')).toEqual({ roomIdsWithoutInventory: [], vacantRoomIds: [] })
  })

  it('propagates a query failure', async () => {
    from.mockImplementation(() => chain({ data: null, error: new Error('boom') }))
    const { InventoryRepository } = await import('../../../server/repositories/inventory')
    await expect(InventoryRepository.roomOccupancyForSetup(event(), 'b-1')).rejects.toThrow('boom')
  })
})
