import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../../../server/utils/db', () => ({
  db: () => ({ from: mocks.from }),
}))

function queryResult(rows: Record<string, unknown>[], count = rows.length) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => ({ data: rows, count, error: null })),
  }
  mocks.from.mockReturnValue(query)
  return query
}

const filter = {
  period_year: 2026,
  status: ['issued' as const, 'overdue' as const],
  today: '2026-10-10',
  page: 2,
  page_size: 50,
}

describe('CrossPeriodInvoiceRepository.listCrossPeriod', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sorts flattened invoice rows before applying the second page range', async () => {
    const query = queryResult([{
      id: 'invoice-51', invoice_code: 'INV-51', billing_period_id: 'period-1',
      contract_id: 'contract-1', contract_code: 'HD-2', room_id: 'room-1',
      room_number: '2', room_floor: 1, tenant_id: 'tenant-1', tenant_name: 'An',
      tenant_phone: '0900000000', period_year: 2026, period_month: 10,
      building_id: 'building-1', building_name: 'Tòa A', building_slug: 'toa-a',
      status: 'issued', total_amount: 1000, paid_amount: 0, balance_amount: 1000,
      grace_period_days: 0,
    }], 101)
    const { CrossPeriodInvoiceRepository } = await import('../../../server/repositories/invoices')

    const result = await CrossPeriodInvoiceRepository.listCrossPeriod({} as never, filter, {
      buildingIds: ['building-1'],
    })

    expect(mocks.from).toHaveBeenCalledWith('invoice_browse_rows')
    expect(query.order.mock.calls.map(call => call[0])).toEqual([
      'period_year', 'period_month', 'building_sort_name', 'building_id',
      'room_floor', 'room_sort_number', 'room_number', 'contract_sort_code',
      'contract_code', 'invoice_sort_code', 'invoice_code', 'contract_id', 'id',
    ])
    expect(query.range).toHaveBeenCalledWith(50, 99)
    expect(result.total).toBe(101)
    expect(result.items[0]).toMatchObject({
      id: 'invoice-51', period_year: 2026, building_name: 'Tòa A',
      room_number: '2', contract_code: 'HD-2', tenant_name: 'An',
    })
  })

  it('keeps building scope, status and tenant search filters on the paginated source', async () => {
    const query = queryResult([])
    const { CrossPeriodInvoiceRepository } = await import('../../../server/repositories/invoices')

    await CrossPeriodInvoiceRepository.listCrossPeriod({} as never, {
      ...filter, tenant_search: 'An', period_month: 10,
    }, { buildingIds: ['building-1', 'building-2'] })

    expect(query.in).toHaveBeenCalledWith('building_id', ['building-1', 'building-2'])
    expect(query.eq).toHaveBeenCalledWith('period_year', 2026)
    expect(query.eq).toHaveBeenCalledWith('period_month', 10)
    expect(query.or).toHaveBeenCalledWith(expect.stringContaining('status.in.(issued)'))
    expect(query.or).toHaveBeenCalledWith('tenant_name.ilike.%An%,tenant_phone.ilike.%An%')
  })
})
