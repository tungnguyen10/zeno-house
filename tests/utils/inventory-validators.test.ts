import { describe, expect, it } from 'vitest'
import { inventoryApplySchema, inventoryListSchema, roomBatchCreateSchema } from '~/utils/validators/inventory'
import { inventoryTotalValue, mapInventoryItem } from '~/utils/mappers/inventory'

const item = (name: string, extra: Record<string, unknown> = {}) => ({ name, quantity: 1, condition: 'good', unit_value: null, note: null, ...extra })
const room = (room_number: string) => ({ room_number, floor: 1, monthly_rent: 1, area: null })
const requestId = '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'

describe('inventoryListSchema', () => {
  it('accepts an empty inventory list', () => {
    expect(inventoryListSchema.safeParse([]).success).toBe(true)
  })

  it('accepts a normal list with defaults and trims optional text', () => {
    const r = inventoryListSchema.safeParse([{ name: ' Giường ', note: '   ' }])
    expect(r.success).toBe(true)
    expect(r.data![0]).toMatchObject({ name: 'Giường', quantity: 1, condition: 'good', unit_value: null, note: null })
  })

  it('rejects case-insensitive duplicate names at the duplicate index', () => {
    const r = inventoryListSchema.safeParse([item('Giường'), item('Tủ'), item('giường')])
    expect(r.success).toBe(false)
    expect(r.error!.issues.map(i => i.path.join('.'))).toContain('2.name')
  })

  it.each([
    [{ name: '' }], [{ name: 'x'.repeat(101) }], [{ name: 'A', quantity: 0 }], [{ name: 'A', quantity: 1000 }],
    [{ name: 'A', quantity: 1.5 }], [{ name: 'A', condition: 'new' }], [{ name: 'A', unit_value: -1 }],
    [{ name: 'A', unit_value: 1.5 }], [{ name: 'A', unit_value: 1_000_000_000_000 }], [{ name: 'A', note: 'x'.repeat(201) }],
  ])('rejects %j', (bad) => {
    expect(inventoryListSchema.safeParse([bad]).success).toBe(false)
  })

  it('rejects more than 50 items', () => {
    expect(inventoryListSchema.safeParse(Array.from({ length: 51 }, (_, i) => item(`M${i}`))).success).toBe(false)
  })
})

describe('inventoryApplySchema', () => {
  it('requires 1..200 unique uuids and a valid mode', () => {
    expect(inventoryApplySchema.safeParse({ room_ids: [], mode: 'merge' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: [requestId], mode: 'wipe' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: [requestId, requestId], mode: 'merge' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: ['invalid'], mode: 'merge' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: [requestId], mode: 'replace' }).success).toBe(true)
    expect(inventoryApplySchema.safeParse({ room_ids: Array.from({ length: 201 }, (_, i) => `7d0b3f7e-8f43-4a8e-9a4f-${String(i).padStart(12, '0')}`), mode: 'merge' }).success).toBe(false)
  })
})

describe('roomBatchCreateSchema', () => {
  it('requires request_id and rejects normalized room slug duplicates', () => {
    const rooms = [room('P 101'), room('p-101')]
    expect(roomBatchCreateSchema.safeParse({ rooms }).success).toBe(false)
    expect(roomBatchCreateSchema.safeParse({ request_id: requestId, rooms }).success).toBe(false)
  })

  it('accepts an empty inventory list separately and defaults apply_inventory to false', () => {
    const r = roomBatchCreateSchema.safeParse({ request_id: requestId, rooms: [room('P101')] })
    expect(r.success).toBe(true)
    expect(r.data?.apply_inventory).toBe(false)
  })
})

describe('inventory row mapping and total value', () => {
  it('maps numeric strings and sums quantity times unit value while skipping nulls', () => {
    const mapped = mapInventoryItem({
      id: 'item-1', name: 'Bàn', quantity: 2, condition: 'used', unit_value: '1250', note: null, sort_order: 3,
    })
    expect(mapped).toEqual({ id: 'item-1', name: 'Bàn', quantity: 2, condition: 'used', unitValue: 1250, note: null, sortOrder: 3 })
    expect(inventoryTotalValue([{ quantity: 2, unitValue: 1000 }, { quantity: 1, unitValue: null }])).toBe(2000)
  })
})
