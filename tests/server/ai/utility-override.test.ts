import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiUtilityOverridePlanner } from '../../../server/services/ai/utility-override-planner'
import { SAVE_UTILITY_USAGE_OVERRIDE_EXECUTOR } from '../../../server/services/ai/utility-override-executor'

const mocks = vi.hoisted(() => ({
  can: vi.fn(), resolveBuilding: vi.fn(), findPeriod: vi.fn(), listRooms: vi.fn(),
  listInvoices: vi.fn(), findOverride: vi.fn(), createPlan: vi.fn(), saveOverride: vi.fn(),
}))
vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))
vi.mock('../../../server/services/ai/buildings', () => ({ AiBuildingService: { resolve: mocks.resolveBuilding } }))
vi.mock('../../../server/repositories/billing/periods', () => ({ BillingPeriodRepository: { findByBuildingPeriod: mocks.findPeriod } }))
vi.mock('../../../server/repositories/rooms', () => ({ RoomRepository: { listByBuilding: mocks.listRooms } }))
vi.mock('../../../server/repositories/billing/invoices', () => ({ InvoiceRepository: { listByPeriod: mocks.listInvoices } }))
vi.mock('../../../server/repositories/billing/utility-usages', () => ({ BillingUtilityUsageRepository: { findByPeriodRoomMeter: mocks.findOverride } }))
vi.mock('../../../server/services/ai/actions', () => ({ AiActionService: { createPlan: mocks.createPlan } }))
vi.mock('../../../server/services/billing/utility-usages', () => ({ BillingUtilityUsageService: { saveOverride: mocks.saveOverride } }))

const event = {} as never
const user = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser
const conversationId = '00000000-0000-4000-8000-000000000001'
const building = { id: '00000000-0000-4000-8000-000000000002', slug: 'zeno', name: 'Zeno', address: '', status: 'active', updatedAt: 'v1' }
const period = { id: '00000000-0000-4000-8000-000000000003', buildingId: building.id, periodYear: 2026, periodMonth: 7, status: 'draft', updatedAt: 'v2' }
const room = { id: '00000000-0000-4000-8000-000000000004', buildingId: building.id, roomNumber: '101', code: 'Z-101', slug: '101' }
const input = {
  building_ref: 'Zeno', period_year: 2026, period_month: 7, room_ref: '101',
  meter_type: 'electricity' as const, previous_reading_value: 100, current_reading_value: 90,
  billable_usage: 10, reason: 'correction' as const, note: 'Đính chính chỉ số điện',
}

function actionPlan(payload: Record<string, unknown>): AiActionPlan {
  return {
    id: '00000000-0000-4000-8000-000000000010', conversationId, userId: user.id,
    buildingId: building.id, actionType: 'save_utility_usage_override', title: 'Override', summary: 'Override',
    normalizedPayload: payload, payloadHash: 'a'.repeat(64), preview: {}, warnings: [], resourceVersions: {},
    idempotencyKey: '00000000-0000-4000-8000-000000000011', status: 'executing', result: null, error: null,
    expiresAt: '', confirmedAt: '', executedAt: null, createdAt: '', updatedAt: '',
  }
}

describe('AI utility usage override operation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
    mocks.resolveBuilding.mockResolvedValue({ status: 'resolved', building })
    mocks.findPeriod.mockResolvedValue(period)
    mocks.listRooms.mockResolvedValue([room])
    mocks.listInvoices.mockResolvedValue([])
    mocks.findOverride.mockResolvedValue(null)
    mocks.createPlan.mockResolvedValue(actionPlan({}))
  })

  it('plans a normalized absent-version override and does not save it', async () => {
    await expect(AiUtilityOverridePlanner.plan(event, user, conversationId, input))
      .resolves.toMatchObject({ status: 'planned' })
    expect(mocks.createPlan.mock.calls[0]?.[2]).toMatchObject({
      action_type: 'save_utility_usage_override',
      normalized_payload: {
        billing_period_id: period.id,
        override: { room_id: room.id, billable_usage: 10, expected_updated_at: null },
      },
    })
    expect(mocks.saveOverride).not.toHaveBeenCalled()
  })

  it('rejects planning when an active invoice locks the room', async () => {
    mocks.listInvoices.mockResolvedValue([{ roomId: room.id, status: 'issued' }])
    await expect(AiUtilityOverridePlanner.plan(event, user, conversationId, input))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.createPlan).not.toHaveBeenCalled()
  })

  it('commits only through the confirmed executor with server correlation', async () => {
    const payload = {
      billing_period_id: period.id,
      override: {
        room_id: room.id, meter_type: 'electricity', previous_reading_value: 100,
        current_reading_value: 90, billable_usage: 10, reason: 'correction',
        note: 'Đính chính chỉ số điện', expected_updated_at: null,
      },
    }
    const plan = actionPlan(payload)
    mocks.saveOverride.mockResolvedValue({ id: 'override-1' })
    await SAVE_UTILITY_USAGE_OVERRIDE_EXECUTOR.execute({ event, user, plan, idempotencyKey: plan.idempotencyKey })
    expect(mocks.saveOverride).toHaveBeenCalledWith(event, user, period.id, payload.override, {
      source: 'ai', actionPlanId: plan.id, idempotencyKey: plan.idempotencyKey,
    })
  })
})
