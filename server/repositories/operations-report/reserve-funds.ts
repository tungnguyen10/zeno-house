import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type {
  BuildingReserveFundRate,
  ReserveFund,
  ReserveFundTransaction,
} from '~/types/operations-report'
import type {
  ReserveFundRateCreateInput,
  ReserveFundRateUpdateInput,
} from '~/utils/validators/operations-report'
import {
  mapBuildingReserveFundRate,
  mapReserveFund,
  mapReserveFundTransaction,
  type BuildingReserveFundRateRow,
  type ReserveFundRow,
  type ReserveFundTransactionRow,
} from '~/utils/mappers/operations-report'

type SupabaseClient = Awaited<ReturnType<typeof serverSupabaseClient>>
type DbError = { message: string }
type QueryResult = { data: unknown, error: DbError | null }
type UntypedQuery = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => UntypedQuery
  insert: (...args: unknown[]) => UntypedQuery
  update: (...args: unknown[]) => UntypedQuery
  eq: (...args: unknown[]) => UntypedQuery
  is: (...args: unknown[]) => UntypedQuery
  order: (...args: unknown[]) => UntypedQuery
  single: () => Promise<QueryResult>
  maybeSingle: () => Promise<QueryResult>
}

function table(client: SupabaseClient, relation: string): UntypedQuery {
  return (client as unknown as { from: (name: string) => UntypedQuery }).from(relation)
}

