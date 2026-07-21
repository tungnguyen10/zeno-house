import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense, BuildingFixedCost } from '~/types/operations-report'
import type { ReportBillingData } from '../../../server/repositories/operations-report/report'
import { can as realCan } from '../../../server/utils/permissions'

const findBuildingById = vi.fn()
const fetchSnapshot = vi.fn()
const listFixedCosts = vi.fn()
const listExpenses = vi.fn()
const listActiveAllocations = vi.fn()
const getReserveFund = vi.fn()
const findEffectiveRate = vi.fn()
const findOrOpenClosure = vi.fn()
const closeClosure = vi.fn()
const reopenClosure = vi.fn()
const closeWithAccrualAndAudit = vi.fn()
const reopenWithAudit = vi.fn()
const recordMonthlyAccrual = vi.fn()
const refreshAccrualWithAudit = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/repositories/operations-report/report', () => ({
  OperationsReportRepository: { fetchSnapshot },
}))

vi.mock('../../../server/repositories/operations-report/periods', () => ({
  OperationsReportPeriodRepository: {
    findOrOpen: findOrOpenClosure,
    close: closeClosure,
    reopen: reopenClosure,
    closeWithAccrualAndAudit,
    reopenWithAudit,
  },
}))

vi.mock('../../../server/repositories/operations-report/fixed-costs', () => ({
  BuildingFixedCostRepository: { listByBuilding: listFixedCosts },
}))

vi.mock('../../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: { list: listExpenses },
}))

vi.mock('../../../server/services/operations-report/prepaid-expenses', () => ({
  PrepaidExpenseService: { listActiveAllocations },
}))

