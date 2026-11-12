import { describe, expect, it } from 'vitest'
import { inventoryApplySchema, inventoryListSchema, roomBatchCreateSchema } from '~/utils/validators/inventory'
import { inventoryTotalValue } from '~/utils/mappers/inventory'

const item = (name: string, extra: Record<string, unknown> = {}) => ({ name, quantity: 1, condition: 'good', unit_value: null, note: null, ...extra })

describe('inventoryListSchema', () => {
  it('accepts a normal list with defaults', () => {
    const r = inventoryListSchema.safeParse([{ name: 'Giường' }])
    expect(r.success).toBe(true)
    expect(r.data![0]).toMatchObject({ quantity: 1, condition: 'good', unit_value: null, note: null })
  })

  it('rejects case-insensitive duplicate names at the duplicate index', () => {
    const r = inventoryListSchema.safeParse([item('Giường'), item('Tủ'), item('giường')])
    expect(r.success).toBe(false)
    expect(r.error!.issues.map(i => i.path.join('.'))).toContain('2.name')
  })

  it.each([
    [{ name: '' }], [{ name: 'x'.repeat(101) }], [{ name: 'A', quantity: 0 }], [{ name: 'A', quantity: 1000 }],
    [{ name: 'A', condition: 'new' }], [{ name: 'A', unit_value: -1 }], [{ name: 'A', unit_value: 1.5 }],
    [{ name: 'A', note: 'x'.repeat(201) }],
  ])('rejects %j', (bad) => {
    expect(inventoryListSchema.safeParse([bad]).success).toBe(false)
  })

  it('rejects more than 50 items', () => {
    expect(inventoryListSchema.safeParse(Array.from({ length: 51 }, (_, i) => item(`M${i}`))).success).toBe(false)
  })
})

describe('inventoryApplySchema', () => {
  it('requires 1..200 uuids and a valid mode', () => {
    expect(inventoryApplySchema.safeParse({ room_ids: [], mode: 'merge' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: ['7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'], mode: 'wipe' }).success).toBe(false)
    expect(inventoryApplySchema.safeParse({ room_ids: ['7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f'], mode: 'replace' }).success).toBe(true)
  })
})

describe('roomBatchCreateSchema', () => {
  it('requires request_id and rejects slug duplicates', () => {
    const rooms = [{ room_number: 'P101', floor: 1, monthly_rent: 1, area: null }, { room_number: 'p101', floor: 1, monthly_rent: 1, area: null }]
    expect(roomBatchCreateSchema.safeParse({ rooms }).success).toBe(false)
    const r = roomBatchCreateSchema.safeParse({ request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f', rooms })
    expect(r.success).toBe(false)
  })
})

describe('inventoryTotalValue', () => {
  it('sums quantity * unit value, skipping nulls', () => {
    expect(inventoryTotalValue([{ quantity: 2, unitValue: 1000 }, { quantity: 1, unitValue: null }])).toBe(2000)
  })
})
