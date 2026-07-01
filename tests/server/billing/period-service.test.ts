import { vi } from 'vitest'
import type { AuthUser } from '~/types/auth'
import { buildPeriod } from '../../__fixtures__/billing/period'

const list = vi.fn()
const findById = vi.fn()
const findByBuildingPeriod = vi.fn()
const insert = vi.fn()
const updateStatus = vi.fn()
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
  InvoiceRepository: {},
}))

vi.mock('../../../server/services/billing/audit', () => ({
  BillingAuditService: {
    append,
  },
}))

vi.mock('../../../server/repositories/assignments', () => ({
  AssignmentRepository: assignmentRepoMocks,
}))

function makeUser(role: 'admin' | 'manager' = 'admin'): AuthUser {
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
})
