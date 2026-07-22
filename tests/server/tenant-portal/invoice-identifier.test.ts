import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMock = vi.hoisted(() => vi.fn())
vi.mock('../../../server/utils/db', () => ({ db: dbMock }))

function queryMock() {
  const eq = vi.fn()
  const query = {
    select: vi.fn(),
    eq,
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  }
  query.select.mockReturnValue(query)
  eq.mockReturnValue(query)
  return { client: { from: vi.fn(() => query) }, eq }
}

describe('CrossPeriodInvoiceRepository.findCrossPeriodById', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['9df4cc60-ae30-4c9b-aee9-5df09f541565', 'id'],
    ['INV-2026-0001', 'invoice_code'],
  ])('uses the correct public identifier column for %s', async (identifier, column) => {
    const mock = queryMock()
    dbMock.mockReturnValue(mock.client)
    const { CrossPeriodInvoiceRepository } = await import('../../../server/repositories/invoices')

    await CrossPeriodInvoiceRepository.findCrossPeriodById({} as never, identifier, { tenantId: 'tenant-1' })

    expect(mock.eq).toHaveBeenNthCalledWith(1, column, identifier)
    expect(mock.eq).toHaveBeenNthCalledWith(2, 'tenant_id', 'tenant-1')
  })

  it('applies a contract scope for roommate invoice detail', async () => {
    const mock = queryMock()
    dbMock.mockReturnValue(mock.client)
    const { CrossPeriodInvoiceRepository } = await import('../../../server/repositories/invoices')

    await CrossPeriodInvoiceRepository.findCrossPeriodById(
      {} as never,
      'INV-2026-0001',
      { contractId: 'contract-shared' },
    )

    expect(mock.eq).toHaveBeenNthCalledWith(1, 'invoice_code', 'INV-2026-0001')
    expect(mock.eq).toHaveBeenNthCalledWith(2, 'contract_id', 'contract-shared')
  })
})
