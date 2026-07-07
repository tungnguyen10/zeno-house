import type {
  ExpenseCategory,
  FixedCostCategory,
  PrepaidExpenseStatus,
  RecurringExpenseFrequency,
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
  fundedBy: 'direct' | 'reserve_fund'
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

export type ReserveFundTransactionType = 'deposit' | 'withdrawal'
export type ReserveFundTransactionSource = 'manual' | 'monthly_accrual' | 'expense_deduction'

export interface BuildingReserveFundRate {
  id: string
  buildingId: string
  reserveRatePercent: number
  effectiveFromPeriodYear: number
  effectiveFromPeriodMonth: number
  effectiveToPeriodYear: number | null
  effectiveToPeriodMonth: number | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface ReserveFundTransaction {
  id: string
  fundId: string
  type: ReserveFundTransactionType
  source: ReserveFundTransactionSource
  amount: number
  date: string
  periodYear: number | null
  periodMonth: number | null
  billingPeriodId: string | null
  reserveRatePercent: number | null
  issuedRevenue: number | null
  linkedExpenseId: string | null
  note: string | null
  createdBy: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: string
}

export interface ReserveFund {
  id: string
  buildingId: string
  balance: number
  createdAt: string
  transactions: ReserveFundTransaction[]
}

export interface ReserveFundSummary {
  effectiveRatePercent: number
  issuedRevenue: number
  monthlyAccrual: number
  monthlyAccrualEstimated: number
  monthlyAccrualIsEstimated: boolean
  monthlyDeduction: number
  monthlyBalance: number
  cumulativeBalance: number
  cumulativeBalanceIsEstimated: boolean
}

/** A building-scoped recurring expense reminder template. */
export interface RecurringExpense {
  id: string
  buildingId: string
  name: string
  category: ExpenseCategory
  frequency: RecurringExpenseFrequency
  anchorDay: number
  estimatedAmount: number
  isActive: boolean
  nextReminderAt: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** Expense modal prefill returned when acting on a recurring reminder. */
export interface RecurringExpenseRecordPrefill {
  buildingId: string
  periodYear: number
  periodMonth: number
  expenseDate: string
  category: ExpenseCategory
  amount: number
  note: string
}

/** A prepaid expense allocated across a fixed number of covered months. */
export interface PrepaidExpense {
  id: string
  buildingId: string
  name: string
  category: ExpenseCategory
  totalAmount: number
  totalMonths: number
  startDate: string
  endDate: string
  monthlyAmount: number
  status: PrepaidExpenseStatus
  receiptUrl: string | null
  note: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** One prepaid monthly allocation contributing to a report period. */
export interface PrepaidExpenseAllocation {
  id: string
  name: string
  category: ExpenseCategory
  monthlyAmount: number
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
    prepaidAllocationTotal: number
    totalExpense: number
    profitByRevenue: number
    profitByCash: number
  }
  revenueByType: OperationsBreakdownEntry[]
  expenseByCategory: OperationsBreakdownEntry[]
  fixedCostByCategory: OperationsBreakdownEntry[]
  electricity: UtilityMargin
  water: UtilityMargin
  reserveFund: ReserveFundSummary | null
  fixedCosts: BuildingFixedCost[]
  expenses: BuildingExpense[]
  prepaidItems: PrepaidExpenseAllocation[]
}

export type RevenueChargeTypeKey = RevenueChargeType
