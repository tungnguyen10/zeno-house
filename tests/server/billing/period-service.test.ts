import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'
import { buildPeriod } from '../../__fixtures__/billing/period'

const list = vi.fn()
const findById = vi.fn()
const findByBuildingPeriod = vi.fn()
const insert = vi.fn()
const updateStatus = vi.fn()
const listOutstandingByPeriod = vi.fn()
const listInvoicesByPeriod = vi.fn()
const listFixedCostsByBuilding = vi.fn()
const listExpenses = vi.fn()
const listActiveAllocations = vi.fn()
const recordMonthlyAccrual = vi.fn()
const append = vi.fn()
const findBuildingByIdentifier = vi.fn()
const assignmentRepoMocks = vi.hoisted(() => ({
  findBuildingIdsByUser: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: {
    list,
    findById,
    findByBuildingPeriod,
    insert,
    updateStatus,
  },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier: findBuildingByIdentifier,
  },
}))

vi.mock('../../../server/repositories/billing/invoices', () => ({
  InvoiceRepository: {
    listOutstandingByPeriod,
    listByPeriod: listInvoicesByPeriod,
  },
}))

vi.mock('../../../server/repositories/operations-report/fixed-costs', () => ({
  BuildingFixedCostRepository: {
    listByBuilding: listFixedCostsByBuilding,
  },
}))

vi.mock('../../../server/repositories/operations-report/expenses', () => ({
  BuildingExpenseRepository: {
    list: listExpenses,
  },
}))

vi.mock('../../../server/services/operations-report/prepaid-expenses', () => ({
  PrepaidExpenseService: {
    listActiveAllocations,
  },
}))

