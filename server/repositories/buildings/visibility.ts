import { db as serverSupabaseClient } from '../../utils/db'
import type { H3Event } from 'h3'

/**
 * Split out from the building repository because `server/utils/scope.ts` calls
 * this on every list request; keeping it isolated stops unrelated service tests
 * from having to stub the whole building repository.
 */
export const BuildingVisibilityRepository = {
  async findHiddenIds(event: H3Event): Promise<string[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('id')
      .eq('is_hidden', true)
    if (error) throwDbError(error, 'buildings.findHiddenIds')
    return (data ?? []).map((row: { id: string }) => row.id)
  },

  async findVisibleIds(event: H3Event): Promise<string[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('id')
      .eq('is_hidden', false)
    if (error) throwDbError(error, 'buildings.findVisibleIds')
    return (data ?? []).map((row: { id: string }) => row.id)
  },
}
