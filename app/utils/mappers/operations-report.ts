import type { Tables } from '~/types/database.types'
import type {
  BuildingExpense,
  BuildingFixedCost,
  BuildingReserveFundRate,
  OperationsReportClosure,
  PrepaidExpense,
  ReserveFund,
  ReserveFundTransaction,
  ReserveFundTransactionSource,
  ReserveFundTransactionType,
  RecurringExpense,
} from '~/types/operations-report'
import type {
  ExpenseCategory,
  FixedCostCategory,
  PrepaidExpenseStatus,
  RecurringExpenseFrequency,
} from '~/utils/constants/operations-report'

export interface RecurringExpenseRow {
  id: string
  building_id: string
  name: string
  category: string
  frequency: string
  anchor_day: number
  estimated_amount: number | string
  is_active: boolean
  next_reminder_at: string
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PrepaidExpenseRow {
  id: string
  building_id: string
  name: string
  category: string
  total_amount: number | string
  total_months: number
  start_date: string
  end_date: string
  monthly_amount: number | string
  status: string
  receipt_url: string | null
  note: string | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface OperationsReportPeriodRow {
  id: string
  building_id: string
  period_year: number
  period_month: number
  status: string
  close_source: string | null
  closed_at: string | null
  closed_by: string | null
  reopened_at: string | null
  reopened_by: string | null
  reopen_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export function mapOperationsReportClosure(
  row: OperationsReportPeriodRow,
): OperationsReportClosure {
  return {
    id: row.id,
    buildingId: row.building_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    status: row.status === 'closed' ? 'closed' : 'open',
    closeSource: row.close_source === 'manual' || row.close_source === 'auto'
      ? row.close_source
      : null,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    reopenedAt: row.reopened_at,
    reopenedBy: row.reopened_by,
    reopenReason: row.reopen_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function openOperationsReportClosure(input: {
  buildingId: string
  periodYear: number
  periodMonth: number
}): OperationsReportClosure {
  return {
    id: null,
    buildingId: input.buildingId,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    status: 'open',
    closeSource: null,
    closedAt: null,
    closedBy: null,
    reopenedAt: null,
    reopenedBy: null,
    reopenReason: null,
    createdAt: null,
    updatedAt: null,
  }
}

export function mapBuildingExpense(row: Tables<'building_expenses'>): BuildingExpense {
  return {
    id: row.id,
    buildingId: row.building_id,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    expenseDate: row.expense_date,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    payee: row.payee,
    paymentMethod: row.payment_method,
    note: row.note,
    fundedBy: (row.funded_by ?? 'direct') as 'direct' | 'reserve_fund',
    receiptUrl: row.receipt_url,
    receiptSignedUrl: null,
    createdBy: row.created_by,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapBuildingFixedCost(row: Tables<'building_fixed_costs'>): BuildingFixedCost {
  return {
    id: row.id,
    buildingId: row.building_id,
    category: row.category as FixedCostCategory,
    amount: Number(row.amount),
    effectiveFromPeriodYear: row.effective_from_period_year,
    effectiveFromPeriodMonth: row.effective_from_period_month,
    effectiveToPeriodYear: row.effective_to_period_year,
    effectiveToPeriodMonth: row.effective_to_period_month,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export interface ReserveFundRow {
  id: string
  building_id: string
  created_at: string | null
}

export interface BuildingReserveFundRateRow {
  id: string
  building_id: string
  reserve_rate_percent: number | string
  effective_from_period_year: number
  effective_from_period_month: number
  effective_to_period_year: number | null
  effective_to_period_month: number | null
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ReserveFundTransactionRow {
  id: string
  fund_id: string
  type: string
  source: string | null
  amount: number | string
  date: string
  period_year: number | null
  period_month: number | null
  billing_period_id: string | null
  reserve_rate_percent: number | string | null
  issued_revenue: number | string | null
  linked_expense_id: string | null
  note: string | null
  created_by: string | null
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
  created_at: string | null
}

export function mapBuildingReserveFundRate(
  row: BuildingReserveFundRateRow,
): BuildingReserveFundRate {
  return {
    id: row.id,
    buildingId: row.building_id,
    reserveRatePercent: Number(row.reserve_rate_percent),
    effectiveFromPeriodYear: row.effective_from_period_year,
    effectiveFromPeriodMonth: row.effective_from_period_month,
    effectiveToPeriodYear: row.effective_to_period_year,
    effectiveToPeriodMonth: row.effective_to_period_month,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapReserveFundTransaction(row: ReserveFundTransactionRow): ReserveFundTransaction {
  return {
    id: row.id,
    fundId: row.fund_id,
    type: row.type as ReserveFundTransactionType,
    source: (row.source ?? 'manual') as ReserveFundTransactionSource,
    amount: Number(row.amount),
    date: row.date,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    billingPeriodId: row.billing_period_id,
    reserveRatePercent: row.reserve_rate_percent == null ? null : Number(row.reserve_rate_percent),
    issuedRevenue: row.issued_revenue == null ? null : Number(row.issued_revenue),
    linkedExpenseId: row.linked_expense_id,
    note: row.note,
    createdBy: row.created_by,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    createdAt: row.created_at ?? '',
  }
}

export function mapReserveFund(
  row: ReserveFundRow,
  transactions: ReserveFundTransaction[],
): ReserveFund {
  const balance = transactions.reduce(
    (sum, tx) => {
      if (tx.voidedAt) return sum
      return sum + (tx.type === 'deposit' ? tx.amount : -tx.amount)
    },
    0,
  )
  return {
    id: row.id,
    buildingId: row.building_id,
    balance,
    createdAt: row.created_at ?? '',
    transactions,
  }
}

export function mapRecurringExpense(row: RecurringExpenseRow): RecurringExpense {
  return {
    id: row.id,
    buildingId: row.building_id,
    name: row.name,
    category: row.category as ExpenseCategory,
    frequency: row.frequency as RecurringExpenseFrequency,
    anchorDay: row.anchor_day,
    estimatedAmount: Number(row.estimated_amount),
    isActive: row.is_active,
    nextReminderAt: row.next_reminder_at,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export function mapPrepaidExpense(row: PrepaidExpenseRow): PrepaidExpense {
  return {
    id: row.id,
    buildingId: row.building_id,
    name: row.name,
    category: row.category as ExpenseCategory,
    totalAmount: Number(row.total_amount),
    totalMonths: row.total_months,
    startDate: row.start_date,
    endDate: row.end_date,
    monthlyAmount: Number(row.monthly_amount),
    status: row.status as PrepaidExpenseStatus,
    receiptUrl: row.receipt_url,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}
