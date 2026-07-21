import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type {
  OperationsReportCloseSource,
  OperationsReportClosure,
} from '~/types/operations-report'
import {
  mapOperationsReportClosure,
  openOperationsReportClosure,
  type OperationsReportPeriodRow,
} from '~/utils/mappers/operations-report'

type DbError = { message: string }
type QueryResult = { data: unknown, error: DbError | null }
type UntypedQuery = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => UntypedQuery
  insert: (...args: unknown[]) => UntypedQuery
  update: (...args: unknown[]) => UntypedQuery
  upsert: (...args: unknown[]) => UntypedQuery
  eq: (...args: unknown[]) => UntypedQuery
  in: (...args: unknown[]) => UntypedQuery
  lte: (...args: unknown[]) => UntypedQuery
  gte: (...args: unknown[]) => UntypedQuery
  maybeSingle: () => Promise<QueryResult>
  single: () => Promise<QueryResult>
}

function table(client: unknown, relation: string): UntypedQuery {
  return (client as { from: (name: string) => UntypedQuery }).from(relation)
}

function ordinal(year: number, month: number): number {
  return year * 12 + month
}

function mapRow(row: unknown): OperationsReportClosure {
  return mapOperationsReportClosure(row as OperationsReportPeriodRow)
}

export const OperationsReportPeriodRepository = {
  async closeWithAccrualAndAudit(
    event: H3Event,
    input: {
      buildingId: string
      periodYear: number
      periodMonth: number
      billingPeriodId: string | null
      issuedRevenue: number
      reserveRatePercent: number
      accrualAmount: number
      closeSource: OperationsReportCloseSource
      closedBy: string | null
    },
  ): Promise<OperationsReportClosure> {
    const client = await serverSupabaseClient(event)
    const rpc = (client as unknown as { rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown, error: DbError | null }> }).rpc
    const { data, error } = await rpc('close_operations_report_with_audit', {
      p_building_id: input.buildingId,
      p_period_year: input.periodYear,
      p_period_month: input.periodMonth,
      p_billing_period_id: input.billingPeriodId,
      p_issued_revenue: input.issuedRevenue,
      p_reserve_rate_percent: input.reserveRatePercent,
      p_accrual_amount: input.accrualAmount,
      p_close_source: input.closeSource,
      p_actor_id: input.closedBy,
    })
    if (error) {
      if (error.message.includes('already closed')) throwConflict('Báo cáo vận hành đã được chốt')
      throwDbError(error, 'operationsReport.periods.closeWithAccrualAndAudit')
    }
    return mapRow(data)
  },

  async reopenWithAudit(
    event: H3Event,
    input: {
      buildingId: string
      periodYear: number
      periodMonth: number
      reopenedBy: string
      reason: string
    },
  ): Promise<OperationsReportClosure> {
    const client = await serverSupabaseClient(event)
    const rpc = (client as unknown as { rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown, error: DbError | null }> }).rpc
    const { data, error } = await rpc('reopen_operations_report_with_audit', {
      p_building_id: input.buildingId,
      p_period_year: input.periodYear,
      p_period_month: input.periodMonth,
      p_actor_id: input.reopenedBy,
      p_reason: input.reason,
    })
    if (error) {
      if (error.message.includes('not closed')) throwConflict('Báo cáo vận hành chưa chốt')
      throwDbError(error, 'operationsReport.periods.reopenWithAudit')
    }
    return mapRow(data)
  },

  async find(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<OperationsReportClosure | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'operations_report_periods')
      .select('*')
      .eq('building_id', buildingId)
      .eq('period_year', periodYear)
      .eq('period_month', periodMonth)
      .maybeSingle()
    if (error) throwDbError(error, 'operationsReport.periods.find')
    return data ? mapRow(data) : null
  },

  async findOrOpen(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<OperationsReportClosure> {
    return (await this.find(event, buildingId, periodYear, periodMonth))
      ?? openOperationsReportClosure({ buildingId, periodYear, periodMonth })
  },

  async isClosed(
    event: H3Event,
    buildingId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<boolean> {
    const period = await this.find(event, buildingId, periodYear, periodMonth)
    return period?.status === 'closed'
  },

  async close(
    event: H3Event,
    input: {
      buildingId: string
      periodYear: number
      periodMonth: number
      closeSource: OperationsReportCloseSource
      closedBy: string | null
    },
  ): Promise<OperationsReportClosure> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'operations_report_periods')
      .upsert({
        building_id: input.buildingId,
        period_year: input.periodYear,
        period_month: input.periodMonth,
        status: 'closed',
        close_source: input.closeSource,
        closed_at: new Date().toISOString(),
        closed_by: input.closedBy,
      }, { onConflict: 'building_id,period_year,period_month' })
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.periods.close')
    return mapRow(data)
  },

  async reopen(
    event: H3Event,
    input: {
      buildingId: string
      periodYear: number
      periodMonth: number
      reopenedBy: string
      reason: string
    },
  ): Promise<OperationsReportClosure> {
    const existing = await this.find(event, input.buildingId, input.periodYear, input.periodMonth)
    if (!existing || existing.status !== 'closed') {
      throwConflict('Báo cáo vận hành chưa chốt')
    }

    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'operations_report_periods')
      .update({
        status: 'open',
        close_source: null,
        closed_at: null,
        closed_by: null,
        reopened_at: new Date().toISOString(),
        reopened_by: input.reopenedBy,
        reopen_reason: input.reason,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.periods.reopen')
    return mapRow(data)
  },

  async listClosedInRange(
    event: H3Event,
    buildingId: string,
    fromYear: number,
    fromMonth: number,
    toYear: number | null,
    toMonth: number | null,
  ): Promise<OperationsReportClosure[]> {
    const fromOrdinal = ordinal(fromYear, fromMonth)
    const hasUpperBound = toYear != null && toMonth != null
    const toOrdinal = hasUpperBound
      ? ordinal(toYear, toMonth)
      : Number.MAX_SAFE_INTEGER

    const client = await serverSupabaseClient(event)
    let query = table(client, 'operations_report_periods')
      .select('*')
      .eq('building_id', buildingId)
      .eq('status', 'closed')
      .gte('period_year', fromYear)
    if (hasUpperBound) {
      query = query.lte('period_year', toYear)
    }
    const { data, error } = await query
    if (error) throwDbError(error, 'operationsReport.periods.listClosedInRange')
    return ((data ?? []) as OperationsReportPeriodRow[])
      .map(mapOperationsReportClosure)
      .filter(period => {
        const current = ordinal(period.periodYear, period.periodMonth)
        return fromOrdinal <= current && current <= toOrdinal
      })
  },
}
