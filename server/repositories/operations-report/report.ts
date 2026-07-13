import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { Tables } from '~/types/database.types'
import type {
  BuildingExpense,
  BuildingFixedCost,
  BuildingReserveFundRate,
  OperationsReportClosure,
  PrepaidExpenseAllocation,
  ReserveFundTransaction,
} from '~/types/operations-report'
import {
  mapBuildingExpense,
  mapBuildingFixedCost,
  mapBuildingReserveFundRate,
  mapOperationsReportClosure,
  mapReserveFundTransaction,
  openOperationsReportClosure,
  type BuildingReserveFundRateRow,
  type OperationsReportPeriodRow,
  type ReserveFundTransactionRow,
} from '~/utils/mappers/operations-report'

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

interface SnapshotRow {
  billing_period: { id: string, status: string } | null
  invoices: Array<{
    id: string
    total_amount: number | string
    balance_amount: number | string
    charges: Array<{ charge_type: string, amount: number | string }>
    collected: number | string
  }>
  fixed_costs: Tables<'building_fixed_costs'>[]
  expenses: Tables<'building_expenses'>[]
  prepaid_items: Array<{ id: string, name: string, category: string, monthly_amount: number | string }>
  closure: OperationsReportPeriodRow | null
  reserve_transactions: ReserveFundTransactionRow[]
  reserve_rate: BuildingReserveFundRateRow | null
}

export interface OperationsReportSnapshot {
  billing: ReportBillingData
  fixedCosts: BuildingFixedCost[]
  expenses: BuildingExpense[]
  prepaidItems: PrepaidExpenseAllocation[]
  closure: OperationsReportClosure
  reserveTransactions: ReserveFundTransaction[]
  reserveRate: BuildingReserveFundRate | null
}

type InvoiceRow = {
  id: string
  total_amount: number | string
  balance_amount: number | string
  invoice_charges: { charge_type: string; amount: number | string }[] | null
  invoice_payments: { amount: number | string; deleted_at: string | null }[] | null
}

export const OperationsReportRepository = {
  async fetchSnapshot(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<OperationsReportSnapshot> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client.rpc('operations_report_snapshot' as never, {
      p_building_id: buildingId,
      p_period_year: periodYear,
      p_period_month: periodMonth,
    } as never)
    if (error) throwDbError(error, 'operationsReport.report.fetchSnapshot')
    const row = data as unknown as SnapshotRow
    return {
      billing: {
        periodId: row.billing_period?.id ?? null,
        periodStatus: row.billing_period?.status ?? null,
        invoices: (row.invoices ?? []).map(invoice => ({
          id: invoice.id,
          totalAmount: Number(invoice.total_amount),
          balanceAmount: Number(invoice.balance_amount),
          collected: Number(invoice.collected),
          charges: (invoice.charges ?? []).map(charge => ({
            chargeType: charge.charge_type,
            amount: Number(charge.amount),
          })),
        })),
      },
      fixedCosts: (row.fixed_costs ?? []).map(mapBuildingFixedCost),
      expenses: (row.expenses ?? []).map(mapBuildingExpense),
      prepaidItems: (row.prepaid_items ?? []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category as PrepaidExpenseAllocation['category'],
        monthlyAmount: Number(item.monthly_amount),
      })),
      closure: row.closure
        ? mapOperationsReportClosure(row.closure)
        : openOperationsReportClosure({ buildingId, periodYear, periodMonth }),
      reserveTransactions: (row.reserve_transactions ?? []).map(mapReserveFundTransaction),
      reserveRate: row.reserve_rate ? mapBuildingReserveFundRate(row.reserve_rate) : null,
    }
  },
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