vi.mock('../../../server/services/operations-report/reserve-funds', () => ({
  ReserveFundService: {
    recordMonthlyAccrual,
  },
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    append,
  },
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

function makeUser(role: 'admin' | 'owner' | 'manager' = 'admin'): AuthUser {
  return {
    id: `${role}-user`,
    app_metadata: { role },
  } as AuthUser
}

function event() {
  return { context: {} } as never
}

describe('BillingPeriodService.advanceStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
  })

  it('passes manager assigned building ids into period list filters', async () => {
    list.mockResolvedValue([])
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await BillingPeriodService.list(event(), makeUser('manager'), {})
    expect(list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingIds: ['building-1'],
    }))
  })

  it('opens a period by building slug through id-or-slug lookup', async () => {
    const created = buildPeriod({ buildingId: 'building-1', periodYear: 2026, periodMonth: 6 })
    findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    findByBuildingPeriod.mockResolvedValue(null)
    insert.mockResolvedValue(created)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.openOrGet(
      event(),
      makeUser('admin'),
      { building_id: 'toa-a', period_year: 2026, period_month: 6 },
    )

    expect(findBuildingByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(findByBuildingPeriod).toHaveBeenCalledWith(expect.anything(), 'building-1', 2026, 6)
    expect(insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ building_id: 'building-1' }))
    expect(result.id).toBe(created.id)
  })

  it('returns 403 when manager opens a period outside assigned scope', async () => {
    findBuildingByIdentifier.mockResolvedValue({ id: 'building-2', slug: 'toa-b' })
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.openOrGet(
      event(),
      makeUser('manager'),
      { building_id: 'toa-b', period_year: 2026, period_month: 6 },
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(insert).not.toHaveBeenCalled()
  })

  it('returns 404 when manager reads a period outside assigned scope', async () => {
    findById.mockResolvedValue(buildPeriod({ buildingId: 'building-2' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.getById(event(), makeUser('manager'), 'period-2'))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 403 when manager advances a period outside assigned scope', async () => {
    findById.mockResolvedValue(buildPeriod({ id: 'period-2', buildingId: 'building-2', status: 'draft' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.advanceStatus(event(), makeUser('manager'), 'period-2', 'issued'))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('updates status and appends an audit event', async () => {
    const period = buildPeriod({ status: 'draft' })
    const issued = buildPeriod({ status: 'issued', issuedAt: '2026-05-31T00:00:00.000Z' })
    findById.mockResolvedValue(period)
    updateStatus.mockResolvedValue(issued)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.advanceStatus(event(), makeUser('admin'), period.id, 'issued')

    expect(result.status).toBe('issued')
    expect(updateStatus).toHaveBeenCalledWith(expect.anything(), period.id, 'issued', expect.objectContaining({ issued_at: expect.any(String) }))
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'period.status_changed',
      before_data: { status: 'draft' },
      after_data: { status: 'issued' },
    }))
  })

  it('blocks status changes from closed periods', async () => {
    findById.mockResolvedValue(buildPeriod({ status: 'closed' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.advanceStatus(event(), makeUser('admin'), 'period-1', 'issued'))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(updateStatus).not.toHaveBeenCalled()
  })
})

describe('BillingPeriodService.reopen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
  })

  it('reopens a closed period back to collecting and audits the reason', async () => {
    const closed = buildPeriod({ id: 'period-1', buildingId: 'building-1', status: 'closed' })
    const reopened = buildPeriod({ id: 'period-1', buildingId: 'building-1', status: 'collecting' })
    findById.mockResolvedValue(closed)
    updateStatus.mockResolvedValue(reopened)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.reopen(
      event(), makeUser('admin'), 'period-1', 'sửa lại chỉ số điện phòng 201',
    )

    expect(result.status).toBe('collecting')
    expect(updateStatus).toHaveBeenCalledWith(
      expect.anything(), 'period-1', 'collecting', { closed_at: null },
    )
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'period.reopened',
      metadata: expect.objectContaining({
        reason: 'sửa lại chỉ số điện phòng 201',
        prior_status: 'closed',
        trigger: 'manual',
      }),
    }))
  })

  it('rejects a reason shorter than 10 characters', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(event(), makeUser('admin'), 'period-1', 'ngắn'))
      .rejects.toMatchObject({ statusCode: 422 })
    expect(findById).not.toHaveBeenCalled()
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('returns 409 when the period is not closed', async () => {
    findById.mockResolvedValue(buildPeriod({ id: 'period-1', buildingId: 'building-1', status: 'collecting' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(
      event(), makeUser('admin'), 'period-1', 'cần mở lại để chỉnh sửa',
    )).rejects.toMatchObject({ statusCode: 409 })
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('returns 403 when a manager reopens a period outside assigned scope', async () => {
    findById.mockResolvedValue(buildPeriod({ id: 'period-2', buildingId: 'building-2', status: 'closed' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(
      event(), makeUser('manager'), 'period-2', 'cần mở lại để chỉnh sửa',
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('returns 403 when an owner tries to reopen a closed period', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(
      event(), makeUser('owner'), 'period-1', 'cần mở lại để chỉnh sửa',
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(findById).not.toHaveBeenCalled()
    expect(updateStatus).not.toHaveBeenCalled()
  })
})

describe('BillingPeriodService.close', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
    listOutstandingByPeriod.mockResolvedValue([])
    listInvoicesByPeriod.mockResolvedValue([
      { id: 'invoice-1', status: 'paid', totalAmount: 1_000_000 },
      { id: 'invoice-2', status: 'void', totalAmount: 900_000 },
      { id: 'invoice-3', status: 'paid', totalAmount: 2_000_000 },
    ])
    listFixedCostsByBuilding.mockResolvedValue([
      {
        effectiveFromPeriodYear: 2026,
        effectiveFromPeriodMonth: 1,
        effectiveToPeriodYear: null,
        effectiveToPeriodMonth: null,
        amount: 400_000,
      },
    ])
    listExpenses.mockResolvedValue([{ amount: 500_000 }])
    listActiveAllocations.mockResolvedValue([{ monthlyAmount: 100_000 }])
    recordMonthlyAccrual.mockResolvedValue({ id: 'accrual-1' })
  })

  it('closes a collecting period and records reserve accrual from issued profit', async () => {
    const period = buildPeriod({
      id: 'period-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      status: 'collecting',
    })
    const closed = buildPeriod({ ...period, status: 'closed' })
    findById.mockResolvedValue(period)
    updateStatus.mockResolvedValue(closed)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.close(event(), makeUser('admin'), 'period-1')

    expect(result.status).toBe('closed')
    expect(recordMonthlyAccrual).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      billingPeriodId: 'period-1',
      issuedRevenue: 3_000_000,
      issuedProfitByRevenue: 2_000_000,
    })
    expect(append).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
      action: 'period.closed',
    }))
  })

  it('does not create another accrual when close is called on an already closed period', async () => {
    const period = buildPeriod({ id: 'period-1', buildingId: 'building-1', status: 'closed' })
    findById.mockResolvedValue(period)
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.close(event(), makeUser('admin'), 'period-1')

    expect(result).toBe(period)
    expect(updateStatus).not.toHaveBeenCalled()
    expect(recordMonthlyAccrual).not.toHaveBeenCalled()
  })

  it('re-records monthly accrual when a period is reopened and closed again', async () => {
    const collecting = buildPeriod({
      id: 'period-1',
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      status: 'collecting',
    })
    const closed = buildPeriod({ ...collecting, status: 'closed' })

    findById
      .mockResolvedValueOnce(collecting)
      .mockResolvedValueOnce(closed)
      .mockResolvedValueOnce(collecting)
    updateStatus
      .mockResolvedValueOnce(closed)
      .mockResolvedValueOnce(collecting)
      .mockResolvedValueOnce(closed)
    listInvoicesByPeriod
      .mockResolvedValueOnce([
        { id: 'invoice-1', status: 'paid', totalAmount: 1_000_000 },
      ])
      .mockResolvedValueOnce([
        { id: 'invoice-1', status: 'paid', totalAmount: 1_500_000 },
      ])
    listExpenses
      .mockResolvedValueOnce([{ amount: 100_000 }])
      .mockResolvedValueOnce([{ amount: 300_000 }])

    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await BillingPeriodService.close(event(), makeUser('admin'), 'period-1')
    await BillingPeriodService.reopen(event(), makeUser('admin'), 'period-1', 'reopen to refresh accrual')
    await BillingPeriodService.close(event(), makeUser('admin'), 'period-1')

    expect(recordMonthlyAccrual).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), {
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      billingPeriodId: 'period-1',
      issuedRevenue: 1_000_000,
      issuedProfitByRevenue: 400_000,
    })
    expect(recordMonthlyAccrual).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), {
      buildingId: 'building-1',
      periodYear: 2026,
      periodMonth: 7,
      billingPeriodId: 'period-1',
      issuedRevenue: 1_500_000,
      issuedProfitByRevenue: 700_000,
    })
  })
})
