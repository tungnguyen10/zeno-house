import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'

export interface ReportInvoiceCharge {
  chargeType: string
  amount: number
}

export interface ReportInvoice {
  id: string
  totalAmount: number
  balanceAmount: number
  charges: ReportInvoiceCharge[]
  collected: number
}

export interface ReportBillingData {
  periodId: string | null
  periodStatus: string | null
  invoices: ReportInvoice[]
}

type InvoiceRow = {
  id: string
  total_amount: number | string
  balance_amount: number | string
  invoice_charges: { charge_type: string; amount: number | string }[] | null
  invoice_payments: { amount: number | string; deleted_at: string | null }[] | null
}

export const OperationsReportRepository = {
  /** Resolve the billing period id for a building/year/month, if it exists. */
  async findPeriod(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<{ id: string; status: string } | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('billing_periods')
      .select('id, status')
      .eq('building_id', buildingId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .maybeSingle()
    if (error) throwDbError(error, 'operationsReport.report.findPeriod')
    return data ? { id: data.id, status: data.status } : null
  },

  /**
   * Fetch non-void issued-invoice snapshots with their charges and active
   * payments for the given building/period. Revenue is read-only from billing.
   */
  async fetchBillingData(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<ReportBillingData> {
    const period = await this.findPeriod(event, buildingId, periodYear, periodMonth)
    if (!period) return { periodId: null, periodStatus: null, invoices: [] }
    const periodId = period.id

    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('invoices')
      .select(
        'id, total_amount, balance_amount, invoice_charges(charge_type, amount), invoice_payments(amount, deleted_at)',
      )
      .eq('billing_period_id', periodId)
      .neq('status', 'void')
    if (error) throwDbError(error, 'operationsReport.report.fetchBillingData')

    const invoices: ReportInvoice[] = ((data ?? []) as InvoiceRow[]).map((row) => {
      const charges = (row.invoice_charges ?? []).map(c => ({
        chargeType: c.charge_type,
        amount: Number(c.amount),
      }))
      const collected = (row.invoice_payments ?? [])
        .filter(p => p.deleted_at === null)
        .reduce((sum, p) => sum + Number(p.amount), 0)
      return {
        id: row.id,
        totalAmount: Number(row.total_amount),
        balanceAmount: Number(row.balance_amount),
        charges,
        collected,
      }
    })

    return { periodId, periodStatus: period.status, invoices }
  },
}
