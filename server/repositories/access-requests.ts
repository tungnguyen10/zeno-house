import type { H3Event } from 'h3'
import type { AccessRequest, AccessRequestStatus, ApprovableRole } from '~/types/access-requests'
import type { AccessRequestApprovalInput } from '~/utils/validators/access-requests'
import { db } from '../utils/db'

interface AccessRequestRow {
  id: string
  auth_user_id: string
  email: string
  full_name: string | null
  provider: string
  status: AccessRequestStatus
  decision_role: ApprovableRole | null
  decision_building_ids: string[] | null
  decision_tenant_id: string | null
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  approval_claim_token: string | null
  created_at: string
  updated_at: string
}

const COLUMNS = 'id, auth_user_id, email, full_name, provider, status, decision_role, decision_building_ids, decision_tenant_id, rejection_reason, reviewed_by, reviewed_at, approval_claim_token, created_at, updated_at'

function mapRow(row: AccessRequestRow): AccessRequest {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    fullName: row.full_name,
    provider: row.provider,
    status: row.status,
    emailVerified: false,
    decisionRole: row.decision_role,
    decisionBuildingIds: row.decision_building_ids ?? [],
    decisionTenantId: row.decision_tenant_id,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    approvalClaimToken: row.approval_claim_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function client(event: H3Event): ReturnType<typeof db> {
  return db(event)
}

export const AccessRequestRepository = {
  async findById(event: H3Event, id: string): Promise<AccessRequest | null> {
    const { data, error } = await client(event).from('access_requests').select(COLUMNS).eq('id', id).maybeSingle()
    if (error) throwDbError(error, 'accessRequests.findById')
    return data ? mapRow(data as AccessRequestRow) : null
  },

  async findByUserId(event: H3Event, userId: string): Promise<AccessRequest | null> {
    const { data, error } = await client(event).from('access_requests').select(COLUMNS).eq('auth_user_id', userId).maybeSingle()
    if (error) throwDbError(error, 'accessRequests.findByUserId')
    return data ? mapRow(data as AccessRequestRow) : null
  },

  async list(event: H3Event, status?: AccessRequestStatus): Promise<AccessRequest[]> {
    let query = client(event).from('access_requests').select(COLUMNS).order('created_at', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throwDbError(error, 'accessRequests.list')
    return (data ?? []).map(row => mapRow(row as AccessRequestRow))
  },

  async appendCreationAuditOnce(event: H3Event, id: string, actorId: string): Promise<boolean> {
    const { data, error } = await client(event).rpc('append_access_request_created_audit', {
      p_request_id: id,
      p_actor_id: actorId,
    })
    if (error) throwDbError(error, 'accessRequests.appendCreationAuditOnce')
    return data === true
  },

  async claim(event: H3Event, id: string, reviewerId: string, input: AccessRequestApprovalInput): Promise<AccessRequest> {
    const approvalClaimToken = crypto.randomUUID()
    const decision = input.role === 'tenant'
      ? { decision_role: input.role, decision_tenant_id: input.tenant_id, decision_building_ids: [] }
      : { decision_role: input.role, decision_tenant_id: null, decision_building_ids: input.building_ids }
    const { data, error } = await client(event)
      .from('access_requests')
      .update({ ...decision, status: 'processing', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), approval_claim_token: approvalClaimToken })
      .eq('id', id)
      .eq('status', 'pending')
      .select(COLUMNS)
      .maybeSingle()
    if (error) throwDbError(error, 'accessRequests.claim')
    if (!data) throwConflict('Yêu cầu đã được xử lý')
    return mapRow(data as AccessRequestRow)
  },

  async approve(event: H3Event, id: string, approvalClaimToken: string): Promise<AccessRequest> {
    const { data, error } = await client(event)
      .from('access_requests')
      .update({ status: 'approved' })
      .eq('id', id)
      .eq('status', 'processing')
      .eq('approval_claim_token', approvalClaimToken)
      .select(COLUMNS)
      .maybeSingle()
    if (error) throwDbError(error, 'accessRequests.approve')
    if (!data) throwConflict('Phiên duyệt đã thay đổi')
    return mapRow(data as AccessRequestRow)
  },

  async restorePending(event: H3Event, id: string, approvalClaimToken: string): Promise<void> {
    const { data, error } = await client(event)
      .from('access_requests')
      .update({ status: 'pending', decision_role: null, decision_building_ids: [], decision_tenant_id: null, reviewed_by: null, reviewed_at: null, approval_claim_token: null })
      .eq('id', id)
      .eq('status', 'processing')
      .eq('approval_claim_token', approvalClaimToken)
      .select('id')
      .maybeSingle()
    if (error) throwDbError(error, 'accessRequests.restorePending')
    if (!data) throwConflict('Phiên duyệt đã thay đổi')
  },

  async reject(event: H3Event, id: string, reviewerId: string, reason: string): Promise<AccessRequest> {
    const { data, error } = await client(event)
      .from('access_requests')
      .update({ status: 'rejected', reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), rejection_reason: reason })
      .eq('id', id)
      .eq('status', 'pending')
      .select(COLUMNS)
      .maybeSingle()
    if (error) throwDbError(error, 'accessRequests.reject')
    if (!data) throwConflict('Yêu cầu đã được xử lý')
    return mapRow(data as AccessRequestRow)
  },
}
