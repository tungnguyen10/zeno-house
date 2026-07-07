import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { BuildingExpense } from '~/types/operations-report'
import { buildingExpenseUpdateSchema } from '~/utils/validators/operations-report'

const findBuildingById = vi.fn()
const findExpenseById = vi.fn()
const insertExpense = vi.fn()
const updateExpenseById = vi.fn()
const voidExpenseById = vi.fn()
const updateReceiptPath = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()
const storageUpload = vi.fn()
const storageRemove = vi.fn()
const storageCreateSignedUrl = vi.fn()
const syncExpenseDeduction = vi.fn()
const voidExpenseDeduction = vi.fn()
const assertReportOpen = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: {
    findById: findExpenseById,
    insert: insertExpense,
    updateById: updateExpenseById,
    voidById: voidExpenseById,
    updateReceiptPath,
  },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: appendAudit },
}))

vi.mock('../../../server/services/operations-report/reserve-funds', () => ({
  ReserveFundService: {
    createReserveFundedExpense: vi.fn(),
    syncExpenseDeduction,
    voidExpenseDeduction,
  },
}))

vi.mock('../../../server/services/operations-report/locks', () => ({
  OperationsReportLockService: {
    assertReportOpen,
  },
}))

vi.mock('../../../server/utils/db', () => ({
  db: () => ({
    storage: {
      from: () => ({
        upload: storageUpload,
        remove: storageRemove,
        createSignedUrl: storageCreateSignedUrl,
      }),
    },
  }),
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
    fundedBy: 'direct',
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
    storageUpload.mockResolvedValue({ error: null })
    storageRemove.mockResolvedValue({ error: null })
    storageCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.test/receipt' }, error: null })
    syncExpenseDeduction.mockResolvedValue(null)
    voidExpenseDeduction.mockResolvedValue(null)
    assertReportOpen.mockResolvedValue(undefined)
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
    expect(assertReportOpen).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 6)
    expect(voidExpenseDeduction).toHaveBeenCalledWith(expect.anything(), admin, voided)
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

  it('accepts funding-source changes through the expense update schema', () => {
    const result = buildingExpenseUpdateSchema.safeParse({ funded_by: 'reserve_fund' })

    expect(result.success).toBe(true)
    expect(result.data).toHaveProperty('funded_by', 'reserve_fund')
  })

  it('uploads a valid receipt after write scope enforcement', async () => {
    const existing = expense()
    const updated = expense({ receiptUrl: 'building-1/expense-1/receipt.jpg' })
    findExpenseById.mockResolvedValue(existing)
    updateReceiptPath.mockResolvedValue(updated)

    const { BuildingExpenseService } = await import(
      '../../../server/services/operations-report/expenses'
    )

    const result = await BuildingExpenseService.uploadReceipt({} as never, admin, 'expense-1', {
      filename: 'receipt.jpg',
      type: 'image/jpeg',
      data: Buffer.from('image-data'),
    })

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), admin, 'building-1', 'write')
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^building-1\/expense-1\/.+\.jpg$/),
      expect.any(Buffer),
      { contentType: 'image/jpeg', upsert: false },
    )
    expect(updateReceiptPath).toHaveBeenCalledWith(
      expect.anything(),
      'expense-1',
      expect.stringMatching(/^building-1\/expense-1\/.+\.jpg$/),
    )
    expect(result.receiptSignedUrl).toBe('https://signed.test/receipt')
  })

  it('rejects invalid receipt content types before storage upload', async () => {
    findExpenseById.mockResolvedValue(expense())

    const { BuildingExpenseService } = await import(
      '../../../server/services/operations-report/expenses'
    )

    await expect(
      BuildingExpenseService.uploadReceipt({} as never, admin, 'expense-1', {
        filename: 'receipt.pdf',
        type: 'application/pdf',
        data: Buffer.from('pdf'),
      }),
    ).rejects.toMatchObject({ statusCode: 422 })
    expect(storageUpload).not.toHaveBeenCalled()
    expect(updateReceiptPath).not.toHaveBeenCalled()
  })

  it('removes a stored receipt after write scope enforcement', async () => {
    const existing = expense({ receiptUrl: 'building-1/expense-1/old.jpg' })
    const updated = expense({ receiptUrl: null })
    findExpenseById.mockResolvedValue(existing)
    updateReceiptPath.mockResolvedValue(updated)

    const { BuildingExpenseService } = await import(
      '../../../server/services/operations-report/expenses'
    )

    const result = await BuildingExpenseService.removeReceipt({} as never, admin, 'expense-1')

    expect(assertBuildingScope).toHaveBeenCalledWith(expect.anything(), admin, 'building-1', 'write')
    expect(updateReceiptPath).toHaveBeenCalledWith(expect.anything(), 'expense-1', null)
    expect(storageRemove).toHaveBeenCalledWith(['building-1/expense-1/old.jpg'])
    expect(result.receiptUrl).toBeNull()
    expect(result.receiptSignedUrl).toBeNull()
  })
})
