import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type {
  BuildingFixedCost,
  OperationsBreakdownEntry,
  OperationsReport,
} from '~/types/operations-report'
import type { OperationsReportQuery } from '~/utils/validators/operations-report'
import {
  EXPENSE_CATEGORY_LABELS,
  FIXED_COST_CATEGORY_LABELS,
  REVENUE_CHARGE_TYPES,
  type ExpenseCategory,
  type FixedCostCategory,
} from '~/utils/constants/operations-report'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingFixedCostRepository } from '../../repositories/operations-report/fixed-costs'
import { OperationsReportRepository } from '../../repositories/operations-report/report'
import { BuildingExpenseService } from './expenses'
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

export const OperationsReportService = {
  async getReport(
    event: H3Event,
    user: AuthUser,
    query: OperationsReportQuery,
  ): Promise<OperationsReport> {
    if (!can(user, 'operations-report.read')) throwForbidden('Không có quyền xem báo cáo vận hành')

    const building = await BuildingRepository.findById(event, query.building_id)
    if (!building) throwNotFound('Không tìm thấy tòa nhà')
    await assertBuildingScope(event, user, query.building_id, 'read')

    const period = ordinal(query.period_year, query.period_month)

    const [billing, allFixedCosts, expenses] = await Promise.all([
      OperationsReportRepository.fetchBillingData(
        event,
        query.building_id,
        query.period_year,
        query.period_month,
      ),
      BuildingFixedCostRepository.listByBuilding(event, query.building_id),
      BuildingExpenseService.list(event, user, {
        building_id: query.building_id,
        period_year: query.period_year,
        period_month: query.period_month,
      }),
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
    const monthlyExpenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
    const expenseMap = new Map<string, number>()
    for (const exp of expenses) {
      expenseMap.set(exp.category, (expenseMap.get(exp.category) ?? 0) + exp.amount)
    }
    const expenseByCategory: OperationsBreakdownEntry[] = [...expenseMap.entries()].map(
      ([key, amount]) => ({
        key,
        label: EXPENSE_CATEGORY_LABELS[key as ExpenseCategory] ?? key,
        amount,
      }),
    )

    const totalExpense = fixedCostTotal + monthlyExpenseTotal

    // --- Utility margins -------------------------------------------------
    const electricityCollected = revenueMap.get('electricity') ?? 0
    const electricityInput = expenseMap.get('electricity_input') ?? 0
    const waterCollected = revenueMap.get('water') ?? 0
    const waterInput = expenseMap.get('water_input') ?? 0

    return {
      buildingId: query.building_id,
      periodYear: query.period_year,
      periodMonth: query.period_month,
      metrics: {
        issuedRevenue,
        collectedCash,
        debt,
        fixedCostTotal,
        monthlyExpenseTotal,
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
      fixedCosts: applicableFixedCosts,
      expenses,
    }
  },
}
