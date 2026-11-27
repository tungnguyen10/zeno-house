import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ db: vi.fn(), housing: vi.fn() }))
vi.mock('../../../server/utils/db', () => ({ db: mocks.db }))
vi.mock('../../../server/utils/scope', () => ({ resolveTenantId: async () => 'tenant-1' }))
vi.mock('../../../server/repositories/tenant-portal/housing', () => ({ TenantHousingRepository: { resolveActive: mocks.housing } }))
vi.mock('../../../server/repositories/building-invoice-profiles', () => ({
  BuildingInvoiceProfileRepository: { findInvoiceSnapshotsByIds: async () => new Map() },
}))
vi.mock('../../../server/services/billing/invoice-profile-display', () => ({
  InvoiceProfileDisplayService: { resolveMany: async () => new Map() },
}))

type Row = Record<string, unknown>
type Result = { data: Row[] | Row | null; count: number | null; error: null }

/** A bounded Data API adapter; both production invoice repositories and the service run unchanged. */
function database(tables: Record<string, Row[]>, cap = 1000) {
  const reads: Array<{ table: string; columns: string }> = []
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])]
    let countRequested = false
    let bounds: [number, number] | null = null
    const ordering: Array<{ key: string; ascending: boolean }> = []
    const result = (single = false): Result => {
      rows.sort((left, right) => {
        for (const { key, ascending } of ordering) {
          const a = left[key]
          const b = right[key]
          const order = typeof a === 'number' && typeof b === 'number'
            ? a - b
            : String(a ?? '').localeCompare(String(b ?? ''))
          if (order) return ascending ? order : -order
        }
        return 0
      })
      const total = rows.length
      const data = (bounds ? rows.slice(bounds[0], bounds[1] + 1) : rows).slice(0, cap)
      return { data: single ? data[0] ?? null : data, count: countRequested ? total : null, error: null }
    }
    const query = {
      select(columns: string, options?: { count?: string }) {
        reads.push({ table, columns })
        countRequested = options?.count === 'exact'
        return query
      },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query },
      is(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query },
      or(filter: string) {
        const statuses = /status\.in\.\(([^)]+)\)/.exec(filter)?.[1]?.split(',') ?? []
        const overdueDate = /overdue_date\.lt\.([\d-]+)/.exec(filter)?.[1]
        rows = rows.filter(row => statuses.includes(String(row.status))
          || (row.status === 'issued' && overdueDate && row.overdue_date
            && String(row.overdue_date) < overdueDate && Number(row.balance_amount) > 0))
        return query
      },
      order(key: string, options: { ascending: boolean }) { ordering.push({ key, ...options }); return query },
      range(start: number, end: number) { bounds = [start, end]; return query },
      maybeSingle: async () => result(true),
      then(resolve: (value: Result) => unknown) { return Promise.resolve(result()).then(resolve) },
    }
    return query
  })
  mocks.db.mockReturnValue({ from })
  return { from, reads }
}

function invoice(index: number, overrides: Row = {}): Row {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    invoice_code: `HD-${String(index).padStart(4, '0')}`,
    billing_period_id: `period-${index}`,
    period_year: 2026,
    period_month: 11,
    building_id: 'building-1', building_name: 'Tòa A', building_slug: 'toa-a',
    room_id: 'room-1', room_number: '101', contract_id: 'contract-1', contract_code: 'HĐ-1',
    tenant_id: 'tenant-1', tenant_name: 'Khách mẫu', tenant_phone: '0900000000',
    status: 'issued', total_amount: 1000, paid_amount: 0, balance_amount: 1000,
    due_date: '2026-11-30', grace_period_days: 2, overdue_date: '2026-12-02',
    issued_at: '2026-11-01T00:00:00Z', voided_at: null, void_reason: null, notes: null,
    ...overrides,
  }
}

function detailRow(row: Row): Row {
  return {
    ...row,
    billing_periods: { id: row.billing_period_id, building_id: row.building_id,
      period_year: row.period_year, period_month: row.period_month,
      buildings: { name: row.building_name, slug: row.building_slug } },
    rooms: { room_number: row.room_number }, contracts: { contract_code: row.contract_code },
    tenants: { full_name: row.tenant_name, phone: row.tenant_phone },
  }
}

const actor = { id: 'auth-1', app_metadata: { role: 'tenant' } } as never
const event = { context: {} } as never
const today = '2026-11-27'

