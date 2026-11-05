import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { can as realCan } from '../../../server/utils/permissions'
import { buildPeriod } from '../../__fixtures__/billing/period'

const list = vi.fn()
const findById = vi.fn()
const findByBuildingPeriod = vi.fn()
const openOrGetWithAudit = vi.fn()
const updateStatus = vi.fn()
const reopenAtomic = vi.fn()
const listOutstandingByPeriod = vi.fn()
const listInvoicesByPeriod = vi.fn()
const listInvoicesByPeriods = vi.fn()
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
    openOrGetWithAudit,
    updateStatus,
    reopenAtomic,
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
    listByPeriods: listInvoicesByPeriods,
  },
}))

vi.mock('../../../server/services/operations-report/accrual', () => ({
  computeAccrualInputs: vi.fn(),
}))

vi.mock('../../../server/services/operations-report/cache', () => ({
  invalidateOperationsReport: vi.fn(),
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

  it('drops a hidden building from the period list scope', async () => {
    list.mockResolvedValue([])
    const { BuildingVisibilityRepository } = await import('../../../server/repositories/buildings/visibility')
    vi.mocked(BuildingVisibilityRepository.findHiddenIds).mockResolvedValueOnce(['building-1'])
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await BillingPeriodService.list(event(), makeUser('manager'), {})
    expect(list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      buildingIds: [],
    }))
  })

  it('opens a period by building slug through id-or-slug lookup', async () => {
    const created = buildPeriod({ buildingId: 'building-1', periodYear: 2026, periodMonth: 6 })
    findBuildingByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
    openOrGetWithAudit.mockResolvedValue({ period: created, created: true })
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    const result = await BillingPeriodService.openOrGet(
      event(),
      makeUser('admin'),
      { building_id: 'toa-a', period_year: 2026, period_month: 6 },
    )

    expect(findBuildingByIdentifier).toHaveBeenCalledWith(expect.anything(), 'toa-a')
    expect(openOrGetWithAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      building_id: 'building-1',
      period_year: 2026,
      period_month: 6,
      actor_id: 'admin-user',
      source: 'api',
    }))
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
    expect(openOrGetWithAudit).not.toHaveBeenCalled()
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

describe('BillingPeriodService.reopen role and scope guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', realCan)
    assignmentRepoMocks.findBuildingIdsByUser.mockResolvedValue(['building-1'])
  })

  it('returns 403 when a manager reopens a period outside assigned scope', async () => {
    findById.mockResolvedValue(buildPeriod({ id: 'period-2', buildingId: 'building-2', status: 'closed' }))
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(
      event(), makeUser('manager'), 'period-2', 'cần mở lại để chỉnh sửa',
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(reopenAtomic).not.toHaveBeenCalled()
  })

  it('returns 403 when an owner tries to reopen a closed period', async () => {
    const { BillingPeriodService } = await import('../../../server/services/billing/periods')

    await expect(BillingPeriodService.reopen(
      event(), makeUser('owner'), 'period-1', 'cần mở lại để chỉnh sửa',
    )).rejects.toMatchObject({ statusCode: 403 })
    expect(findById).not.toHaveBeenCalled()
    expect(reopenAtomic).not.toHaveBeenCalled()
  })
})
