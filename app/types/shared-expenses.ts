import type { ExpenseCategory } from '~/utils/constants/operations-report'

export interface SharedExpense {
  id: string
  ownerId: string
  name: string
  category: ExpenseCategory
  amount: number
  note: string | null
  isActive: boolean
  buildingIds: string[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface SharedExpenseListItem extends SharedExpense {
  isAllocatedForPeriod: boolean
}

export interface SharedExpenseListMeta extends Record<string, unknown> {
  periodYear: number
  periodMonth: number
}

export interface SharedExpenseAllocationResult {
  sharedExpenseId: string
  periodYear: number
  periodMonth: number
  generatedExpenses: {
    buildingId: string
    expenseId: string
    amount: number
  }[]
}