describe('tenant finance repository → service contract', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.housing.mockResolvedValue(null) })

  it('returns the 21st invoice and exact metadata through the real shared repository', async () => {
    const owned = Array.from({ length: 21 }, (_, index) => invoice(index + 1))
    database({ invoice_browse_rows: [...owned, invoice(22, { tenant_id: 'tenant-other' })] })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    const first = await TenantInvoiceService.list(event, actor, { page: 1, page_size: 20 }, today)
    const second = await TenantInvoiceService.list(event, actor, { page: 2, page_size: 20 }, today)
    expect(first.data).toHaveLength(20)
    expect(first.meta).toEqual({ total: 21, page: 1, limit: 20, totalPages: 2 })
    expect(second.data.map(row => row.id)).toEqual([owned[20]!.id])
    expect(second.meta).toEqual({ total: 21, page: 2, limit: 20, totalPages: 2 })
  })

  it('summarizes older debt beyond page one, excludes void/draft/paid rows, and respects grace for partial debt', async () => {
    const recent = Array.from({ length: 20 }, (_, index) => invoice(index + 1))
    const oldest = invoice(21, { period_month: 1, contract_id: 'historical-contract',
      due_date: '2026-01-05', overdue_date: '2026-01-07', status: 'partial', paid_amount: 800, balance_amount: 200 })
    database({ invoice_browse_rows: [
      ...recent, oldest,
      invoice(22, { due_date: '2026-11-25', overdue_date: today, status: 'partial', paid_amount: 500, balance_amount: 500 }),
      invoice(23, { status: 'void', balance_amount: 900_000 }),
      invoice(24, { status: 'draft', balance_amount: 900_000 }),
      invoice(25, { status: 'paid', paid_amount: 1000, balance_amount: 0 }),
      invoice(26, { tenant_id: 'tenant-other', balance_amount: 900_000 }),
    ] })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    const visible = await TenantInvoiceService.list(event, actor, { page: 1, page_size: 20 }, today)
    expect(visible.data.some(row => row.id === oldest.id)).toBe(false)
    const summary = await TenantInvoiceService.getFinancialSummary(event, actor, today)
    expect(summary).toMatchObject({ outstandingAmount: 20_700, outstandingCount: 22,
      overdueAmount: 200, overdueCount: 1, nextInvoice: { id: oldest.id, balanceAmount: 200 } })
  })

  it('keeps active-roommate financial scope on the shared contract including pre-move-in invoices', async () => {
    mocks.housing.mockResolvedValue({ assignmentRole: 'roommate', contractId: 'shared-contract' })
    database({ invoice_browse_rows: [
      invoice(1, { tenant_id: 'primary-tenant', contract_id: 'shared-contract', period_month: 1 }),
      invoice(2, { tenant_id: 'tenant-1', contract_id: 'unrelated-contract', balance_amount: 9_000 }),
      invoice(3, { tenant_id: 'primary-tenant', contract_id: 'another-contract' }),
    ] })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    const page = await TenantInvoiceService.list(event, actor, { page: 1, page_size: 20 }, today)
    const summary = await TenantInvoiceService.getFinancialSummary(event, actor, today)
    expect(page.meta.total).toBe(1)
    expect(page.data[0]?.contractId).toBe('shared-contract')
    expect(summary).toMatchObject({ outstandingAmount: 1000, outstandingCount: 1, nextInvoice: { contractId: 'shared-contract' } })
  })

  it('reads beyond the summary batch and fails if an upstream cap would silently omit debt', async () => {
    const rows = Array.from({ length: 501 }, (_, index) => invoice(index + 1))
    database({ invoice_browse_rows: rows })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    expect(await TenantInvoiceService.getFinancialSummary(event, actor, today)).toMatchObject({ outstandingAmount: 501_000, outstandingCount: 501 })
    database({ invoice_browse_rows: rows }, 100)
    await expect(TenantInvoiceService.getFinancialSummary(event, actor, today)).rejects.toMatchObject({ statusCode: 500 })
    database({ invoice_browse_rows: rows.slice(0, 300) }, 100)
    await expect(TenantInvoiceService.getFinancialSummary(event, actor, today)).rejects.toMatchObject({ statusCode: 500 })
  })

  it('orders outstanding deadlines and keeps missing legacy dates null', async () => {
    database({ invoice_browse_rows: [invoice(1), invoice(2, { due_date: null, overdue_date: null, period_year: 2020 }),
      invoice(3, { due_date: '2026-11-28', overdue_date: '2026-11-30' })] })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    const summary = await TenantInvoiceService.getFinancialSummary(event, actor, today)
    expect(summary.nextInvoice?.invoiceCode).toBe('HD-0003')
    expect(summary.overdueCount).toBe(0)
    const page = await TenantInvoiceService.list(event, actor, { page: 1, page_size: 20 }, today)
    expect(page.data.find(row => row.invoiceCode === 'HD-0002')).toMatchObject({ dueDate: null, overdueDate: null, status: 'issued' })
  })

  it('authorizes detail before reading payments or charge snapshots', async () => {
    const other = invoice(1, { tenant_id: 'tenant-other' })
    const db = database({ invoices: [detailRow(other)] })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    await expect(TenantInvoiceService.getDetail(event, actor, String(other.id), today)).rejects.toMatchObject({ statusCode: 404 })
    expect(db.from.mock.calls.map(([table]) => table)).toEqual(['invoices'])
  })

  it('revokes shared invoice detail as soon as the caller is no longer a current roommate', async () => {
    const shared = invoice(1, { tenant_id: 'primary-tenant', contract_id: 'shared-contract' })
    database({ invoices: [detailRow(shared)] })
    mocks.housing.mockResolvedValue({ assignmentRole: 'roommate', contractId: 'shared-contract' })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    expect(await TenantInvoiceService.getDetail(event, actor, String(shared.id), today)).toMatchObject({ id: shared.id, payments: [] })
    mocks.housing.mockResolvedValue(null)
    await expect(TenantInvoiceService.getDetail(event, actor, String(shared.id), today)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns safe active ledger rows and immutable meter snapshots without private metadata', async () => {
    const owned = invoice(1)
    const payment = { id: 'payment-1', invoice_id: owned.id, amount: 300, paid_at: '2026-11-25',
      payment_method: 'checkout_allocation', funding_source: 'deposit', deleted_at: null,
      note: 'Private staff note', recorded_by: 'operator-auth-id' }
    const db = database({
      invoices: [detailRow(owned)],
      invoice_payments: [payment, { ...payment, id: 'undone', deleted_at: '2026-11-26T00:00:00Z' },
        { ...payment, id: 'other-payment', invoice_id: 'other' }],
      invoice_charges: [{ id: 'charge-1', invoice_id: owned.id, charge_type: 'electricity', label: 'Điện',
        quantity: 35, unit_price: 4000, amount: 140000, sort_order: 1,
        metadata: { previous_reading_value: 100, current_reading_value: 5, billable_usage: 35,
          source: 'usage_override', old_meter_final_value: 130, new_meter_start_value: 0, operator_note: 'Private' } },
      { id: 'legacy', invoice_id: owned.id, charge_type: 'water', label: 'Nước', quantity: 2, unit_price: 10000,
        amount: 20000, sort_order: 2, metadata: {} },
      { id: 'normal', invoice_id: owned.id, charge_type: 'water', label: 'Nước', quantity: 2, unit_price: 10000,
        amount: 20000, sort_order: 3, metadata: { previous_reading_value: '0', current_reading_value: '2', billable_usage: '2' } }],
    })
    const { TenantInvoiceService } = await import('../../../server/services/tenant-portal/invoices')
    const detail = await TenantInvoiceService.getDetail(event, actor, String(owned.id), today)
    expect(detail.payments).toEqual([{ id: 'payment-1', amount: 300, paidAt: '2026-11-25', method: 'checkout_allocation', fundingSource: 'deposit' }])
    expect(detail.charges[0]?.meterReading).toEqual({ previousValue: 100, currentValue: 5, billableUsage: 35, unit: 'kWh', adjusted: true })
    expect(detail.charges[1]?.meterReading).toBeNull()
    expect(detail.charges[2]?.meterReading).toEqual({ previousValue: 0, currentValue: 2, billableUsage: 2, unit: 'm³', adjusted: false })
    expect(JSON.stringify(detail)).not.toMatch(/Private|operator-auth-id|operator_note|old_meter_final_value/)
    expect(db.reads.find(read => read.table === 'invoice_payments')?.columns).toBe('id, amount, paid_at, payment_method, funding_source')
  })
})
