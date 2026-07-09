import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'
import type { BuildingFixedCost } from '~/types/operations-report'
import type {
  BuildingFixedCostCreateInput,
  BuildingFixedCostUpdateInput,
} from '~/utils/validators/operations-report'
import { mapBuildingFixedCost } from '~/utils/mappers/operations-report'

export const BuildingFixedCostRepository = {
  async listByBuilding(event: H3Event, buildingId: string): Promise<BuildingFixedCost[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_fixed_costs')
      .select('*')
      .eq('building_id', buildingId)
      .order('effective_from_period_year', { ascending: false })
      .order('effective_from_period_month', { ascending: false })
    if (error) throwDbError(error, 'operationsReport.fixedCosts.listByBuilding')
    return (data ?? []).map(mapBuildingFixedCost)
  },

  async findById(event: H3Event, id: string): Promise<BuildingFixedCost | null> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_fixed_costs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throwDbError(error, 'operationsReport.fixedCosts.findById')
    return data ? mapBuildingFixedCost(data) : null
  },

  async insert(
    event: H3Event,
    input: BuildingFixedCostCreateInput,
    createdBy: string,
  ): Promise<BuildingFixedCost> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_fixed_costs')
      .insert({
        building_id: input.building_id,
        category: input.category,
        amount: input.amount,
        effective_from_period_year: input.effective_from_period_year,
        effective_from_period_month: input.effective_from_period_month,
        effective_to_period_year: input.effective_to_period_year ?? null,
        effective_to_period_month: input.effective_to_period_month ?? null,
        note: input.note ?? null,
        created_by: createdBy,
      })
      .select()
      .single()
    if (error) throwDbError(error, 'operationsReport.fixedCosts.insert')
    return mapBuildingFixedCost(data)
  },

  async updateById(
    event: H3Event,
    id: string,
    input: BuildingFixedCostUpdateInput,
  ): Promise<BuildingFixedCost> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('building_fixed_costs')
      .update({
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.note !== undefined && { note: input.note }),
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
    if (error) throwDbError(error, 'operationsReport.fixedCosts.updateById')
    return mapBuildingFixedCost(data)
  },
}
