import type { SharedExpense } from '~/types/shared-expenses'
import type { ExpenseCategory } from '~/utils/constants/operations-report'

export interface SharedExpenseRow {
  id: string
  owner_id: string
  name: string
  category: string
  amount: number | string
  note: string | null
  is_active: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export function mapSharedExpense(
  row: SharedExpenseRow,
  buildingIds: string[],
): SharedExpense {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    note: row.note,
    isActive: row.is_active,
    buildingIds,
    createdBy: row.created_by,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}