vi.mock('../../../server/services/operations-report/reserve-funds', () => ({
  ReserveFundService: {
    get: getReserveFund,
    findEffectiveRate,
    recordMonthlyAccrual,
    refreshAccrualWithAudit,
  },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

const admin = { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser
const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser

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
    fundedBy: 'direct',
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
  periodStatus: 'closed',
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
  beforeEach(async () => {
    vi.clearAllMocks()
    const { clearOperationsReportCache } = await import('../../../server/services/operations-report/cache')
    clearOperationsReportCache()
    vi.stubGlobal('can', realCan)
    findBuildingById.mockResolvedValue({ id: 'building-1', name: 'Building 1' })
    assertBuildingScope.mockResolvedValue(undefined)
    listFixedCosts.mockResolvedValue([fixedCost({})])
    listExpenses.mockResolvedValue([
      expense({ category: 'electricity_input', amount: 900_000 }),
      expense({ id: 'exp-2', category: 'water_input', amount: 200_000 }),
      expense({ id: 'exp-3', category: 'repair', amount: 300_000 }),
    ])
    listActiveAllocations.mockResolvedValue([
      { id: 'prepaid-1', name: 'Internet năm', category: 'internet', monthlyAmount: 250_000 },
    ])
    findOrOpenClosure.mockResolvedValue({
      id: 'closure-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 6,
      status: 'closed',
      closeSource: 'manual',
      closedAt: '2026-06-30T16:55:00Z',
      closedBy: 'admin-1',
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
      createdAt: '',
      updatedAt: '',
    })
    closeClosure.mockResolvedValue({
      id: 'closure-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 6,
      status: 'closed',
      closeSource: 'manual',
      closedAt: '2026-06-30T16:55:00Z',
      closedBy: 'admin-1',
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
      createdAt: '',
      updatedAt: '',
    })
    closeWithAccrualAndAudit.mockImplementation(closeClosure)
    reopenClosure.mockResolvedValue({
      id: 'closure-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 6,
      status: 'open',
      closeSource: null,
      closedAt: null,
      closedBy: null,
      reopenedAt: '2026-06-30T17:00:00Z',
      reopenedBy: 'admin-1',
      reopenReason: 'fix expense',
      createdAt: '',
      updatedAt: '',
    })
    reopenWithAudit.mockImplementation(reopenClosure)
    recordMonthlyAccrual.mockResolvedValue({ id: 'accrual-1' })
    refreshAccrualWithAudit.mockResolvedValue({ id: 'accrual-1' })
    findEffectiveRate.mockResolvedValue({ reserveRatePercent: 5 })
    getReserveFund.mockResolvedValue({
      id: 'fund-1',
      buildingId: 'building-1',
      balance: 100_000,
      createdAt: '',
      transactions: [
        {
          id: 'accrual-1',
          fundId: 'fund-1',
          type: 'deposit',
          source: 'monthly_accrual',
          amount: 250_000,
          date: '2026-06-01',
          periodYear: 2026,
          periodMonth: 6,
          billingPeriodId: 'period-1',
          reserveRatePercent: 5,
          issuedRevenue: 5_000_000,
          linkedExpenseId: null,
          note: null,
          createdBy: 'admin-1',
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
          createdAt: '',
        },
        {
          id: 'deduction-1',
          fundId: 'fund-1',
          type: 'withdrawal',
          source: 'expense_deduction',
          amount: 300_000,
          date: '2026-06-10',
          periodYear: 2026,
          periodMonth: 6,
          billingPeriodId: null,
          reserveRatePercent: null,
          issuedRevenue: null,
          linkedExpenseId: 'exp-3',
          note: null,
          createdBy: 'admin-1',
          voidedAt: null,
          voidedBy: null,
          voidReason: null,
          createdAt: '',
        },
      ],
    })
    fetchSnapshot.mockImplementation(async () => {
      const fund = await getReserveFund()
      const rate = await findEffectiveRate()
      return {
        billing,
        fixedCosts: await listFixedCosts(),
        expenses: await listExpenses(),
        prepaidItems: await listActiveAllocations(),
        closure: await findOrOpenClosure(),
        reserveTransactions: fund.transactions,
        reserveRate: rate,
      }
    })
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
    expect(report.metrics.prepaidAllocationTotal).toBe(250_000)
    expect(report.metrics.totalExpense).toBe(11_650_000)

    expect(report.metrics.profitByRevenue).toBe(5_000_000 - 11_650_000)
    expect(report.metrics.profitByCash).toBe(4_000_000 - 11_650_000)
    expect(report.closure.status).toBe('closed')
    expect(report.billingPeriodStatus).toBe('closed')
    expect(report.prepaidItems).toHaveLength(1)
    expect(report.reserveFund).toEqual({
      effectiveRatePercent: 5,
      issuedRevenue: 5_000_000,
      monthlyAccrual: 250_000,
      monthlyAccrualEstimated: 0,
      monthlyAccrualIsEstimated: false,
      monthlyDeduction: 300_000,
      monthlyBalance: -50_000,
      cumulativeBalance: -50_000,
      cumulativeBalanceIsEstimated: false,
    })
  })

  it('reuses a scoped closed-period report snapshot', async () => {
    const first = await run()
    const second = await run()

    expect(second).toBe(first)
    expect(fetchSnapshot).toHaveBeenCalledTimes(1)
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

  it('does not expose reserve details when user lacks reserve-fund.read', async () => {
    const { OperationsReportService } = await import(
      '../../../server/services/operations-report/report'
    )

    const report = await OperationsReportService.getReport({} as never, manager, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
    })

    expect(report.reserveFund).toBeNull()
  })

  it('uses estimated monthly accrual when report is open', async () => {
    findOrOpenClosure.mockResolvedValueOnce({
      id: 'closure-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 6,
      status: 'open',
      closeSource: null,
      closedAt: null,
      closedBy: null,
      reopenedAt: '2026-06-30T17:00:00Z',
      reopenedBy: 'admin-1',
      reopenReason: 'fix expense',
      createdAt: '',
      updatedAt: '',
    })
    const { OperationsReportService } = await import(
      '../../../server/services/operations-report/report'
    )

    const report = await OperationsReportService.getReport({} as never, admin, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
    })

    expect(report.reserveFund).toMatchObject({
      monthlyAccrual: 0,
      monthlyAccrualEstimated: 0,
      monthlyAccrualIsEstimated: true,
      cumulativeBalance: -50_000,
      cumulativeBalanceIsEstimated: false,
    })
  })

  it('closes report and refreshes reserve accrual from latest operations profit', async () => {
    const { OperationsReportService } = await import(
      '../../../server/services/operations-report/report'
    )

    const closure = await OperationsReportService.close({} as never, admin, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
    })

    expect(closure.status).toBe('closed')
    expect(recordMonthlyAccrual).not.toHaveBeenCalled()
    expect(closeWithAccrualAndAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      closeSource: 'manual',
      closedBy: 'admin-1',
      issuedRevenue: 5_000_000,
    }))
    expect(appendAudit).not.toHaveBeenCalled()
  })

  it('denies owner manual close and refresh accrual controls', async () => {
    const { OperationsReportService } = await import(
      '../../../server/services/operations-report/report'
    )

    await expect(
      OperationsReportService.close({} as never, owner, {
        building_id: 'building-1',
        period_year: 2026,
        period_month: 6,
      }),
    ).rejects.toMatchObject({ statusCode: 403 })

    await expect(
      OperationsReportService.refreshReserveAccrual({} as never, owner, {
        building_id: 'building-1',
        period_year: 2026,
        period_month: 6,
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('system close refreshes accrual and marks close source auto', async () => {
    const { OperationsReportService } = await import(
      '../../../server/services/operations-report/report'
    )

    await OperationsReportService.closeSystem({} as never, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
    })

    expect(recordMonthlyAccrual).not.toHaveBeenCalled()
    expect(closeWithAccrualAndAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      closeSource: 'auto',
      closedBy: null,
    }))
    expect(appendAudit).not.toHaveBeenCalled()
  })

  it('audits reserve refresh and report reopen', async () => {
    const { OperationsReportService } = await import('../../../server/services/operations-report/report')

    await OperationsReportService.refreshReserveAccrual({} as never, admin, {
      building_id: 'building-1', period_year: 2026, period_month: 6,
    })
    await OperationsReportService.reopen({} as never, admin, {
      building_id: 'building-1', period_year: 2026, period_month: 6, reason: 'fix expense',
    })

    expect(refreshAccrualWithAudit).toHaveBeenCalled()
    expect(reopenWithAudit).toHaveBeenCalled()
    expect(appendAudit).not.toHaveBeenCalled()
  })
})
