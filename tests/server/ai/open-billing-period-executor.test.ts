import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AI_ACTION_EXECUTORS } from '../../../server/services/ai/executors'
import { OPEN_BILLING_PERIOD_EXECUTOR } from '../../../server/services/ai/open-billing-period-executor'

const mocks = vi.hoisted(() => ({ findBuilding: vi.fn(), open: vi.fn() }))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: mocks.findBuilding },
}))
vi.mock('../../../server/services/billing/periods', () => ({
  BillingPeriodService: { openOrGetWithResult: mocks.open },
}))

const actor = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser
const event = {} as never

function plan(overrides: Partial<AiActionPlan> = {}): AiActionPlan {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    conversationId: '00000000-0000-4000-8000-000000000002',
    userId: actor.id,
    buildingId: '00000000-0000-4000-8000-000000000003',
    actionType: 'open_billing_period', title: 'Open', summary: 'Open period',
    normalizedPayload: {
      building_id: '00000000-0000-4000-8000-000000000003', period_year: 2026, period_month: 7,
    },
    payloadHash: 'a'.repeat(64), preview: {}, warnings: [],
    resourceVersions: { building: 'v1' },
    idempotencyKey: '00000000-0000-4000-8000-000000000004',
    status: 'executing', result: null, error: null,
    expiresAt: '2026-07-14T01:00:00.000Z', confirmedAt: '2026-07-14T00:00:00.000Z', executedAt: null,
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
    ...overrides,
  }
}

describe('open billing period executor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('remains registered alongside the meter action executors', () => {
    expect(Object.keys(AI_ACTION_EXECUTORS)).toEqual([
      'open_billing_period', 'import_meter_readings', 'update_meter_reading', 'save_utility_usage_override',
      'issue_invoices', 'void_invoice', 'reissue_invoice', 'add_invoice_adjustment',
    ])
    expect(AI_ACTION_EXECUTORS.open_billing_period).toBe(OPEN_BILLING_PERIOD_EXECUTOR)
  })

  it('marks a changed building version as an optimistic conflict', async () => {
    mocks.findBuilding.mockResolvedValue({ id: plan().buildingId, updatedAt: 'v2' })
    await expect(OPEN_BILLING_PERIOD_EXECUTOR.revalidate?.({
      event, user: actor, plan: plan(), idempotencyKey: plan().idempotencyKey,
    })).rejects.toMatchObject({
      statusCode: 409,
      data: { error: { details: { category: 'OPTIMISTIC_LOCK_CONFLICT' } } },
    })
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('passes only server plan correlation into the atomic billing service', async () => {
    const current = plan()
    mocks.findBuilding.mockResolvedValue({ id: current.buildingId, updatedAt: 'v1' })
    mocks.open.mockResolvedValue({ period: { id: 'period-1' }, created: true })

    await OPEN_BILLING_PERIOD_EXECUTOR.revalidate?.({
      event, user: actor, plan: current, idempotencyKey: current.idempotencyKey,
    })
    await expect(OPEN_BILLING_PERIOD_EXECUTOR.execute({
      event, user: actor, plan: current, idempotencyKey: current.idempotencyKey,
    })).resolves.toEqual({ period: { id: 'period-1' }, created: true })
    expect(mocks.open).toHaveBeenCalledWith(event, actor, {
      building_id: current.buildingId, period_year: 2026, period_month: 7,
    }, {
      source: 'ai', actionPlanId: current.id, idempotencyKey: current.idempotencyKey,
    })
  })
})
