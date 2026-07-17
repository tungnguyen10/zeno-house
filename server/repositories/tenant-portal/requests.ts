import type { H3Event } from 'h3'
import type { TablesInsert } from '~/types/database.types'
import type { TenantSupportRequestRow } from '~/utils/mappers/tenant-portal'
import { db } from '../../utils/db'

const COLUMNS = 'id, tenant_id, building_id, contract_id, title, description, status, attachment_path, created_at, updated_at'

export type TenantSupportRequestCreateRecord = TablesInsert<'support_requests'>

export interface TenantRequestContractContext {
  contractId: string
  buildingId: string
}

export const TenantSupportRequestRepository = {
  async listByTenantId(
    event: H3Event,
    tenantId: string,
  ): Promise<TenantSupportRequestRow[]> {
    const { data, error } = await db(event)
      .from('support_requests')
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throwDbError(error, 'tenantPortal.requests.listByTenantId')
    return data ?? []
  },

  async findActiveContractContext(
    event: H3Event,
    tenantId: string,
    today: string,
  ): Promise<TenantRequestContractContext | null> {
    const { data, error } = await db(event)
      .from('contracts')
      .select('id, building_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throwDbError(error, 'tenantPortal.requests.findActiveContractContext')
    return data ? { contractId: data.id, buildingId: data.building_id } : null
  },

  async create(
    event: H3Event,
    input: TenantSupportRequestCreateRecord,
  ): Promise<TenantSupportRequestRow> {
    const { data, error } = await db(event)
      .from('support_requests')
      .insert(input)
      .select(COLUMNS)
      .single()

    if (error) throwDbError(error, 'tenantPortal.requests.create')
    return data
  },

  async listByBuildingIds(
    event: H3Event,
    buildingIds: string[] | null,
  ): Promise<TenantSupportRequestRow[]> {
    if (buildingIds?.length === 0) return []

    let query = db(event)
      .from('support_requests')
      .select(COLUMNS)

    if (buildingIds !== null) query = query.in('building_id', buildingIds)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throwDbError(error, 'tenantPortal.requests.listByBuildingIds')
    return data ?? []
  },
}
