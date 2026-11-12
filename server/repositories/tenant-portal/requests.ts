import type { TenantSupportRequestStatus } from '~/types/tenant-portal'
import type { TenantSupportRequestStatusUpdate } from '~/utils/validators/tenant-support-requests'
import { throwConflict, throwNotFound, throwValidationError } from '../../utils/errors'
import type { H3Event } from 'h3'
import type { TablesInsert } from '~/types/database.types'
import type { TenantSupportRequestRow } from '~/utils/mappers/tenant-portal'
import { db } from '../../utils/db'

const COLUMNS = 'id, tenant_id, building_id, contract_id, title, description, status, attachment_path, created_at, updated_at'

export type TenantSupportRequestCandidate = Pick<TenantSupportRequestRow, 'id' | 'tenant_id' | 'building_id' | 'contract_id' | 'status' | 'created_at'>
const CANDIDATE_COLUMNS = 'id, tenant_id, building_id, contract_id, status, created_at'

export type TenantSupportRequestCreateRecord = TablesInsert<'support_requests'>

export const TenantSupportRequestRepository = {
  async listOperatorCandidates(event: H3Event, buildingIds: string[] | null, status?: TenantSupportRequestStatus): Promise<TenantSupportRequestCandidate[]> {
    if (buildingIds?.length === 0) return []
    const rows: TenantSupportRequestCandidate[] = []
    // Explicit ranges avoid the PostgREST default row cap truncating authorized totals.
    const batchSize = 500
    for (let offset = 0; ; offset += batchSize) {
      let query = db(event).from('support_requests').select(CANDIDATE_COLUMNS)
      if (buildingIds !== null) query = query.in('building_id', buildingIds)
      if (status) query = query.eq('status', status)
      const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + batchSize - 1)
      if (error) throwDbError(error, 'tenantPortal.requests.operatorCandidates')
      rows.push(...(data ?? []))
      if ((data?.length ?? 0) < batchSize) return rows
    }
  },

  async findOperatorCandidate(event: H3Event, id: string): Promise<TenantSupportRequestCandidate | null> {
    const { data, error } = await db(event).from('support_requests').select(CANDIDATE_COLUMNS).eq('id', id).maybeSingle()
    if (error) throwDbError(error, 'tenantPortal.requests.operatorCandidate')
    return data
  },

  async findByIds(event: H3Event, ids: string[]): Promise<TenantSupportRequestRow[]> {
    if (!ids.length) return []
    const { data, error } = await db(event).from('support_requests').select(COLUMNS).in('id', ids)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
    if (error) throwDbError(error, 'tenantPortal.requests.operatorDetails')
    return data ?? []
  },

  async updateStatusWithAudit(event: H3Event, id: string, input: TenantSupportRequestStatusUpdate, actorId: string): Promise<TenantSupportRequestRow> {
    const client = db(event)
    const { data, error } = await client.rpc('update_tenant_support_request_status_with_audit', {
      p_request_id: id, p_expected_status: input.expected_status, p_status: input.status, p_actor_id: actorId,
    })
    if (error) {
      if (error.message === 'SUPPORT_REQUEST_STATUS_STALE') throwConflict('Yêu cầu đã được cập nhật. Vui lòng tải lại trước khi xử lý.')
      if (error.message === 'SUPPORT_REQUEST_NOT_FOUND') throwNotFound('Không tìm thấy yêu cầu')
      if (['SUPPORT_REQUEST_STATUS_TRANSITION_INVALID', 'SUPPORT_REQUEST_STATUS_INPUT_INVALID'].includes(error.message)) throwValidationError('Không thể chuyển sang trạng thái này')
      throwDbError(error, 'tenantPortal.requests.updateStatusWithAudit')
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throwInternal(new Error('Invalid support request status result'), 'tenantPortal.requests.updateStatusWithAudit')
    return data as unknown as TenantSupportRequestRow
  },

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
