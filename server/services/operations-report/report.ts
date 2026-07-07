import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BuildingFixedCost,
  OperationsBreakdownEntry,
  OperationsReport,
  OperationsReportCloseSource,
  OperationsReportClosure,
  ReserveFundSummary,
  ReserveFundTransaction,
} from '~/types/operations-report'
import type {
  OperationsReportCloseInput,
  OperationsReportQuery,
  OperationsReportReopenInput,
} from '~/utils/validators/operations-report'
import {
  EXPENSE_CATEGORY_LABELS,
  FIXED_COST_CATEGORY_LABELS,
  REVENUE_CHARGE_TYPES,
  type ExpenseCategory,
  type FixedCostCategory,
} from '~/utils/constants/operations-report'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingExpenseRepository } from '../../repositories/operations-report/expenses'
import { BuildingFixedCostRepository } from '../../repositories/operations-report/fixed-costs'
import { OperationsReportPeriodRepository } from '../../repositories/operations-report/periods'
import { OperationsReportRepository } from '../../repositories/operations-report/report'
import { PrepaidExpenseService } from './prepaid-expenses'
import { ReserveFundService } from './reserve-funds'
import { assertBuildingScope } from '../../utils/scope'

const REVENUE_LABELS: Record<string, string> = {
  rent: 'Tiền phòng',
  electricity: 'Điện thu khách',
  water: 'Nước thu khách',
  service: 'Dịch vụ',
  discount: 'Giảm giá',
  surcharge: 'Phụ thu',
  adjustment: 'Điều chỉnh',
  other: 'Khác',
}

function ordinal(year: number, month: number): number {
  return year * 12 + month
}

function fixedCostApplies(cost: BuildingFixedCost, period: number): boolean {
  const from = ordinal(cost.effectiveFromPeriodYear, cost.effectiveFromPeriodMonth)
  const to =
    cost.effectiveToPeriodYear != null && cost.effectiveToPeriodMonth != null
      ? ordinal(cost.effectiveToPeriodYear, cost.effectiveToPeriodMonth)
      : null
  return from <= period && (to == null || period <= to)
}

function sumReserveTransactions(transactions: ReserveFundTransaction[]): number {
  return transactions.reduce(
    (sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount),
    0,
  )
}

async function buildReserveSummary(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
  periodYear: number,
  periodMonth: number,
  closure: OperationsReportClosure,
  issuedRevenue: number,
  issuedProfitByRevenue: number,
): Promise<ReserveFundSummary> {
  const fund = await ReserveFundService.get(event, user, buildingId)
  const rate = await ReserveFundService.findEffectiveRate(event, buildingId, periodYear, periodMonth)
  const monthlyTransactions = fund.transactions.filter(
    tx => tx.periodYear === periodYear && tx.periodMonth === periodMonth && !tx.voidedAt,
  )
  const accrual = monthlyTransactions.find(tx => tx.source === 'monthly_accrual')
  const monthlyDeduction = monthlyTransactions
    .filter(tx => tx.source === 'expense_deduction')
    .reduce((sum, tx) => sum + tx.amount, 0)
  const isClosedReport = closure.status === 'closed'
  const appliedAccrual = isClosedReport ? accrual : null
  const effectiveRatePercent = accrual?.reserveRatePercent ?? rate?.reserveRatePercent ?? 0
  const monthlyAccrualEstimated = Math.round((Math.max(issuedProfitByRevenue, 0) * effectiveRatePercent) / 100)
  const monthlyAccrualIsEstimated = !appliedAccrual
  const cumulativeBalance = sumReserveTransactions(fund.transactions.filter(tx => !tx.voidedAt))
  const monthlyAccrual = appliedAccrual?.amount ?? 0
  return {
    effectiveRatePercent,
    issuedRevenue: appliedAccrual?.issuedRevenue ?? issuedRevenue,
    monthlyAccrual,
    monthlyAccrualEstimated,
    monthlyAccrualIsEstimated,
    monthlyDeduction,
    monthlyBalance: monthlyAccrual - monthlyDeduction,
    cumulativeBalance,
    cumulativeBalanceIsEstimated: false,
  }
}

async function assertBuildingReadable(
  event: H3Event,
  user: AuthUser,
  buildingId: string,
  mode: 'read' | 'write',
) {
  const building = await BuildingRepository.findById(event, buildingId)
  if (!building) throwNotFound('Không tìm thấy tòa nhà')
  await assertBuildingScope(event, user, buildingId, mode)
}

