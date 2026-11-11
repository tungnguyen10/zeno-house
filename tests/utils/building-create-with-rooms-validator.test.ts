import { describe, expect, it } from 'vitest'
import { buildingCreateWithRoomsSchema, QUICK_ROOM_MAX } from '~/utils/validators/buildings'

const base = { name: 'Tòa A', address: '123 Lê Lợi, Quận 1' }
const room = (n: string, extra: Record<string, unknown> = {}) => ({
  room_number: n, floor: 1, monthly_rent: 3_000_000, area: null, ...extra,
})

describe('buildingCreateWithRoomsSchema', () => {
  it('accepts a building without rooms', () => {
    expect(buildingCreateWithRoomsSchema.safeParse(base).success).toBe(true)
  })

  it('accepts rooms with a uuid request_id', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({
      ...base,
      request_id: '7d0b3f7e-8f43-4a8e-9a4f-1f2b3c4d5e6f',
      rooms: [room('P101'), room('P102', { floor: 2, area: 20 })],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid request_id', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({ ...base, request_id: 'abc' })
    expect(r.success).toBe(false)
  })

  it('rejects floor outside 1..100', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({ ...base, rooms: [room('P1', { floor: 0 })] })
    expect(r.success).toBe(false)
    const r2 = buildingCreateWithRoomsSchema.safeParse({ ...base, rooms: [room('P1', { floor: 101 })] })
    expect(r2.success).toBe(false)
  })

  it(`rejects more than ${QUICK_ROOM_MAX} rooms`, () => {
    const rooms = Array.from({ length: QUICK_ROOM_MAX + 1 }, (_, i) => room(`P${i + 1}`))
    expect(buildingCreateWithRoomsSchema.safeParse({ ...base, rooms }).success).toBe(false)
  })

  it('reports duplicates (including same slug) at the duplicated index', () => {
    const r = buildingCreateWithRoomsSchema.safeParse({
      ...base,
      rooms: [room('P101'), room('P102'), room('p101')],
    })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map(i => i.path.join('.'))
    expect(paths).toContain('rooms.2.room_number')
  })

  it('rejects an empty room batch', () => {
    expect(buildingCreateWithRoomsSchema.safeParse({ ...base, rooms: [] }).success).toBe(false)
  })
})
