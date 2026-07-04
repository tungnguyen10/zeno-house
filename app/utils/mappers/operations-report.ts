import type { Tables } from '~/types/database.types'
import type { BuildingExpense, BuildingFixedCost } from '~/types/operations-report'
import type { ExpenseCategory, FixedCostCategory } from '~/utils/constants/operations-report'

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
