import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense, BuildingReserveFundRate } from '~/types/operations-report'
import { can as realCan } from '../../../server/utils/permissions'

const findBuildingById = vi.fn()
const assertBuildingScope = vi.fn()
const createReserveFundedExpenseWithAudit = vi.fn()
const upsertExpenseDeduction = vi.fn()
const voidExpenseDeduction = vi.fn()
const upsertMonthlyAccrual = vi.fn()
const listRatesByBuilding = vi.fn()
const insertRate = vi.fn()
const findRateById = vi.fn()
const updateRateById = vi.fn()
const assertNoClosedReportsInRange = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/repositories/operations-report/reserve-funds', () => ({
  ReserveFundRepository: {
    upsertExpenseDeduction,
    voidExpenseDeduction,
    upsertMonthlyAccrual,
    listRatesByBuilding,
    insertRate,
    findRateById,
    updateRateById,
    createReserveFundedExpenseWithAudit,
  },
}))
vi.mock('../../../server/services/audit', () => ({ AuditService: { append: appendAudit } }))

vi.mock('../../../server/services/operations-report/locks', () => ({
  OperationsReportLockService: {
    assertNoClosedReportsInRange,
  },
}))

const owner = { id: 'owner-1', app_metadata: { role: 'owner' } } as AuthUser
const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

const expense = (overrides: Partial<BuildingExpense> = {}): BuildingExpense => ({
  id: 'expense-1',
  buildingId: 'building-1',
  periodYear: 2026,
  periodMonth: 7,
  expenseDate: '2026-07-05',
  category: 'repair',
  amount: 300,
  payee: null,
  paymentMethod: null,
  note: null,
  fundedBy: 'reserve_fund',
  receiptUrl: null,
  receiptSignedUrl: null,
  createdBy: 'owner-1',
  voidedAt: null,
  voidedBy: null,
  voidReason: null,
  createdAt: '2026-07-05T00:00:00Z',
  updatedAt: '2026-07-05T00:00:00Z',
  ...overrides,
})

