import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findRoomByIdentifier: vi.fn(),
  findLatestByRoom: vi.fn(),
}))

vi.mock('../../../server/repositories/meter-readings', () => ({
  MeterReadingRepository: {
    findLatestByRoom: mocks.findLatestByRoom,
  },
}))

vi.mock('../../../server/repositories/rooms', () => ({
  RoomRepository: {
    findByIdentifier: mocks.findRoomByIdentifier,
  },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: vi.fn(),
  },
}))

describe('MeterReadingService.getLatestByRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns latest reading per meter type', async () => {
    mocks.findRoomByIdentifier.mockResolvedValue({ id: 'room-1' })
    mocks.findLatestByRoom.mockResolvedValue({
      electricity: { id: 'r-e', readingValue: 1200, meterType: 'electricity' },
      water: { id: 'r-w', readingValue: 75, meterType: 'water' },
    })
    const { MeterReadingService } = await import('../../../server/services/meter-readings')

    const result = await MeterReadingService.getLatestByRoom(
      {} as never,
      { id: 'user-1' } as never,
      'room-1',
    )

    expect(mocks.findRoomByIdentifier).toHaveBeenCalledWith(expect.anything(), 'room-1')
    expect(mocks.findLatestByRoom).toHaveBeenCalledWith(expect.anything(), 'room-1', {})
    expect(result.electricity?.readingValue).toBe(1200)
    expect(result.water?.readingValue).toBe(75)
  })

  it('returns nulls for a brand new room with no readings', async () => {
    mocks.findRoomByIdentifier.mockResolvedValue({ id: 'room-1' })
    mocks.findLatestByRoom.mockResolvedValue({ electricity: null, water: null })
    const { MeterReadingService } = await import('../../../server/services/meter-readings')

    const result = await MeterReadingService.getLatestByRoom(
      {} as never,
      { id: 'user-1' } as never,
      'room-1',
    )

    expect(result.electricity).toBeNull()
    expect(result.water).toBeNull()
  })

  it('throws when the room does not exist', async () => {
    mocks.findRoomByIdentifier.mockResolvedValue(null)
    const { MeterReadingService } = await import('../../../server/services/meter-readings')

    await expect(
      MeterReadingService.getLatestByRoom({} as never, { id: 'user-1' } as never, 'missing'),
    ).rejects.toThrow()
    expect(mocks.findLatestByRoom).not.toHaveBeenCalled()
  })
})
