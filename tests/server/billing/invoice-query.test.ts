import { describe, expect, it, beforeEach, vi } from 'vitest'

const listCrossPeriod = vi.fn()
const findByIdentifier = vi.fn()

vi.mock('../../../server/repositories/invoices', () => ({
  CrossPeriodInvoiceRepository: {
    listCrossPeriod,
  },
}))

vi.mock('../../../server/repositories/buildings', () => ({
  BuildingRepository: {
    findByIdentifier,
  },
}))

function user(role: 'admin' | 'manager', extra: Record<string, unknown> = {}) {
  return {
    id: `${role}-1`,
    app_metadata: {
      role,
      ...extra,
    },
  } as never
}

describe('InvoiceQueryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listCrossPeriod.mockResolvedValue({ items: [], total: 0 })
    findByIdentifier.mockResolvedValue({ id: 'building-1', slug: 'toa-a' })
  })

  it('derives overdue from issued invoices with unpaid balance past due date', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T06:00:00.000Z'))
    listCrossPeriod.mockResolvedValue({
      total: 1,
      items: [{
        id: 'invoice-1',
        invoice_code: 'inv-2026-06-0001',
        billing_period_id: 'period-1',
        period_year: 2026,
        period_month: 6,
        building_id: 'building-1',
        building_name: 'Toa A',
        room_id: 'room-1',
        room_number: '101',
        contract_id: 'contract-1',
        contract_code: 'ct-1',
        tenant_id: 'tenant-1',
        tenant_name: 'Tung',
        total_amount: 1_000_000,
        paid_amount: 0,
        balance_amount: 1_000_000,
        due_date: '2026-06-20',
        status: 'issued',
        issued_at: '2026-06-01T00:00:00.000Z',
      }],
    })
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    const result = await InvoiceQueryService.list({} as never, user('admin'), {
      status: [],
      page: 1,
      page_size: 50,
    })

    expect(result.data[0]?.status).toBe('overdue')
    expect(result.meta).toEqual({ page: 1, page_size: 50, total: 1, total_pages: 1 })
    vi.useRealTimers()
  })

  it('forwards multi-status filters, tenant search, and page size to the repository', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    await InvoiceQueryService.list({} as never, user('admin'), {
      status: ['issued', 'overdue'],
      tenant_search: 'Tung',
      page: 2,
      page_size: 25,
    })

    expect(listCrossPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ['issued', 'overdue'],
        tenant_search: 'Tung',
        page: 2,
        page_size: 25,
        today: expect.any(String),
      }),
      {},
    )
  })

  it('rejects page sizes above 100 at the service boundary', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    await expect(InvoiceQueryService.list({} as never, user('admin'), {
      status: [],
      page: 1,
      page_size: 101,
    })).rejects.toMatchObject({ statusCode: 422 })
  })

  it('forbids a manager from filtering a building outside assigned ids when present', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')
    findByIdentifier.mockResolvedValue({ id: 'building-3', slug: 'toa-c' })

    await expect(InvoiceQueryService.list({} as never, user('manager', {
      assigned_building_ids: ['building-1', 'building-2'],
    }), {
      building_id: 'toa-c',
      status: [],
      page: 1,
      page_size: 50,
    })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('passes assigned manager buildings as repository scope when no building filter is selected', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    await InvoiceQueryService.list({} as never, user('manager', {
      assigned_building_ids: ['building-1', 'building-2'],
    }), {
      status: [],
      page: 1,
      page_size: 50,
    })

    expect(listCrossPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ building_id: undefined }),
      { buildingIds: ['building-1', 'building-2'] },
    )
  })

  it('supports legacy manager building_ids metadata for assigned scope', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    await InvoiceQueryService.list({} as never, user('manager', {
      building_ids: ['building-legacy'],
    }), {
      status: [],
      page: 1,
      page_size: 50,
    })

    expect(listCrossPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ building_id: undefined }),
      { buildingIds: ['building-legacy'] },
    )
  })

  it('returns an empty list for managers without assigned buildings', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    const result = await InvoiceQueryService.list({} as never, user('manager'), {
      status: [],
      page: 1,
      page_size: 50,
    })

    expect(result).toEqual({
      data: [],
      meta: { page: 1, page_size: 50, total: 0, total_pages: 1 },
    })
    expect(listCrossPeriod).not.toHaveBeenCalled()
  })

  it('does not apply assigned-building scope to admins', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')

    await InvoiceQueryService.list({} as never, user('admin', {
      assigned_building_ids: ['building-1'],
    }), {
      status: [],
      page: 1,
      page_size: 50,
    })

    expect(listCrossPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ building_id: undefined }),
      { buildingIds: undefined },
    )
  })

  it('processes 500+ invoice list results under one second at the service boundary', async () => {
    const { InvoiceQueryService } = await import('../../../server/services/billing/invoice-query')
    listCrossPeriod.mockResolvedValue({
      total: 600,
      items: Array.from({ length: 600 }, (_, idx) => ({
        id: `invoice-${idx}`,
        invoice_code: `INV-2606-${String(idx).padStart(4, '0')}`,
        billing_period_id: 'period-1',
        period_year: 2026,
        period_month: 6,
        building_id: idx % 2 === 0 ? 'building-1' : 'building-2',
        building_name: idx % 2 === 0 ? 'Toa A' : 'Toa B',
        room_id: `room-${idx}`,
        room_number: String(100 + idx),
        contract_id: `contract-${idx}`,
        contract_code: `HD-${idx}`,
        tenant_id: `tenant-${idx}`,
        tenant_name: `Tenant ${idx}`,
        total_amount: 3_000_000,
        paid_amount: idx % 3 === 0 ? 3_000_000 : 0,
        balance_amount: idx % 3 === 0 ? 0 : 3_000_000,
        due_date: '2026-06-10',
        status: 'issued',
        issued_at: '2026-06-01T00:00:00.000Z',
      })),
    })

    const startedAt = performance.now()
    const result = await InvoiceQueryService.list({} as never, user('admin'), {
      status: [],
      page: 1,
      page_size: 100,
    })
    const durationMs = performance.now() - startedAt

    expect(result.data).toHaveLength(600)
    expect(result.meta).toEqual({ page: 1, page_size: 100, total: 600, total_pages: 6 })
    expect(durationMs).toBeLessThan(1000)
  })
})