async function buildReportSnapshot(
  event: H3Event,
  query: OperationsReportQuery,
): Promise<{
  billing: Awaited<ReturnType<typeof OperationsReportRepository.fetchBillingData>>
  closure: OperationsReportClosure
  issuedRevenue: number
  totalExpense: number
  profitByRevenue: number
}> {
  const period = ordinal(query.period_year, query.period_month)
  const [billing, allFixedCosts, expenses, prepaidItems, closure] = await Promise.all([
    OperationsReportRepository.fetchBillingData(
      event,
      query.building_id,
      query.period_year,
      query.period_month,
    ),
    BuildingFixedCostRepository.listByBuilding(event, query.building_id),
    BuildingExpenseRepository.list(event, {
      buildingId: query.building_id,
      periodYear: query.period_year,
      periodMonth: query.period_month,
    }),
    PrepaidExpenseService.listActiveAllocations(
      event,
      query.building_id,
      query.period_year,
      query.period_month,
    ),
    OperationsReportPeriodRepository.findOrOpen(
      event,
      query.building_id,
      query.period_year,
      query.period_month,
    ),
  ])

  const issuedRevenue = billing.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
  const fixedCostTotal = allFixedCosts
    .filter(cost => fixedCostApplies(cost, period))
    .reduce((sum, cost) => sum + cost.amount, 0)
  const monthlyExpenseTotal = expenses
    .filter(expense => expense.fundedBy !== 'reserve_fund')
    .reduce((sum, expense) => sum + expense.amount, 0)
  const prepaidAllocationTotal = prepaidItems.reduce((sum, item) => sum + item.monthlyAmount, 0)
  const totalExpense = fixedCostTotal + monthlyExpenseTotal + prepaidAllocationTotal

  return {
    billing,
    closure,
    issuedRevenue,
    totalExpense,
    profitByRevenue: issuedRevenue - totalExpense,
  }
}

