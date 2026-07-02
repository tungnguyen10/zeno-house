import { db as serverSupabaseClient } from '../utils/db'
import type { H3Event } from 'h3'
import type { InvoiceListItem, InvoiceListQuery } from '~/utils/validators/invoices'
import type { InvoiceStatus } from '~/utils/constants/billing'

type InvoiceListRow = Record<string, unknown>

export interface InvoiceListScope {
  buildingIds?: string[]
}

export interface InvoiceListRepositoryFilter extends InvoiceListQuery {
  today: string
}

function relationObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return relationObject(value[0])
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function invoiceStatusFilter(statuses: InvoiceStatus[], today: string): string | null {
  if (statuses.length === 0) return null

  const storedStatuses = statuses.filter(status => status !== 'overdue')
  const parts: string[] = []
  if (storedStatuses.length > 0) {
    parts.push(`status.in.(${storedStatuses.join(',')})`)
  }
  if (statuses.includes('overdue')) {
    parts.push(`and(status.eq.issued,due_date.lt.${today},balance_amount.gt.0)`)
  }
  return parts.join(',')
}

function mapInvoiceListRow(row: InvoiceListRow): InvoiceListItem {
  const period = relationObject(row.billing_periods)
  const building = relationObject(period?.buildings)
  const room = relationObject(row.rooms)
  const contract = relationObject(row.contracts)
  const tenant = relationObject(row.tenants)

  return {
    id: String(row.id),
    invoice_code: String(row.invoice_code ?? ''),
    billing_period_id: String(row.billing_period_id ?? ''),
    period_year: numberValue(period?.period_year),
    period_month: numberValue(period?.period_month),
    building_id: String(period?.building_id ?? ''),
    building_name: text(building?.name),
    building_slug: text(building?.slug),
    room_id: String(row.room_id ?? ''),
    room_number: text(room?.room_number),
    contract_id: String(row.contract_id ?? ''),
    contract_code: text(contract?.contract_code),
    tenant_id: String(row.tenant_id ?? ''),
    tenant_name: text(tenant?.full_name),
    tenant_phone: text(tenant?.phone),
    total_amount: numberValue(row.total_amount),
    paid_amount: numberValue(row.paid_amount),
    balance_amount: numberValue(row.balance_amount),
    due_date: text(row.due_date),
    status: row.status as InvoiceStatus,
    issued_at: text(row.issued_at),
    voided_at: text(row.voided_at),
    void_reason: text(row.void_reason),
    notes: text(row.notes),
  }
}

export const CrossPeriodInvoiceRepository = {
  async listCrossPeriod(
    event: H3Event,
    filter: InvoiceListRepositoryFilter,
    scope: InvoiceListScope = {},
  ): Promise<{ items: InvoiceListItem[]; total: number }> {
    if (scope.buildingIds && scope.buildingIds.length === 0) {
      return { items: [], total: 0 }
    }

    const client = await serverSupabaseClient(event)
    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1

    let query = client
      .from('invoices')
      .select(`
        id,
        invoice_code,
        billing_period_id,
        contract_id,
        room_id,
        tenant_id,
        status,
        total_amount,
        paid_amount,
        balance_amount,
        due_date,
        issued_at,
        voided_at,
        void_reason,
        notes,
        billing_periods!inner(
          id,
          building_id,
          period_year,
          period_month,
          buildings(id, name, slug)
        ),
        rooms(id, room_number),
        contracts(id, contract_code),
        tenants!inner(id, full_name, phone)
      `, { count: 'exact' })

    if (filter.building_id) {
      query = query.eq('billing_periods.building_id', filter.building_id)
    }
    else if (scope.buildingIds && scope.buildingIds.length > 0) {
      query = query.in('billing_periods.building_id', scope.buildingIds)
    }

    if (filter.period_year !== undefined) {
      query = query.eq('billing_periods.period_year', filter.period_year)
    }
    if (filter.period_month !== undefined) {
      query = query.eq('billing_periods.period_month', filter.period_month)
    }

    const statusFilter = invoiceStatusFilter(filter.status, filter.today)
    if (statusFilter) query = query.or(statusFilter)

    if (filter.tenant_search) {
      const term = filter.tenant_search.replace(/[%(),]/g, '').trim()
      if (term) {
        query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`, {
          foreignTable: 'tenants',
        })
      }
    }

    const { data, error, count } = await query
      .order('issued_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw createError({ statusCode: 500, message: error.message })
    return {
      items: ((data ?? []) as InvoiceListRow[]).map(mapInvoiceListRow),
      total: count ?? 0,
    }
  },
}
