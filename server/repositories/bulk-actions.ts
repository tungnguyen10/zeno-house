import type { H3Event } from 'h3'
import { db } from '../utils/db'

export interface BulkActionResult {
  id: string
  succeeded: boolean
  reason: string | null
}

export const BulkActionRepository = {
  async resolveBuildingScopes(
    event: H3Event,
    entity: 'room' | 'contract',
    ids: string[],
  ): Promise<Map<string, string>> {
    const client = db(event)
    const table = entity === 'room' ? 'rooms' : 'contracts'
    const { data, error } = await client.from(table).select('id, building_id').in('id', ids)
    if (error) throwDbError(error, `bulkActions.${entity}.resolveBuildingScopes`)
    return new Map((data ?? []).map(row => [row.id, row.building_id]))
  },

  async execute(
    event: H3Event,
    entity: 'room' | 'tenant' | 'contract',
    action: string,
    ids: string[],
  ): Promise<BulkActionResult[]> {
    if (ids.length === 0) return []
    const client = db(event)
    const { data, error } = await client.rpc('bulk_master_data_action' as never, {
      p_entity: entity,
      p_action: action,
      p_ids: ids,
    } as never)
    if (error) throwDbError(error, `bulkActions.${entity}.${action}`)
    return ((data ?? []) as unknown as BulkActionResult[])
  },
}
