import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { BuildingExpense } from '~/types/operations-report'
import type {
  BuildingExpenseCreateInput,
  BuildingExpenseUpdateInput,
} from '~/utils/validators/operations-report'
import { mapBuildingExpense } from '~/utils/mappers/operations-report'

export interface BuildingExpenseListFilter {
  buildingId: string
  periodYear: number
  periodMonth: number
  category?: string
}

export const BuildingExpenseRepository = {
  async list(event: H3Event, filter: BuildingExpenseListFilter): Promise<BuildingExpense[]> {
    const client = await serverSupabaseClient(event)
    let query = client
      .from('building_expenses')
      .select('*')
      .eq('building_id', filter.buildingId)
      .eq('period_year', filter.periodYear)
      .eq('period_month', filter.periodMonth)
      .is('voided_at', null)
    if (filter.category) query = query.eq('category', filter.category)
    const { data, error } = await query
      .order('expense_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).map(mapBuildingExpense)
  },

  async findById(event: H3Event, id: string): Promise<BuildingExpense | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapBuildingExpense(data) : null
  },

  async insert(
    event: H3Event,
    input: BuildingExpenseCreateInput,
    createdBy: string,
  ): Promise<BuildingExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_expenses')
      .insert({
        building_id: input.building_id,
        period_year: input.period_year,
        period_month: input.period_month,
        expense_date: input.expense_date ?? null,
        category: input.category,
        amount: input.amount,
        payee: input.payee ?? null,
        payment_method: input.payment_method ?? null,
        note: input.note ?? null,
        created_by: createdBy,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBuildingExpense(data)
  },

  async updateById(
    event: H3Event,
    id: string,
    input: BuildingExpenseUpdateInput,
  ): Promise<BuildingExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_expenses')
      .update({
        ...(input.period_year !== undefined && { period_year: input.period_year }),
        ...(input.period_month !== undefined && { period_month: input.period_month }),
        ...(input.expense_date !== undefined && { expense_date: input.expense_date }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.payee !== undefined && { payee: input.payee }),
        ...(input.payment_method !== undefined && { payment_method: input.payment_method }),
        ...(input.note !== undefined && { note: input.note }),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBuildingExpense(data)
  },

  async voidById(
    event: H3Event,
    id: string,
    voidedBy: string,
    voidReason: string,
  ): Promise<BuildingExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_expenses')
      .update({
        voided_at: new Date().toISOString(),
        voided_by: voidedBy,
        void_reason: voidReason,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return mapBuildingExpense(data)
  },
}
