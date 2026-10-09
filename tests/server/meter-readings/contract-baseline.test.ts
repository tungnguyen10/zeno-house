import { describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db }))

describe('monthly room status after a tenancy change', () => {
  it('presents the current occupant handover as previous reading', async () => {
    const results = [
      [{ id: 'room-1', room_number: '101', floor: 1, contracts: [{ id: 'new-contract', start_date: '2026-05-16', end_date: null, status: 'active' }] }],
      [{ id: 'current', room_id: 'room-1', meter_type: 'electricity', reading_value: 125 }],
      [{ id: 'previous', room_id: 'room-1', meter_type: 'electricity', reading_value: 100 }],
      [{ id: 'other', room_id: 'room-1', contract_id: 'old-contract', meter_type: 'electricity', reading_value: 110 }, { id: 'own', room_id: 'room-1', contract_id: 'new-contract', meter_type: 'electricity', reading_value: 120 }],
    ]
    db.mockReturnValue({ from: () => {
      const data = results.shift()
      const query = { select: () => query, eq: () => query, order: () => query, in: () => query, then: (resolve: (value: unknown) => void) => Promise.resolve({ data, error: null }).then(resolve) }
      return query
    } })
    const { MeterReadingRepository } = await import('../../../server/repositories/meter-readings')
    const rooms = await MeterReadingRepository.findBuildingRoomsStatus({} as never, 'building-1', 2026, 5)
    expect(rooms[0]?.devices[0]?.previousReading).toMatchObject({ id: 'own', readingValue: 120 })
  })
})
