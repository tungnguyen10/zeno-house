import type {
  ExpenseCategory,
  FixedCostCategory,
  RevenueChargeType,
} from '~/utils/constants/operations-report'

/** A monthly one-off building expense (soft-voidable financial record). */
export interface BuildingExpense {
  id: string
  buildingId: string
  periodYear: number
  periodMonth: number
  expenseDate: string | null
  category: ExpenseCategory
  amount: number
  payee: string | null
  paymentMethod: string | null
  note: string | null
  receiptUrl: string | null
  receiptSignedUrl: string | null
  createdBy: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: string
  updatedAt: string
}

/** A recurring building fixed cost with a period-based effective range. */
export interface BuildingFixedCost {
  id: string
  buildingId: string
  category: FixedCostCategory
  amount: number
  effectiveFromPeriodYear: number
  effectiveFromPeriodMonth: number
  effectiveToPeriodYear: number | null
  effectiveToPeriodMonth: number | null
  note: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** One value in a keyed breakdown (revenue charge type or expense category). */
export interface OperationsBreakdownEntry {
  key: string
  label: string
  amount: number
}

/** Input vs output margin for a single utility (electricity or water). */
export interface UtilityMargin {
  collected: number
  input: number
  margin: number
}

/** Aggregated building/month operations report. */
export interface OperationsReport {
  buildingId: string
  periodYear: number
  periodMonth: number
  metrics: {
    issuedRevenue: number
    collectedCash: number
    debt: number
    fixedCostTotal: number
    monthlyExpenseTotal: number
    totalExpense: number
    profitByRevenue: number
    profitByCash: number
  }
  revenueByType: OperationsBreakdownEntry[]
  expenseByCategory: OperationsBreakdownEntry[]
  fixedCostByCategory: OperationsBreakdownEntry[]
  electricity: UtilityMargin
  water: UtilityMargin
  fixedCosts: BuildingFixedCost[]
  expenses: BuildingExpense[]
}

export type RevenueChargeTypeKey = RevenueChargeType