async function closeReportPeriod(
  event: H3Event,
  user: AuthUser | null,
  query: OperationsReportCloseInput,
  closeSource: OperationsReportCloseSource,
): Promise<OperationsReportClosure> {
  if (user) {
    if (!can(user, 'operations-report.close')) throwForbidden('Không có quyền chốt báo cáo vận hành')
    await assertBuildingReadable(event, user, query.building_id, 'write')
  }
  else {
    const building = await BuildingRepository.findById(event, query.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
  }

  const snapshot = await buildReportSnapshot(event, query)
  await ReserveFundService.recordMonthlyAccrual(event, user, {
    buildingId: query.building_id,
    periodYear: query.period_year,
    periodMonth: query.period_month,
    billingPeriodId: snapshot.billing.periodId,
    issuedRevenue: snapshot.issuedRevenue,
    issuedProfitByRevenue: snapshot.profitByRevenue,
  })
  return OperationsReportPeriodRepository.close(event, {
    buildingId: query.building_id,
    periodYear: query.period_year,
    periodMonth: query.period_month,
    closeSource,
    closedBy: user?.id ?? null,
  })
}

export const OperationsReportService = {
  async getReport(
    event: H3Event,
    user: AuthUser,
    query: OperationsReportQuery,
  ): Promise<OperationsReport> {
    if (!can(user, 'operations-report.read')) throwForbidden('Không có quyền xem báo cáo vận hành')

    await assertBuildingReadable(event, user, query.building_id, 'read')

    const period = ordinal(query.period_year, query.period_month)

    const [billing, allFixedCosts, expenses, prepaidItems, closure] = await Promise.all([
      OperationsReportRepository.fetchBillingData(
        event,
        query.building_id,
        query.period_year,
        query.period_month,
      ),
      BuildingFixedCostRepository.listByBuilding(event, query.building_id),
      BuildingExpenseRepository.list(event, {
        buildingId: query.building_id,
        periodYear: query.period_year,
        periodMonth: query.period_month,
      }),
      PrepaidExpenseService.listActiveAllocations(
        event,
        query.building_id,
        query.period_year,
        query.period_month,
      ),
      OperationsReportPeriodRepository.findOrOpen(
        event,
        query.building_id,
        query.period_year,
        query.period_month,
      ),
    ])

    // --- Revenue ---------------------------------------------------------
    const issuedRevenue = billing.invoices.reduce((s, inv) => s + inv.totalAmount, 0)
    const collectedCash = billing.invoices.reduce((s, inv) => s + inv.collected, 0)
    const debt = billing.invoices.reduce((s, inv) => s + inv.balanceAmount, 0)

    const revenueMap = new Map<string, number>()
    for (const inv of billing.invoices) {
      for (const charge of inv.charges) {
        const key = (REVENUE_CHARGE_TYPES as readonly string[]).includes(charge.chargeType)
          ? charge.chargeType
          : 'other'
        revenueMap.set(key, (revenueMap.get(key) ?? 0) + charge.amount)
      }
    }
    const revenueByType: OperationsBreakdownEntry[] = [...revenueMap.entries()].map(
      ([key, amount]) => ({ key, label: REVENUE_LABELS[key] ?? key, amount }),
    )

    // --- Fixed costs (applicable to this period) -------------------------
    const applicableFixedCosts = allFixedCosts.filter(c => fixedCostApplies(c, period))
    const fixedCostTotal = applicableFixedCosts.reduce((s, c) => s + c.amount, 0)
    const fixedCostMap = new Map<string, number>()
    for (const cost of applicableFixedCosts) {
      fixedCostMap.set(cost.category, (fixedCostMap.get(cost.category) ?? 0) + cost.amount)
    }
    const fixedCostByCategory: OperationsBreakdownEntry[] = [...fixedCostMap.entries()].map(
      ([key, amount]) => ({
        key,
        label: FIXED_COST_CATEGORY_LABELS[key as FixedCostCategory] ?? key,
        amount,
      }),
    )

    // --- Monthly expenses ------------------------------------------------
    // Exclude reserve-funded expenses from operation profit calculation
    // (they're paid from reserve fund, tracked separately)
    const directExpenses = expenses.filter(e => e.fundedBy !== 'reserve_fund')
    const monthlyExpenseTotal = directExpenses.reduce((s, e) => s + e.amount, 0)
    const expenseMap = new Map<string, number>()
    for (const exp of directExpenses) {
      expenseMap.set(exp.category, (expenseMap.get(exp.category) ?? 0) + exp.amount)
    }
    const expenseByCategory: OperationsBreakdownEntry[] = [...expenseMap.entries()].map(
      ([key, amount]) => ({
        key,
        label: EXPENSE_CATEGORY_LABELS[key as ExpenseCategory] ?? key,
        amount,
      }),
    )

    const prepaidAllocationTotal = prepaidItems.reduce((s, item) => s + item.monthlyAmount, 0)
    const totalExpense = fixedCostTotal + monthlyExpenseTotal + prepaidAllocationTotal
    const reserveFund = can(user, 'reserve-fund.read')
      ? await buildReserveSummary(
          event,
          user,
          query.building_id,
          query.period_year,
          query.period_month,
          closure,
          issuedRevenue,
          issuedRevenue - totalExpense,
        )
      : null

    // --- Utility margins -------------------------------------------------
    const electricityCollected = revenueMap.get('electricity') ?? 0
    const electricityInput = expenseMap.get('electricity_input') ?? 0
    const waterCollected = revenueMap.get('water') ?? 0
    const waterInput = expenseMap.get('water_input') ?? 0

    return {
      buildingId: query.building_id,
      periodYear: query.period_year,
      periodMonth: query.period_month,
      billingPeriodStatus: billing.periodStatus,
      closure,
      metrics: {
        issuedRevenue,
        collectedCash,
        debt,
        fixedCostTotal,
        monthlyExpenseTotal,
        prepaidAllocationTotal,
        totalExpense,
        profitByRevenue: issuedRevenue - totalExpense,
        profitByCash: collectedCash - totalExpense,
      },
      revenueByType,
      expenseByCategory,
      fixedCostByCategory,
      electricity: {
        collected: electricityCollected,
        input: electricityInput,
        margin: electricityCollected - electricityInput,
      },
      water: {
        collected: waterCollected,
        input: waterInput,
        margin: waterCollected - waterInput,
      },
      reserveFund,
      fixedCosts: applicableFixedCosts,
      expenses,
      prepaidItems,
    }
  },

  async refreshReserveAccrual(
    event: H3Event,
    user: AuthUser,
    query: OperationsReportCloseInput,
  ) {
    if (!can(user, 'reserve-fund.refresh-accrual')) {
      throwForbidden('Không có quyền cập nhật quỹ dự phòng')
    }
    await assertBuildingReadable(event, user, query.building_id, 'write')
    const snapshot = await buildReportSnapshot(event, query)
    return ReserveFundService.recordMonthlyAccrual(event, user, {
      buildingId: query.building_id,
      periodYear: query.period_year,
      periodMonth: query.period_month,
      billingPeriodId: snapshot.billing.periodId,
      issuedRevenue: snapshot.issuedRevenue,
      issuedProfitByRevenue: snapshot.profitByRevenue,
    })
  },

  async close(
    event: H3Event,
    user: AuthUser,
    input: OperationsReportCloseInput,
  ): Promise<OperationsReportClosure> {
    return closeReportPeriod(event, user, input, 'manual')
  },

  async closeSystem(
    event: H3Event,
    input: OperationsReportCloseInput,
  ): Promise<OperationsReportClosure> {
    return closeReportPeriod(event, null, input, 'auto')
  },

  async reopen(
    event: H3Event,
    user: AuthUser,
    input: OperationsReportReopenInput,
  ): Promise<OperationsReportClosure> {
    if (!can(user, 'operations-report.reopen')) throwForbidden('Không có quyền mở lại báo cáo vận hành')
    await assertBuildingReadable(event, user, input.building_id, 'write')
    return OperationsReportPeriodRepository.reopen(event, {
      buildingId: input.building_id,
      periodYear: input.period_year,
      periodMonth: input.period_month,
      reopenedBy: user.id,
      reason: input.reason,
    })
  },
}
