import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('app/pages/dashboard/shared-expenses.vue', 'utf8')

describe('shared-expenses workspace composition', () => {
  it('is list-first and delegates focused workflows to modal components', () => {
    expect(source).toContain('useSharedExpenses(periodYear, periodMonth)')
    expect(source).toContain('<SharedExpenseList')
    expect(source).toContain('<SharedExpenseFormModal')
    expect(source).toContain('<SharedExpenseAllocationModal')
    expect(source).not.toContain('<SharedExpensesSharedExpense')
    expect(source).toContain('<UiConfirmModal')
    expect(source).not.toContain('xl:grid-cols-[minmax(320px,420px)_1fr]')
    expect(source).not.toContain('<form')
  })

  it('tracks each mutation independently', () => {
    expect(source).toContain('const saving = ref(false)')
    expect(source).toContain('const allocatingId = ref<string | null>(null)')
    expect(source).toContain('const deactivatingId = ref<string | null>(null)')
    expect(source).toContain('const reactivatingId = ref<string | null>(null)')
    expect(source).toContain("updateSharedExpense(item.id, { is_active: true })")
  })

  it('keeps permission, fetch error, retry, and successful empty states distinct', () => {
    expect(source).toContain('v-if="!canRead"')
    expect(source).toContain('v-if="listError"')
    expect(source).toContain('@click="refreshSharedExpenses()"')
    expect(source).toContain(':loading="sharedExpensesLoading"')
  })
})