export const ReserveFundRepository = {
  async findOrCreateByBuilding(event: H3Event, buildingId: string): Promise<ReserveFundRow> {
    const client = await serverSupabaseClient(event)
    const existing = await client
      .from('reserve_funds')
      .select('*')
      .eq('building_id', buildingId)
      .maybeSingle()
    if (existing.error) throwDbError(existing.error, 'operationsReport.reserveFunds.findOrCreateByBuilding.existing')
    if (existing.data) return existing.data

    const created = await client
      .from('reserve_funds')
      .insert({ building_id: buildingId })
      .select()
      .single()
    if (created.error) throwDbError(created.error, 'operationsReport.reserveFunds.findOrCreateByBuilding.create')
    return created.data
  },

  async listTransactions(event: H3Event, fundId: string): Promise<ReserveFundTransaction[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'reserve_fund_transactions')
      .select('*')
      .eq('fund_id', fundId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throwDbError(error, 'operationsReport.reserveFunds.listTransactions')
    return ((data ?? []) as ReserveFundTransactionRow[]).map(mapReserveFundTransaction)
  },

  async getByBuilding(event: H3Event, buildingId: string): Promise<ReserveFund> {
    const fund = await this.findOrCreateByBuilding(event, buildingId)
    const transactions = await this.listTransactions(event, fund.id)
    return mapReserveFund(fund, transactions)
  },

  async insertTransaction(
    event: H3Event,
    input: {
      fundId: string
      type: 'deposit' | 'withdrawal'
      source?: 'manual' | 'monthly_accrual' | 'expense_deduction'
      amount: number
      date: string
      periodYear?: number | null
      periodMonth?: number | null
      billingPeriodId?: string | null
      reserveRatePercent?: number | null
      issuedRevenue?: number | null
      note?: string | null
      linkedExpenseId?: string | null
      createdBy: string | null
    },
  ): Promise<ReserveFundTransaction> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'reserve_fund_transactions')
      .insert({
        fund_id: input.fundId,
        type: input.type,
        source: input.source ?? 'manual',
        amount: input.amount,
        date: input.date,
        period_year: input.periodYear ?? null,
        period_month: input.periodMonth ?? null,
        billing_period_id: input.billingPeriodId ?? null,
        reserve_rate_percent: input.reserveRatePercent ?? null,
        issued_revenue: input.issuedRevenue ?? null,
        note: input.note ?? null,
        linked_expense_id: input.linkedExpenseId ?? null,
        created_by: input.createdBy,
      })
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.insertTransaction')
    return mapReserveFundTransaction(data as ReserveFundTransactionRow)
  },

  async findWithdrawalByExpense(
    event: H3Event,
    expenseId: string,
  ): Promise<ReserveFundTransaction | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'reserve_fund_transactions')
      .select('*')
      .eq('linked_expense_id', expenseId)
      .eq('type', 'withdrawal')
      .is('voided_at', null)
      .maybeSingle()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.findWithdrawalByExpense')
    return data ? mapReserveFundTransaction(data as ReserveFundTransactionRow) : null
  },

  async upsertExpenseDeduction(
    event: H3Event,
    input: {
      buildingId: string
      expenseId: string
      amount: number
      date: string
      periodYear: number
      periodMonth: number
      note?: string | null
      createdBy: string
    },
  ): Promise<ReserveFundTransaction> {
    const fund = await this.findOrCreateByBuilding(event, input.buildingId)
    const client = await serverSupabaseClient(event)
    const existing = await table(client, 'reserve_fund_transactions')
      .select('*')
      .eq('linked_expense_id', input.expenseId)
      .eq('source', 'expense_deduction')
      .is('voided_at', null)
      .maybeSingle()
    if (existing.error) throwDbError(existing.error, 'operationsReport.reserveFunds.upsertExpenseDeduction.existing')

    const payload = {
      fund_id: fund.id,
      type: 'withdrawal',
      source: 'expense_deduction',
      amount: input.amount,
      date: input.date,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      linked_expense_id: input.expenseId,
      note: input.note ?? null,
      created_by: input.createdBy,
    }

    const existingRow = existing.data as { id: string } | null
    const query = existingRow
      ? table(client, 'reserve_fund_transactions').update(payload).eq('id', existingRow.id)
      : table(client, 'reserve_fund_transactions').insert(payload)
    const { data, error } = await query.select().single()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.upsertExpenseDeduction')
    return mapReserveFundTransaction(data as ReserveFundTransactionRow)
  },

  async voidExpenseDeduction(
    event: H3Event,
    expenseId: string,
    voidedBy: string,
    reason: string,
  ): Promise<ReserveFundTransaction | null> {
    const existing = await this.findWithdrawalByExpense(event, expenseId)
    if (!existing) return null
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'reserve_fund_transactions')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: voidedBy,
        void_reason: reason,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.voidExpenseDeduction')
    return mapReserveFundTransaction(data as ReserveFundTransactionRow)
  },

  async upsertMonthlyAccrual(
    event: H3Event,
    input: {
      buildingId: string
      periodYear: number
      periodMonth: number
      billingPeriodId: string | null
      amount: number
      reserveRatePercent: number
      issuedRevenue: number
      createdBy: string | null
    },
  ): Promise<ReserveFundTransaction> {
    const fund = await this.findOrCreateByBuilding(event, input.buildingId)
    const client = await serverSupabaseClient(event)
    const existing = await table(client, 'reserve_fund_transactions')
      .select('*')
      .eq('fund_id', fund.id)
      .eq('source', 'monthly_accrual')
      .eq('period_year', input.periodYear)
      .eq('period_month', input.periodMonth)
      .maybeSingle()
    if (existing.error) throwDbError(existing.error, 'operationsReport.reserveFunds.upsertMonthlyAccrual.existing')

    const payload = {
      fund_id: fund.id,
      type: 'deposit',
      source: 'monthly_accrual',
      amount: input.amount,
      date: `${input.periodYear}-${String(input.periodMonth).padStart(2, '0')}-01`,
      period_year: input.periodYear,
      period_month: input.periodMonth,
      billing_period_id: input.billingPeriodId,
      reserve_rate_percent: input.reserveRatePercent,
      issued_revenue: input.issuedRevenue,
      linked_expense_id: null,
      note: `Reserve accrual ${input.periodYear}-${String(input.periodMonth).padStart(2, '0')}`,
      created_by: input.createdBy,
      voided_at: null,
      voided_by: null,
      void_reason: null,
    }

    const existingRow = existing.data as { id: string } | null
    const query = existingRow
      ? table(client, 'reserve_fund_transactions').update(payload).eq('id', existingRow.id)
      : table(client, 'reserve_fund_transactions').insert(payload)
    const { data, error } = await query.select().single()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.upsertMonthlyAccrual')
    return mapReserveFundTransaction(data as ReserveFundTransactionRow)
  },

  async listRatesByBuilding(event: H3Event, buildingId: string): Promise<BuildingReserveFundRate[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'building_reserve_fund_rates')
      .select('*')
      .eq('building_id', buildingId)
      .order('effective_from_period_year', { ascending: false })
      .order('effective_from_period_month', { ascending: false })
    if (error) throwDbError(error, 'operationsReport.reserveFunds.listRatesByBuilding')
    return ((data ?? []) as BuildingReserveFundRateRow[]).map(mapBuildingReserveFundRate)
  },

  async findRateById(event: H3Event, id: string): Promise<BuildingReserveFundRate | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'building_reserve_fund_rates')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.findRateById')
    return data ? mapBuildingReserveFundRate(data as BuildingReserveFundRateRow) : null
  },

  async insertRate(
    event: H3Event,
    input: ReserveFundRateCreateInput,
    createdBy: string,
  ): Promise<BuildingReserveFundRate> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'building_reserve_fund_rates')
      .insert({
        building_id: input.building_id,
        reserve_rate_percent: input.reserve_rate_percent,
        effective_from_period_year: input.effective_from_period_year,
        effective_from_period_month: input.effective_from_period_month,
        effective_to_period_year: input.effective_to_period_year ?? null,
        effective_to_period_month: input.effective_to_period_month ?? null,
        created_by: createdBy,
      })
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.insertRate')
    return mapBuildingReserveFundRate(data as BuildingReserveFundRateRow)
  },

  async updateRateById(
    event: H3Event,
    id: string,
    input: ReserveFundRateUpdateInput,
  ): Promise<BuildingReserveFundRate> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'building_reserve_fund_rates')
      .update({
        ...(input.reserve_rate_percent !== undefined && {
          reserve_rate_percent: input.reserve_rate_percent,
        }),
        ...(input.effective_to_period_year !== undefined && {
          effective_to_period_year: input.effective_to_period_year,
        }),
        ...(input.effective_to_period_month !== undefined && {
          effective_to_period_month: input.effective_to_period_month,
        }),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.reserveFunds.updateRateById')
    return mapBuildingReserveFundRate(data as BuildingReserveFundRateRow)
  },
}
