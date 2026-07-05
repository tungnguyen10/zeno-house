import { db as serverSupabaseClient } from '../utils/db'
import type { H3Event } from 'h3'
import type { SharedExpense } from '~/types/shared-expenses'
import type {
  SharedExpenseCreateInput,
  SharedExpenseUpdateInput,
} from '~/utils/validators/shared-expenses'
import { mapSharedExpense, type SharedExpenseRow } from '~/utils/mappers/shared-expenses'

async function buildingIdsFor(event: H3Event, sharedExpenseId: string): Promise<string[]> {
  const client = await serverSupabaseClient(event)
  const { data, error } = await client
    .from('shared_expense_buildings')
    .select('building_id')
    .eq('shared_expense_id', sharedExpenseId)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return (data ?? []).map(row => row.building_id)
}

async function mapWithBuildings(event: H3Event, row: SharedExpenseRow): Promise<SharedExpense> {
  return mapSharedExpense(row, await buildingIdsFor(event, row.id))
}

export const SharedExpenseRepository = {
  async listByOwner(event: H3Event, ownerId: string): Promise<SharedExpense[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('shared_expenses')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return Promise.all(((data ?? []) as SharedExpenseRow[]).map(row => mapWithBuildings(event, row)))
  },

  async listAll(event: H3Event): Promise<SharedExpense[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('shared_expenses')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw createError({ statusCode: 500, message: error.message })
    return Promise.all(((data ?? []) as SharedExpenseRow[]).map(row => mapWithBuildings(event, row)))
  },

  async findById(event: H3Event, id: string): Promise<SharedExpense | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('shared_expenses')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    return data ? mapWithBuildings(event, data as SharedExpenseRow) : null
  },

  async insert(
    event: H3Event,
    ownerId: string,
    input: SharedExpenseCreateInput,
    createdBy: string,
  ): Promise<SharedExpense> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('shared_expenses')
      .insert({
        owner_id: ownerId,
        name: input.name,
        category: input.category,
        amount: input.amount,
        note: input.note ?? null,
        is_active: input.is_active ?? true,
        created_by: createdBy,
      })
      .select()
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    await this.replaceBuildings(event, data.id, input.building_ids)
    return mapWithBuildings(event, data as SharedExpenseRow)
  },

  async update(
    event: H3Event,
    id: string,
    input: SharedExpenseUpdateInput,
  ): Promise<SharedExpense> {
    const client = await serverSupabaseClient(event)
    const patch = {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      }
    if (Object.keys(patch).length > 0) {
      const { data, error } = await client
        .from('shared_expenses')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw createError({ statusCode: 500, message: error.message })
      void data
    }
    if (input.building_ids) await this.replaceBuildings(event, id, input.building_ids)
    const refreshed = await this.findById(event, id)
    if (!refreshed) throw createError({ statusCode: 500, message: 'Shared expense disappeared' })
    return refreshed
  },

  async deactivate(event: H3Event, id: string): Promise<void> {
    const client = await serverSupabaseClient(event)
    const { error } = await client
      .from('shared_expenses')
      .update({ is_active: false })
      .eq('id', id)
    if (error) throw createError({ statusCode: 500, message: error.message })
  },

  async replaceBuildings(event: H3Event, id: string, buildingIds: string[]): Promise<void> {
    const client = await serverSupabaseClient(event)
    const removed = await client
      .from('shared_expense_buildings')
      .delete()
      .eq('shared_expense_id', id)
    if (removed.error) throw createError({ statusCode: 500, message: removed.error.message })
    const rows = buildingIds.map(building_id => ({ shared_expense_id: id, building_id }))
    const inserted = await client.from('shared_expense_buildings').insert(rows)
    if (inserted.error) throw createError({ statusCode: 500, message: inserted.error.message })
  },

  async hasAllocation(
    event: H3Event,
    sharedExpenseId: string,
    periodYear: number,
    periodMonth: number,
  ): Promise<boolean> {
    const client = await serverSupabaseClient(event)
    const marker = `[shared:${sharedExpenseId}:${periodYear}-${String(periodMonth).padStart(2, '0')}]`
    const { data, error } = await client
      .from('building_expenses')
      .select('id')
      .ilike('note', `%${marker}%`)
      .limit(1)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return (data ?? []).length > 0
  },
}
