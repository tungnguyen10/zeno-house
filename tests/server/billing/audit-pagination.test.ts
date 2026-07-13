import { beforeEach, describe, expect, it, vi } from 'vitest'

const findById = vi.hoisted(() => vi.fn())
const listByPeriodFiltered = vi.hoisted(() => vi.fn())
const assertBuildingScope = vi.hoisted(() => vi.fn())
const resolver = vi.hoisted(() => ({
  loadPeriods: vi.fn(),
  loadActors: vi.fn(),
  loadInvoices: vi.fn(),
  loadTenants: vi.fn(),
  loadRooms: vi.fn(),
  entityLabel: vi.fn(),
  entityHref: vi.fn(),
  stats: vi.fn(),
}))

vi.mock('../../../server/repositories/billing/periods', () => ({
  BillingPeriodRepository: { findById },
}))
vi.mock('../../../server/repositories/billing/audit', () => ({
  BillingAuditRepository: { listByPeriodFiltered },
  encodeBillingAuditCursor: (event: { createdAt: string; id: string }) => `${event.createdAt}|${event.id}`,
}))
vi.mock('../../../server/services/billing/display', () => ({
  BillingDisplayResolver: vi.fn(function BillingDisplayResolver() {
    return resolver
  }),
}))
vi.mock('../../../server/utils/scope', () => ({ assertBuildingScope }))

const createdAt = '2026-07-13T04:30:00.000Z'
const period = {
  id: 'period-1',
  buildingId: 'building-1',
  periodYear: 2026,
  periodMonth: 7,
  status: 'draft',
}

function event(id: string) {
  return {
    id,
    billingPeriodId: 'period-1',
    actorId: null,
    action: 'payment.recorded',
    entityType: 'invoice',
    entityId: null,
    correlationId: null,
    beforeData: null,
    afterData: null,
    metadata: {},
    createdAt,
  }
}

describe('BillingAuditService cursor pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('can', vi.fn(() => true))
    findById.mockResolvedValue(period)
    assertBuildingScope.mockResolvedValue(undefined)
    resolver.loadPeriods.mockResolvedValue(new Map([['period-1', period]]))
    resolver.loadActors.mockResolvedValue(new Map())
    resolver.loadInvoices.mockResolvedValue(new Map())
    resolver.loadTenants.mockResolvedValue(new Map())
    resolver.loadRooms.mockResolvedValue(new Map())
    resolver.entityLabel.mockResolvedValue({ label: 'Invoice', subLabel: null })
    resolver.entityHref.mockResolvedValue(null)
  })

  it('continues across equal timestamps without duplicates or omissions', async () => {
    const first = event('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    const second = event('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    const third = event('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    listByPeriodFiltered.mockImplementation(async (_event, _periodId, query) => query.cursor
      ? [third]
      : [first, second, third])
    const { BillingAuditService } = await import('../../../server/services/billing/audit')

    const pageOne = await BillingAuditService.listByPeriodFiltered({} as never, {} as never, 'period-1', { limit: 2 })
    const pageTwo = await BillingAuditService.listByPeriodFiltered({} as never, {} as never, 'period-1', {
      limit: 2,
      cursor: pageOne.nextCursor!,
    })

    expect(pageOne.nextCursor).toBe(`${createdAt}|${second.id}`)
    expect(listByPeriodFiltered).toHaveBeenLastCalledWith(expect.anything(), 'period-1', expect.objectContaining({
      cursor: `${createdAt}|${second.id}`,
    }))
    expect([...pageOne.items, ...pageTwo.items].map(item => item.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ])
  })
})
