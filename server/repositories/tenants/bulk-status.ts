import type { H3Event } from 'h3'
import { db } from '../../utils/db'
import type { BulkActionResult } from '../bulk-actions'

export type TenantBulkStatusItem = { id: string; expected_building_ids: string[] }
export const TenantBulkStatusRepository = {
  async execute(event: H3Event, action: 'archive' | 'activate', items: TenantBulkStatusItem[]): Promise<BulkActionResult[]> {
    if (!items.length) return []
    const { data, error } = await db(event).rpc('bulk_tenant_status_action', {
      p_action: action,
      p_items: items,
    })
    if (error) throwDbError(error, 'tenants.bulkStatus')
    return (data ?? []) as BulkActionResult[]
  },
}
