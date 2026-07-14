import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan, AiMeterImportPreview } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiMeterPlanner } from '../../../server/services/ai/meter-planner'

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getMessage: vi.fn(),
  preview: vi.fn(),
  createPlan: vi.fn(),
  findReading: vi.fn(),
  findPeriod: vi.fn(),
  listInvoices: vi.fn(),
  assertScope: vi.fn(),
}))

vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))
vi.mock('../../../server/services/ai/conversations', () => ({ AiConversationService: { getOwnedUserMessage: mocks.getMessage } }))
vi.mock('../../../server/services/ai/meter-import-preview', () => ({ AiMeterImportPreviewService: { preview: mocks.preview } }))
vi.mock('../../../server/services/ai/actions', () => ({ AiActionService: { createPlan: mocks.createPlan } }))
vi.mock('../../../server/repositories/meter-readings', () => ({ MeterReadingRepository: { findById: mocks.findReading } }))
vi.mock('../../../server/repositories/billing/periods', () => ({ BillingPeriodRepository: { findByBuildingPeriod: mocks.findPeriod } }))
vi.mock('../../../server/repositories/billing/invoices', () => ({ InvoiceRepository: { listByPeriod: mocks.listInvoices } }))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope: mocks.assertScope }))

const event = {} as never
const actor = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser
const conversationId = '00000000-0000-4000-8000-000000000010'
const messageId = '00000000-0000-4000-8000-000000000011'
const building = {
  id: '00000000-0000-4000-8000-000000000001', slug: 'zeno', name: 'Zeno', address: '',
  status: 'active' as const, updatedAt: '2026-07-01T00:00:00.000Z',
}
const preview: AiMeterImportPreview = {
  building,
  billingPeriodId: '00000000-0000-4000-8000-000000000002',
  billingPeriodUpdatedAt: '2026-07-14T00:00:00.000Z',
  periodYear: 2026, periodMonth: 7, readingDate: '2026-07-31',
  rows: [{
    sourceLine: 2, roomId: '00000000-0000-4000-8000-000000000003', roomNumber: '101',
    meterType: 'electricity', readingValue: 1200.5, previousValue: 1100,
    existingReadingId: null, expectedUpdatedAt: null,
  }],
  warnings: [], blockers: [],
}

function actionPlan(actionType: string): AiActionPlan {
  return {
    id: '00000000-0000-4000-8000-000000000020', conversationId, userId: actor.id,
    buildingId: building.id, actionType, title: 'Plan', summary: 'Plan', normalizedPayload: {},
    payloadHash: 'a'.repeat(64), preview: {}, warnings: [], resourceVersions: {},
    idempotencyKey: '00000000-0000-4000-8000-000000000021', status: 'pending', result: null,
    error: null, expiresAt: '2026-07-14T01:00:00.000Z', confirmedAt: null, executedAt: null,
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
  }
}

describe('AiMeterPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.getMessage.mockResolvedValue({ id: messageId, content: 'room,electricity\n101,1200.5' })
    mocks.preview.mockResolvedValue({ status: 'preview', preview })
    mocks.createPlan.mockResolvedValue(actionPlan('import_meter_readings'))
  })

  it('stores the exact previewed numeric payload without asking the model to repeat it', async () => {
    await expect(AiMeterPlanner.planImport(event, actor, conversationId, messageId, {
      building_ref: 'Zeno', period_year: 2026, period_month: 7, reading_date: '2026-07-31',
    })).resolves.toMatchObject({ status: 'planned' })

    expect(mocks.getMessage).toHaveBeenCalledWith(event, actor, conversationId, messageId)
    expect(mocks.createPlan.mock.calls[0]?.[2]).toMatchObject({
      action_type: 'import_meter_readings',
      normalized_payload: {
        building_id: building.id,
        readings: [{ room_id: preview.rows[0]!.roomId, meter_type: 'electricity', reading_value: 1200.5, expected_updated_at: null }],
      },
    })
  })

  it('returns blockers and creates no action plan', async () => {
    mocks.preview.mockResolvedValue({
      status: 'preview',
      preview: { ...preview, blockers: [{ line: 2, field: 'room', code: 'room_not_found', message: 'Unknown' }] },
    })
    await expect(AiMeterPlanner.planImport(event, actor, conversationId, messageId, {
      building_ref: 'Zeno', period_year: 2026, period_month: 7, reading_date: '2026-07-31',
    })).resolves.toMatchObject({ status: 'blocked' })
    expect(mocks.createPlan).not.toHaveBeenCalled()
  })

  it('plans a correction with the current reading version', async () => {
    mocks.findReading.mockResolvedValue({
      id: preview.rows[0]!.existingReadingId ?? '00000000-0000-4000-8000-000000000030',
      roomId: preview.rows[0]!.roomId, buildingId: building.id, meterType: 'electricity',
      readingType: 'monthly', periodYear: 2026, periodMonth: 7, readingDate: '2026-07-31',
      readingValue: 1200, notes: null, updatedAt: '2026-07-14T00:00:00.000Z',
    })
    mocks.findPeriod.mockResolvedValue({ id: preview.billingPeriodId, status: 'draft' })
    mocks.listInvoices.mockResolvedValue([])
    mocks.createPlan.mockResolvedValue(actionPlan('update_meter_reading'))

    await AiMeterPlanner.planUpdate(event, actor, conversationId, {
      reading_id: '00000000-0000-4000-8000-000000000030', reading_value: 1250,
    })
    expect(mocks.createPlan.mock.calls[0]?.[2]).toMatchObject({
      action_type: 'update_meter_reading',
      normalized_payload: { reading_value: 1250, expected_updated_at: '2026-07-14T00:00:00.000Z' },
    })
  })
})
