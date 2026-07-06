import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingFixedCost } from '~/types/operations-report'

const findBuildingByIdentifier = vi.fn()
const findFixedCostById = vi.fn()
const listFixedCosts = vi.fn()
const insertFixedCost = vi.fn()
const updateFixedCostById = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findByIdentifier: findBuildingByIdentifier },
}))

vi.mock('../../../server/repositories/operations-report/fixed-costs', () => ({
  BuildingFixedCostRepository: {
    findById: findFixedCostById,
    listByBuilding: listFixedCosts,
    insert: insertFixedCost,
    updateById: updateFixedCostById,
  },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: appendAudit },
}))

const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser

function fixedCost(overrides: Partial<BuildingFixedCost> = {}): BuildingFixedCost {
  return {
    id: 'fixed-cost-1',
    buildingId: 'building-1',
    category: 'rent',
    amount: 10_000_000,
    effectiveFromPeriodYear: 2026,
    effectiveFromPeriodMonth: 1,
    effectiveToPeriodYear: null,
    effectiveToPeriodMonth: null,
    note: null,
    createdBy: 'owner-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('BuildingFixedCostService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', name: 'Building 1' })
    assertBuildingScope.mockResolvedValue(undefined)
    appendAudit.mockResolvedValue(undefined)
  })

  it('rejects overlapping fixed-cost ranges for the same building and category', async () => {
    listFixedCosts.mockResolvedValue([
      fixedCost({
        effectiveFromPeriodYear: 2026,
        effectiveFromPeriodMonth: 1,
        effectiveToPeriodYear: 2026,
        effectiveToPeriodMonth: 6,
      }),
    ])

    const { BuildingFixedCostService } = await import(
      '../../../server/services/operations-report/fixed-costs'
    )

    await expect(
      BuildingFixedCostService.create({} as never, owner, {
        building_id: 'building-1',
        category: 'rent',
        amount: 12_000_000,
        effective_from_period_year: 2026,
        effective_from_period_month: 6,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(insertFixedCost).not.toHaveBeenCalled()
    expect(appendAudit).not.toHaveBeenCalled()
  })

  it('allows a later non-overlapping fixed-cost range and audits creation', async () => {
    const created = fixedCost({
      id: 'fixed-cost-2',
      amount: 12_000_000,
      effectiveFromPeriodYear: 2026,
      effectiveFromPeriodMonth: 7,
    })
    listFixedCosts.mockResolvedValue([
      fixedCost({
        effectiveFromPeriodYear: 2026,
        effectiveFromPeriodMonth: 1,
        effectiveToPeriodYear: 2026,
        effectiveToPeriodMonth: 6,
      }),
    ])
    insertFixedCost.mockResolvedValue(created)

    const { BuildingFixedCostService } = await import(
      '../../../server/services/operations-report/fixed-costs'
    )

    await expect(
      BuildingFixedCostService.create({} as never, owner, {
        building_id: 'building-1',
        category: 'rent',
        amount: 12_000_000,
        effective_from_period_year: 2026,
        effective_from_period_month: 7,
      }),
    ).resolves.toEqual(created)

    expect(insertFixedCost).toHaveBeenCalledWith(
      expect.anything(),
      {
        building_id: 'building-1',
        category: 'rent',
        amount: 12_000_000,
        effective_from_period_year: 2026,
        effective_from_period_month: 7,
      },
      'owner-1',
    )
    expect(appendAudit).toHaveBeenCalledWith(
      expect.anything(),
      owner,
      expect.objectContaining({
        action: 'building_fixed_cost.created',
        entity_type: 'building_fixed_cost',
        entity_id: 'fixed-cost-2',
        after_data: created,
      }),
    )
  })
})
