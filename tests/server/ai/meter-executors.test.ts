import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { IMPORT_METER_READINGS_EXECUTOR, UPDATE_METER_READING_EXECUTOR } from '../../../server/services/ai/meter-executors'

const mocks = vi.hoisted(() => ({ commitImport: vi.fn(), update: vi.fn() }))
vi.mock('../../../server/services/meter-readings', () => ({
  MeterReadingService: { commitMonthlyImport: mocks.commitImport, update: mocks.update },
}))

const event = {} as never
const user = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser

function plan(actionType: string, normalizedPayload: Record<string, unknown>): AiActionPlan {
  return {
    id: '00000000-0000-4000-8000-000000000001', conversationId: '00000000-0000-4000-8000-000000000002',
    userId: user.id, buildingId: '00000000-0000-4000-8000-000000000003', actionType,
    title: 'Plan', summary: 'Plan', normalizedPayload, payloadHash: 'a'.repeat(64), preview: {}, warnings: [],
    resourceVersions: {}, idempotencyKey: '00000000-0000-4000-8000-000000000004', status: 'executing',
    result: null, error: null, expiresAt: '', confirmedAt: '', executedAt: null, createdAt: '', updatedAt: '',
  }
}

describe('AI meter executors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('commits the exact stored import payload with server correlation', async () => {
    const payload = {
      building_id: '00000000-0000-4000-8000-000000000003', period_year: 2026, period_month: 7,
      reading_date: '2026-07-31', readings: [{
        room_id: '00000000-0000-4000-8000-000000000005', meter_type: 'electricity',
        reading_value: 1200.5, expected_updated_at: null,
      }],
    }
    const current = plan('import_meter_readings', payload)
    mocks.commitImport.mockResolvedValue([])
    await IMPORT_METER_READINGS_EXECUTOR.execute({ event, user, plan: current, idempotencyKey: current.idempotencyKey })
    expect(mocks.commitImport).toHaveBeenCalledWith(event, user, payload, {
      source: 'ai', actionPlanId: current.id, idempotencyKey: current.idempotencyKey,
    })
  })

  it('propagates the stored correction version to the atomic update', async () => {
    const current = plan('update_meter_reading', {
      reading_id: '00000000-0000-4000-8000-000000000005', reading_value: 1250,
      expected_updated_at: '2026-07-14T00:00:00.000Z',
    })
    mocks.update.mockResolvedValue({})
    await UPDATE_METER_READING_EXECUTOR.execute({ event, user, plan: current, idempotencyKey: current.idempotencyKey })
    expect(mocks.update).toHaveBeenCalledWith(event, user, '00000000-0000-4000-8000-000000000005', {
      reading_value: 1250, expected_updated_at: '2026-07-14T00:00:00.000Z',
    }, { source: 'ai', actionPlanId: current.id, idempotencyKey: current.idempotencyKey })
  })
})
