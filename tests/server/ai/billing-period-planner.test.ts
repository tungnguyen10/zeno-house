import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionPlan } from '~/types/ai'
import type { AuthUser } from '~/types/auth'
import { AiBillingPeriodPlanner } from '../../../server/services/ai/billing-period-planner'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  findPeriod: vi.fn(),
  createPlan: vi.fn(),
  can: vi.fn(),
}))

vi.mock('../../../server/services/ai/buildings', () => ({ AiBuildingService: { resolve: mocks.resolve } }))
vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findByBuildingPeriod: mocks.findPeriod },
}))
vi.mock('../../../server/services/ai/actions', () => ({ AiActionService: { createPlan: mocks.createPlan } }))
vi.mock('../../../server/utils/permissions', () => ({ can: mocks.can }))

const event = {} as never
const actor = { id: 'user-1', app_metadata: { role: 'manager' } } as AuthUser
const building = {
  id: '00000000-0000-4000-8000-000000000001', slug: 'zeno-central', name: 'Zeno Central',
  address: '1 Main', status: 'active' as const, updatedAt: '2026-07-14T00:00:00.000Z',
}
const input = { building_ref: 'Zeno Central', period_year: 2026, period_month: 7 }

function actionPlan(): AiActionPlan {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    conversationId: '00000000-0000-4000-8000-000000000003',
    userId: actor.id,
    buildingId: building.id,
    actionType: 'open_billing_period',
    title: 'Mở kỳ 07/2026',
    summary: 'Tạo kỳ',
    normalizedPayload: { building_id: building.id, period_year: 2026, period_month: 7 },
    payloadHash: 'a'.repeat(64),
    preview: {},
    warnings: [],
    resourceVersions: { building: building.updatedAt },
    idempotencyKey: '00000000-0000-4000-8000-000000000004',
    status: 'pending', result: null, error: null,
    expiresAt: '2026-07-14T01:00:00.000Z', confirmedAt: null, executedAt: null,
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z',
  }
}

describe('AiBillingPeriodPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
  })

  it('returns candidates and creates no plan for an ambiguous name', async () => {
    mocks.resolve.mockResolvedValue({ status: 'ambiguous', candidates: [building, { ...building, id: 'building-2' }] })
    await expect(AiBillingPeriodPlanner.planOpen(event, actor, actionPlan().conversationId, input))
      .resolves.toMatchObject({ status: 'needs_clarification' })
    expect(mocks.findPeriod).not.toHaveBeenCalled()
    expect(mocks.createPlan).not.toHaveBeenCalled()
  })

  it('returns an existing period without creating a plan or audit', async () => {
    const period = { id: 'period-1', buildingId: building.id, periodYear: 2026, periodMonth: 7, status: 'draft' }
    mocks.resolve.mockResolvedValue({ status: 'resolved', building })
    mocks.findPeriod.mockResolvedValue(period)

    await expect(AiBillingPeriodPlanner.planOpen(event, actor, actionPlan().conversationId, input)).resolves.toEqual({
      status: 'already_exists', building, period,
    })
    expect(mocks.createPlan).not.toHaveBeenCalled()
  })

  it('creates a normalized server action plan without confirmation or idempotency input', async () => {
    const plan = actionPlan()
    mocks.resolve.mockResolvedValue({ status: 'resolved', building })
    mocks.findPeriod.mockResolvedValue(null)
    mocks.createPlan.mockResolvedValue(plan)

    await expect(AiBillingPeriodPlanner.planOpen(event, actor, plan.conversationId, input)).resolves.toMatchObject({
      status: 'planned', actionPlan: { id: plan.id, status: 'pending' },
    })
    const createInput = mocks.createPlan.mock.calls[0]?.[2]
    expect(createInput).toMatchObject({
      conversation_id: plan.conversationId,
      building_id: building.id,
      action_type: 'open_billing_period',
      normalized_payload: { building_id: building.id, period_year: 2026, period_month: 7 },
      resource_versions: { building: building.updatedAt },
    })
    expect(JSON.stringify(createInput)).not.toContain('confirmed')
    expect(JSON.stringify(createInput)).not.toContain('idempotency')
  })
})