const rate = (overrides: Partial<BuildingReserveFundRate> = {}): BuildingReserveFundRate => ({
  id: 'rate-1',
  buildingId: 'building-1',
  reserveRatePercent: 5,
  effectiveFromPeriodYear: 2026,
  effectiveFromPeriodMonth: 1,
  effectiveToPeriodYear: null,
  effectiveToPeriodMonth: null,
  createdBy: 'owner-1',
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

describe('ReserveFundService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    findBuildingById.mockResolvedValue({ id: 'building-1' })
    assertBuildingScope.mockResolvedValue(undefined)
    createReserveFundedExpenseWithAudit.mockResolvedValue({
      expense: expense(),
      deduction: { id: 'tx-1' },
    })
    upsertExpenseDeduction.mockResolvedValue({ id: 'tx-1' })
    voidExpenseDeduction.mockResolvedValue({ id: 'tx-1', voidedAt: '2026-07-05T00:00:00Z' })
    upsertMonthlyAccrual.mockResolvedValue({ id: 'accrual-1' })
    listRatesByBuilding.mockResolvedValue([rate()])
    insertRate.mockResolvedValue(rate())
    findRateById.mockResolvedValue(rate())
    updateRateById.mockResolvedValue(rate({ reserveRatePercent: 6 }))
    assertNoClosedReportsInRange.mockResolvedValue(undefined)
  })

  it('creates a reserve-funded expense and linked deduction without balance validation', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.createReserveFundedExpense({} as never, owner, {
      building_id: 'building-1',
      period_year: 2026,
      period_month: 7,
      expense_date: '2026-07-05',
      category: 'repair',
      amount: 300,
      note: 'repair',
      funded_by: 'reserve_fund',
    })

    expect(createReserveFundedExpenseWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      funded_by: 'reserve_fund',
    }), 'owner-1')
    expect(upsertExpenseDeduction).not.toHaveBeenCalled()
  })

  it('propagates an atomic reserve-funded expense RPC failure', async () => {
    createReserveFundedExpenseWithAudit.mockRejectedValueOnce(new Error('atomic write failed'))
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await expect(
      ReserveFundService.createReserveFundedExpense({} as never, owner, {
        building_id: 'building-1',
        period_year: 2026,
        period_month: 7,
        expense_date: '2026-07-05',
        category: 'repair',
        amount: 300,
        note: 'repair',
        funded_by: 'reserve_fund',
      }),
    ).rejects.toThrow('atomic write failed')
    expect(upsertExpenseDeduction).not.toHaveBeenCalled()
  })

  it('denies managers access to reserve fund management', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await expect(
      ReserveFundService.createReserveFundedExpense({} as never, manager, {
        building_id: 'building-1',
        period_year: 2026,
        period_month: 7,
        category: 'repair',
        amount: 100,
        funded_by: 'reserve_fund',
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(createReserveFundedExpenseWithAudit).not.toHaveBeenCalled()
  })

  it('voids the linked deduction when a reserve-funded expense is voided', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.voidExpenseDeduction(
      {} as never,
      owner,
      expense({ voidedAt: '2026-07-05T00:00:00Z', voidReason: 'duplicate' }),
    )

    expect(voidExpenseDeduction).toHaveBeenCalledWith(
      expect.anything(),
      'expense-1',
      'owner-1',
      'duplicate',
    )
  })

  it('records monthly accrual from issued profit and effective rate', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.recordMonthlyAccrual({} as never, owner, {
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      billingPeriodId: 'period-1',
      issuedRevenue: 10_000_000,
      issuedProfitByRevenue: 4_000_000,
    })

    expect(upsertMonthlyAccrual).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      billingPeriodId: 'period-1',
      issuedRevenue: 10_000_000,
      reserveRatePercent: 5,
      amount: 200_000,
    }))
  })

  it('records zero accrual when issued profit is negative', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.recordMonthlyAccrual({} as never, owner, {
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 8,
      billingPeriodId: 'period-2',
      issuedRevenue: 2_500_000,
      issuedProfitByRevenue: -1_000_000,
    })

    expect(upsertMonthlyAccrual).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 8,
      billingPeriodId: 'period-2',
      issuedRevenue: 2_500_000,
      reserveRatePercent: 5,
      amount: 0,
    }))
  })

  it('records zero-rate accrual when no effective reserve rate exists', async () => {
    listRatesByBuilding.mockResolvedValueOnce([])
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.recordMonthlyAccrual({} as never, owner, {
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 8,
      billingPeriodId: 'period-2',
      issuedRevenue: 2_500_000,
      issuedProfitByRevenue: 1_500_000,
    })

    expect(upsertMonthlyAccrual).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 8,
      billingPeriodId: 'period-2',
      issuedRevenue: 2_500_000,
      reserveRatePercent: 0,
      amount: 0,
    }))
  })

  it('rejects overlapping reserve rate ranges', async () => {
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await expect(
      ReserveFundService.createRate({} as never, owner, {
        building_id: 'building-1',
        reserve_rate_percent: 3,
        effective_from_period_year: 2026,
        effective_from_period_month: 7,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(insertRate).not.toHaveBeenCalled()
  })

  it('audits reserve rate create and update snapshots', async () => {
    listRatesByBuilding.mockResolvedValue([])
    const { ReserveFundService } = await import('../../../server/services/operations-report/reserve-funds')

    await ReserveFundService.createRate({} as never, owner, {
      building_id: 'building-1', reserve_rate_percent: 5,
      effective_from_period_year: 2026, effective_from_period_month: 1,
    })
    listRatesByBuilding.mockResolvedValue([])
    await ReserveFundService.updateRate({} as never, owner, 'rate-1', { reserve_rate_percent: 6 })

    expect(appendAudit).toHaveBeenCalledWith(expect.anything(), owner, expect.objectContaining({
      action: 'reserve_fund_rate.created', entity_type: 'reserve_fund_rate', after_data: expect.objectContaining({ id: 'rate-1' }),
    }))
    expect(appendAudit).toHaveBeenCalledWith(expect.anything(), owner, expect.objectContaining({
      action: 'reserve_fund_rate.updated', before_data: expect.objectContaining({ reserveRatePercent: 5 }), after_data: expect.objectContaining({ reserveRatePercent: 6 }),
    }))
  })
})
