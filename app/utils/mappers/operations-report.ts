import type { Tables } from '~/types/database.types'
import type {
  BuildingExpense,
  BuildingFixedCost,
  PrepaidExpense,
  ReserveFund,
  ReserveFundTransaction,
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

export interface ReserveFundTransactionRow {
  id: string
  fund_id: string
  type: string
  amount: number | string
  date: string
  linked_expense_id: string | null
  note: string | null
  created_by: string | null
  created_at: string | null
}

export function mapReserveFundTransaction(row: ReserveFundTransactionRow): ReserveFundTransaction {
  return {
    id: row.id,
    fundId: row.fund_id,
    type: row.type as ReserveFundTransactionType,
    amount: Number(row.amount),
    date: row.date,
    linkedExpenseId: row.linked_expense_id,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
  }
}

export function mapReserveFund(
  row: ReserveFundRow,
  transactions: ReserveFundTransaction[],
): ReserveFund {
  const balance = transactions.reduce(
    (sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount),
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
