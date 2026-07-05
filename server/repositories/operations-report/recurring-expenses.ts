import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { RecurringExpense } from '~/types/operations-report'
import type {
  RecurringExpenseCreateInput,
  RecurringExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import {
  mapRecurringExpense,
  type RecurringExpenseRow,
} from '~/utils/mappers/operations-report'

interface UntypedQuery {
  select(columns?: string): UntypedQuery
  eq(column: string, value: unknown): UntypedQuery
  lte(column: string, value: unknown): UntypedQuery
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

export const RecurringExpenseRepository = {
  async listByBuilding(event: H3Event, buildingId: string): Promise<RecurringExpense[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'recurring_expenses')
      .select('*')
      .eq('building_id', buildingId)
      .order('next_reminder_at', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return ((data ?? []) as RecurringExpenseRow[]).map(mapRecurringExpense)
  },

  async listUpcoming(
    event: H3Event,
    buildingId: string,
    throughDate: string,
  ): Promise<RecurringExpense[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'recurring_expenses')
      .select('*')
      .eq('building_id', buildingId)
      .eq('is_active', true)
      .lte('next_reminder_at', throughDate)
      .order('next_reminder_at', { ascending: true })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return ((data ?? []) as RecurringExpenseRow[]).map(mapRecurringExpense)
  },

  async findById(event: H3Event, id: string): Promise<RecurringExpense | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'recurring_expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapRecurringExpense(data as RecurringExpenseRow) : null
  },

  async insert(
    event: H3Event,
    input: RecurringExpenseCreateInput & { next_reminder_at: string },
    createdBy: string,
  ): Promise<RecurringExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'recurring_expenses')
      .insert({
        building_id: input.building_id,
        name: input.name,
        category: input.category,
        frequency: input.frequency,
        anchor_day: input.anchor_day,
        estimated_amount: input.estimated_amount,
        is_active: input.is_active ?? true,
        next_reminder_at: input.next_reminder_at,
        created_by: createdBy,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapRecurringExpense(data as RecurringExpenseRow)
  },

  async updateById(
    event: H3Event,
    id: string,
    input: RecurringExpenseUpdateInput & { next_reminder_at?: string },
  ): Promise<RecurringExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await table(client, 'recurring_expenses')
      .update({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.frequency !== undefined && { frequency: input.frequency }),
        ...(input.anchor_day !== undefined && { anchor_day: input.anchor_day }),
        ...(input.estimated_amount !== undefined && { estimated_amount: input.estimated_amount }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
        ...(input.next_reminder_at !== undefined && { next_reminder_at: input.next_reminder_at }),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapRecurringExpense(data as RecurringExpenseRow)
  },

  async deleteById(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await table(client, 'recurring_expenses')
      .delete()
      .eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },
}
