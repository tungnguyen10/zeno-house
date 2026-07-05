import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import type { RecurringExpense } from '~/types/operations-report'

const findBuildingById = vi.fn()
const findById = vi.fn()
const listByBuilding = vi.fn()
const listUpcoming = vi.fn()
const insert = vi.fn()
const updateById = vi.fn()
const deleteById = vi.fn()
const assertBuildingScope = vi.fn()
const appendAudit = vi.fn()
const canMock = vi.fn()

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: { findById: findBuildingById },
}))

vi.mock('../../../server/repositories/operations-report/recurring-expenses', () => ({
  RecurringExpenseRepository: {
    findById,
    listByBuilding,
    listUpcoming,
    insert,
    updateById,
    deleteById,
  },
}))

vi.mock('../../../server/utils/scope', () => ({
  assertBuildingScope,
}))

vi.mock('../../../server/services/audit', () => ({
  AuditService: { append: appendAudit },
}))

const manager = { id: 'manager-1', app_metadata: { role: 'manager' } } as AuthUser

function recurring(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: 'recurring-1',
    buildingId: 'building-1',
    name: 'Lương bảo vệ',
    category: 'staff',
    frequency: 'monthly',
    anchorDay: 5,
    estimatedAmount: 3_000_000,
    isActive: true,
    nextReminderAt: '2026-07-05',
    createdBy: 'owner-1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

describe('RecurringExpenseService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', canMock)
    canMock.mockImplementation((user: AuthUser, capability: string) => {
      if (user.app_metadata.role === 'owner') return true
      if (user.app_metadata.role === 'manager') {
        return capability === 'recurring-expenses.read' || capability === 'building-expenses.write'
      }
      return false
    })
    findBuildingById.mockResolvedValue({ id: 'building-1', name: 'Building 1' })
    assertBuildingScope.mockResolvedValue(undefined)
    appendAudit.mockResolvedValue(undefined)
  })

  it('computes next reminders by frequency and anchor day', async () => {
    const { computeNextReminderAt, advanceReminderAt } = await import(
      '../../../server/services/operations-report/recurring-expenses'
    )

    expect(computeNextReminderAt('monthly', 10, new Date('2026-07-05T00:00:00Z'))).toBe('2026-07-10')
    expect(computeNextReminderAt('quarterly', 1, new Date('2026-07-05T00:00:00Z'))).toBe('2026-10-01')
    expect(advanceReminderAt('2026-07-05', 'biannual', 5)).toBe('2027-01-05')
    expect(advanceReminderAt('2026-07-05', 'yearly', 5)).toBe('2027-07-05')
  })

  it('allows manager to record an in-scope reminder when they can write expenses', async () => {
    const existing = recurring()
    findById.mockResolvedValue(existing)
    updateById.mockResolvedValue(recurring({ nextReminderAt: '2026-08-05' }))

    const { RecurringExpenseService } = await import(
      '../../../server/services/operations-report/recurring-expenses'
    )

    const result = await RecurringExpenseService.record({} as never, manager, 'recurring-1', {})

    expect(updateById).toHaveBeenCalledWith(expect.anything(), 'recurring-1', {
      next_reminder_at: '2026-08-05',
    })
    expect(result.prefill).toMatchObject({
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      category: 'staff',
      amount: 3_000_000,
    })
  })

  it('rejects manager template configuration', async () => {
    const { RecurringExpenseService } = await import(
      '../../../server/services/operations-report/recurring-expenses'
    )

    await expect(
      RecurringExpenseService.create({} as never, manager, {
        building_id: 'building-1',
        name: 'Bảo trì thang máy',
        category: 'repair',
        frequency: 'quarterly',
        anchor_day: 10,
        estimated_amount: 1_000_000,
      }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(insert).not.toHaveBeenCalled()
  })
})
