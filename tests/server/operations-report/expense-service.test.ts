import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense } from '~/types/operations-report'

const findBuildingById = vi.fn()
const findExpenseById = vi.fn()
const insertExpense = vi.fn()
const updateExpenseById = vi.fn()
const voidExpenseById = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: {
    findById: findExpenseById,
    insert: insertExpense,
    updateById: updateExpenseById,
    voidById: voidExpenseById,
  },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: appendAudit },
}))

const admin = { id: 'admin-1', app_metadata: { role: 'admin' } } as AuthUser

function expense(overrides: Partial<BuildingExpense> = {}): BuildingExpense {
  return {
    id: 'expense-1',
    buildingId: 'building-1',
    periodYear: 2026,
    periodMonth: 6,
    expenseDate: '2026-06-12',
    category: 'repair',
    amount: 750_000,
    payee: null,
    paymentMethod: null,
    note: null,
    createdBy: 'admin-1',
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    receiptUrl: null,
    receiptSignedUrl: null,
    createdAt: '2026-06-12T00:00:00Z',
    updatedAt: '2026-06-12T00:00:00Z',
    ...overrides,
  }
}

describe('BuildingExpenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findBuildingById.mockResolvedValue({ id: 'building-1', name: 'Building 1' })
    assertBuildingScope.mockResolvedValue(undefined)
    appendAudit.mockResolvedValue(undefined)
  })

  it('soft-voids an expense with void metadata and audit', async () => {
    const existing = expense()
    const voided = expense({
      voidedAt: '2026-06-20T00:00:00Z',
      voidedBy: 'admin-1',
      voidReason: 'duplicate entry',
    })
    findExpenseById.mockResolvedValue(existing)
    voidExpenseById.mockResolvedValue(voided)

    const { BuildingExpenseService } = await import(
      '../../../server/services/operations-report/expenses'
    )

    await expect(
      BuildingExpenseService.void({} as never, admin, 'expense-1', 'duplicate entry'),
    ).resolves.toEqual(voided)

    expect(assertBuildingScope).toHaveBeenCalledWith(
      expect.anything(),
      admin,
      'building-1',
      'write',
    )
    expect(voidExpenseById).toHaveBeenCalledWith(
      expect.anything(),
      'expense-1',
      'admin-1',
      'duplicate entry',
    )
    expect(appendAudit).toHaveBeenCalledWith(
      expect.anything(),
      admin,
      expect.objectContaining({
        action: 'building_expense.voided',
        entity_type: 'building_expense',
        entity_id: 'expense-1',
        before_data: existing,
        after_data: voided,
        metadata: { void_reason: 'duplicate entry' },
      }),
    )
  })

  it('rejects updates to already-voided expenses', async () => {
    findExpenseById.mockResolvedValue(expense({ voidedAt: '2026-06-20T00:00:00Z' }))

    const { BuildingExpenseService } = await import(
      '../../../server/services/operations-report/expenses'
    )

    await expect(
      BuildingExpenseService.update({} as never, admin, 'expense-1', { amount: 900_000 }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(updateExpenseById).not.toHaveBeenCalled()
    expect(appendAudit).not.toHaveBeenCalled()
  })
})
