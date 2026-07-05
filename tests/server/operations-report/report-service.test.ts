import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense, BuildingFixedCost } from '~/types/operations-report'
import type { ReportBillingData } from '../../../server/repositories/operations-report/report'

const findBuildingById = vi.fn()
const fetchBillingData = vi.fn()
const listFixedCosts = vi.fn()
const listExpenses = vi.fn()
const assertBuildingScope = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/repositories/operations-report/report', () => ({
  OperationsReportRepository: { fetchBillingData },
}))

vi.mock('../../../server/repositories/operations-report/fixed-costs', () => ({
  BuildingFixedCostRepository: { listByBuilding: listFixedCosts },
}))

vi.mock('../../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: { list: listExpenses },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

const admin = { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser

function fixedCost(overrides: Partial<BuildingFixedCost>): BuildingFixedCost {
  return {
    id: 'fc-1',
    buildingId: 'building-1',
    category: 'rent',
    amount: 10_000_000,
    effectiveFromPeriodYear: 2026,
    effectiveFromPeriodMonth: 1,
    effectiveToPeriodYear: null,
    effectiveToPeriodMonth: null,
    note: null,
    receiptUrl: null,
    receiptSignedUrl: null,
    createdBy: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function expense(overrides: Partial<BuildingExpense>): BuildingExpense {
  return {
    id: 'exp-1',
    buildingId: 'building-1',
    periodYear: 2026,
    periodMonth: 6,
    expenseDate: '2026-06-10',
    category: 'other',
    amount: 500_000,
    payee: null,
    paymentMethod: null,
    note: null,
    createdBy: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    createdAt: '2026-06-10T00:00:00Z',
    updatedAt: '2026-06-10T00:00:00Z',
    ...overrides,
  }
}

const billing: ReportBillingData = {
  periodId: 'period-1',
  invoices: [
    {
      id: 'inv-1',
      totalAmount: 5_000_000,
      balanceAmount: 1_000_000,
      collected: 4_000_000,
      charges: [
        { chargeType: 'rent', amount: 3_000_000 },
        { chargeType: 'electricity', amount: 1_500_000 },
        { chargeType: 'water', amount: 500_000 },
      ],
    },
  ],
}

describe('OperationsReportService.getReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findBuildingById.mockResolvedValue({ id: 'building-1', name: 'Building 1' })
    assertBuildingScope.mockResolvedValue(undefined)
    fetchBillingData.mockResolvedValue(billing)
    listFixedCosts.mockResolvedValue([fixedCost({})])
    listExpenses.mockResolvedValue([
      expense({ category: 'electricity_input', amount: 900_000 }),
      expense({ id: 'exp-2', category: 'water_input', amount: 200_000 }),
      expense({ id: 'exp-3', category: 'repair', amount: 300_000 }),
    ])
  })

  async function run() {
    const { OperationsReportService } = await import(
      '../../../server/services/operations-report/report'
    )
    return OperationsReportService.getReport({} as never, admin, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
    })
  }

  it('aggregates revenue, expenses, fixed costs and profit metrics', async () => {
    const report = await run()

    expect(report.metrics.issuedRevenue).toBe(5_000_000)
    expect(report.metrics.collectedCash).toBe(4_000_000)
    expect(report.metrics.debt).toBe(1_000_000)

    // Fixed cost (rent, open-ended, started before period) applies.
    expect(report.metrics.fixedCostTotal).toBe(10_000_000)
    // Monthly expenses: 900k + 200k + 300k
    expect(report.metrics.monthlyExpenseTotal).toBe(1_400_000)
    expect(report.metrics.totalExpense).toBe(11_400_000)

    expect(report.metrics.profitByRevenue).toBe(5_000_000 - 11_400_000)
    expect(report.metrics.profitByCash).toBe(4_000_000 - 11_400_000)
  })

  it('computes utility margins from revenue vs input expenses', async () => {
    const report = await run()

    expect(report.electricity).toEqual({
      collected: 1_500_000,
      input: 900_000,
      margin: 600_000,
    })
    expect(report.water).toEqual({
      collected: 500_000,
      input: 200_000,
      margin: 300_000,
    })
  })

  it('excludes fixed costs that ended before the report period', async () => {
    listFixedCosts.mockResolvedValue([
      fixedCost({ effectiveToPeriodYear: 2026, effectiveToPeriodMonth: 3 }),
    ])

    const report = await run()

    expect(report.metrics.fixedCostTotal).toBe(0)
    expect(report.fixedCosts).toHaveLength(0)
  })

  it('enforces read scope on the requested building', async () => {
    await run()
    expect(assertBuildingScope).toHaveBeenCalledWith(
      expect.anything(),
      admin,
      'building-1',
      'read',
    )
  })
})
