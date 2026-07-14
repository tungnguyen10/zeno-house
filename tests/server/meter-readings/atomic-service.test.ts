import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { MeterReadingService } from '../../../server/services/meter-readings'

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  assertScope: vi.fn(),
  findExisting: vi.fn(),
  findById: vi.fn(),
  saveWithAudit: vi.fn(),
}))

vi.mock('../../../server/utils/db', () => ({ db: mocks.db }))
vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope: mocks.assertScope,
  getAssignedBuildingIds: vi.fn(),
}))
vi.mock('../../../server/repositories/meter-readings', () => ({
  MeterReadingRepository: {
    findExistingByConflictKeys: mocks.findExisting,
    findById: mocks.findById,
    saveWithAudit: mocks.saveWithAudit,
  },
}))

const event = {} as never
const actor = { id: '00000000-0000-4000-8000-000000000010', app_metadata: { role: 'manager' } } as AuthUser
const existing = {
  id: '00000000-0000-4000-8000-000000000001',
  roomId: '00000000-0000-4000-8000-000000000002',
  buildingId: '00000000-0000-4000-8000-000000000003',
  meterType: 'electricity' as const, readingType: 'monthly' as const,
  periodYear: 2026, periodMonth: 7, readingDate: '2026-07-31', readingValue: 1200,
  isEstimated: false, notes: null, recordedBy: actor.id,
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
}

describe('MeterReadingService atomic write paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.assertScope.mockResolvedValue(undefined)
  })

  it('passes PATCH expected version and a full normalized row to the atomic RPC', async () => {
    mocks.findById.mockResolvedValue(existing)
    mocks.saveWithAudit.mockResolvedValue([{ ...existing, readingValue: 1250 }])

    await MeterReadingService.update(event, actor, existing.id, {
      reading_value: 1250,
      expected_updated_at: existing.updatedAt,
    })

    expect(mocks.saveWithAudit).toHaveBeenCalledWith(event, [{
      room_id: existing.roomId,
      meter_type: existing.meterType,
      period_year: existing.periodYear,
      period_month: existing.periodMonth,
      reading_type: existing.readingType,
      reading_date: existing.readingDate,
      reading_value: 1250,
      is_estimated: false,
      notes: null,
      expected_updated_at: existing.updatedAt,
    }], { actor_id: actor.id, source: 'api' })
  })

  it('captures current versions and submits one all-or-nothing bulk RPC', async () => {
    const roomRows = [
      { id: existing.roomId, building_id: existing.buildingId },
      { id: '00000000-0000-4000-8000-000000000004', building_id: existing.buildingId },
    ]
    mocks.db.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: roomRows, error: null }) })),
      })),
    })
    const key = `${existing.roomId}:electricity:2026:7:monthly`
    mocks.findExisting.mockResolvedValue(new Map([[key, existing]]))
    mocks.saveWithAudit.mockResolvedValue([existing, { ...existing, id: 'reading-2', roomId: roomRows[1]!.id }])

    await MeterReadingService.bulkCreate(event, actor, { readings: [
      { room_id: existing.roomId, meter_type: 'electricity', reading_type: 'monthly', period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 1250 },
      { room_id: roomRows[1]!.id, meter_type: 'water', reading_type: 'monthly', period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 30 },
    ] }, actor.id)

    expect(mocks.saveWithAudit).toHaveBeenCalledTimes(1)
    expect(mocks.saveWithAudit.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ room_id: existing.roomId, expected_updated_at: existing.updatedAt }),
      expect.objectContaining({ room_id: roomRows[1]!.id, expected_updated_at: null }),
    ])
  })

  it('rejects a duplicate single create before dispatching the RPC', async () => {
    mocks.db.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { building_id: existing.buildingId } }) })),
        })),
      })),
    })
    mocks.findExisting.mockResolvedValue(new Map([['existing', existing]]))

    await expect(MeterReadingService.create(event, actor, {
      room_id: existing.roomId, meter_type: 'electricity', reading_type: 'monthly',
      period_year: 2026, period_month: 7, reading_date: '2026-07-31', reading_value: 1250,
    }, actor.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.saveWithAudit).not.toHaveBeenCalled()
  })
})
