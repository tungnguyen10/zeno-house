import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { PrepaidExpense } from '~/types/operations-report'
import type {
  PrepaidExpenseCreateInput,
  PrepaidExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import { mapPrepaidExpense, type PrepaidExpenseRow } from '~/utils/mappers/operations-report'

interface UntypedQuery {
  select(columns?: string): UntypedQuery
  eq(column: string, value: unknown): UntypedQuery
  lte(column: string, value: unknown): UntypedQuery
  gt(column: string, value: unknown): UntypedQuery
  order(column: string, options?: Record<string, unknown>): UntypedQuery
  insert(values: Record<string, unknown>): UntypedQuery
  update(values: Record<string, unknown>): UntypedQuery
  delete(): UntypedQuery
  single(): Promise<{ data: unknown, error: { message: string } | null }>
  maybeSingle(): Promise<{ data: unknown, error: { message: string } | null }>
  then<TResult1 = { data: unknown, error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown, error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
}

interface UntypedSupabaseClient {
  from(table: string): UntypedQuery
}

function table(client: unknown, name: string): UntypedQuery {
  return (client as UntypedSupabaseClient).from(name)
}

export interface PrepaidExpenseComputedFields {
  end_date: string
  monthly_amount: number
  status?: 'active' | 'expired' | 'cancelled'
}

export const PrepaidExpenseRepository = {
  async listByBuilding(event: H3Event, buildingId: string): Promise<PrepaidExpense[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'prepaid_expenses')
      .select('*')
      .eq('building_id', buildingId)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.listByBuilding')
    return ((data ?? []) as PrepaidExpenseRow[]).map(mapPrepaidExpense)
  },

  async listActiveInPeriod(
    event: H3Event,
    buildingId: string,
    periodStart: string,
  ): Promise<PrepaidExpense[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'prepaid_expenses')
      .select('*')
      .eq('building_id', buildingId)
      .eq('status', 'active')
      .lte('start_date', periodStart)
      .gt('end_date', periodStart)
      .order('start_date', { ascending: true })
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.listActiveInPeriod')
    return ((data ?? []) as PrepaidExpenseRow[]).map(mapPrepaidExpense)
  },

  async findById(event: H3Event, id: string): Promise<PrepaidExpense | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'prepaid_expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.findById')
    return data ? mapPrepaidExpense(data as PrepaidExpenseRow) : null
  },

  async insert(
    event: H3Event,
    input: PrepaidExpenseCreateInput & PrepaidExpenseComputedFields,
    createdBy: string,
  ): Promise<PrepaidExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'prepaid_expenses')
      .insert({
        building_id: input.building_id,
        name: input.name,
        category: input.category,
        total_amount: input.total_amount,
        total_months: input.total_months,
        start_date: input.start_date,
        end_date: input.end_date,
        monthly_amount: input.monthly_amount,
        status: input.status ?? 'active',
        receipt_url: input.receipt_url ?? null,
        note: input.note ?? null,
        created_by: createdBy,
      })
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.insert')
    return mapPrepaidExpense(data as PrepaidExpenseRow)
  },

  async updateById(
    event: H3Event,
    id: string,
    input: PrepaidExpenseUpdateInput & Partial<PrepaidExpenseComputedFields>,
  ): Promise<PrepaidExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'prepaid_expenses')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.total_amount !== undefined && { total_amount: input.total_amount }),
        ...(input.total_months !== undefined && { total_months: input.total_months }),
        ...(input.start_date !== undefined && { start_date: input.start_date }),
        ...(input.end_date !== undefined && { end_date: input.end_date }),
        ...(input.monthly_amount !== undefined && { monthly_amount: input.monthly_amount }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.receipt_url !== undefined && { receipt_url: input.receipt_url }),
        ...(input.note !== undefined && { note: input.note }),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.updateById')
    return mapPrepaidExpense(data as PrepaidExpenseRow)
  },

  async deleteById(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await table(client, 'prepaid_expenses')
      .delete()
      .eq('id', id)
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.deleteById')
  },

  async markExpiredBefore(event: H3Event, today: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await table(client, 'prepaid_expenses')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lte('end_date', today)
    if (error) throwDbError(error, 'operationsReport.prepaidExpenses.markExpiredBefore')
  },
}
