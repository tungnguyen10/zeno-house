import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { AccessRequest, AccessRequestStatus, CurrentAccessRequest } from '~/types/access-requests'
import type { AccessRequestApprovalInput, AccessRequestRejectionInput } from '~/utils/validators/access-requests'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { AccessRequestRepository } from '../repositories/access-requests'
import { UserRepository } from '../repositories/users'
import { BuildingRepository } from '../repositories/buildings'
import { AssignmentRepository } from '../repositories/assignments'
import { TenantRepository } from '../repositories/tenants'
import { TenantAccountLinkRepository } from '../repositories/tenant-portal/account-links'
import { AuditService } from './audit'

function assertCanApprove(actor: AuthUser): void {
  if (!can(actor, 'users.approve.pending')) throwForbidden('Chỉ admin được duyệt tài khoản')
}

async function withVerification(event: H3Event, request: AccessRequest): Promise<AccessRequest> {
  const account = await UserRepository.getAuthAccount(event, request.authUserId)
  return { ...request, emailVerified: Boolean(account?.emailConfirmed) }
}

async function auditCreationOnce(event: H3Event, actor: AuthUser, request: AccessRequest): Promise<void> {
  await AccessRequestRepository.appendCreationAuditOnce(event, request.id, actor.id)
}

function decisionMatches(request: AccessRequest, input: AccessRequestApprovalInput): boolean {
  if (request.decisionRole !== input.role) return false
  if (input.role === 'tenant') return request.decisionTenantId === input.tenant_id
  const stored = [...request.decisionBuildingIds].sort()
  const incoming = [...new Set(input.building_ids)].sort()
  return stored.length === incoming.length && stored.every((id, index) => id === incoming[index])
}

async function appendApprovalAudit(event: H3Event, actor: AuthUser, request: AccessRequest, input: AccessRequestApprovalInput): Promise<void> {
  await AuditService.append(event, actor, {
    building_id: null,
    action: AUDIT_ACTIONS.USER_ACCESS_REQUEST_APPROVED,
    entity_type: 'user',
    entity_id: request.authUserId,
    metadata: input.role === 'tenant'
      ? { role: input.role, tenant_id: input.tenant_id }
      : { role: input.role, building_ids: input.building_ids },
  })
}

async function finalizeApproval(event: H3Event, actor: AuthUser, request: AccessRequest, input: AccessRequestApprovalInput): Promise<AccessRequest> {
  if (!request.approvalClaimToken) throwConflict('Yêu cầu không có phiên duyệt hợp lệ')
  const approved = await AccessRequestRepository.approve(event, request.id, request.approvalClaimToken)
  await appendApprovalAudit(event, actor, request, input)
  return { ...approved, emailVerified: true }
}

export const AccessRequestService = {
  async getMine(event: H3Event, actor: AuthUser): Promise<CurrentAccessRequest> {
    const request = await AccessRequestRepository.findByUserId(event, actor.id)
    if (!request) throwNotFound('Không tìm thấy yêu cầu truy cập')
    await auditCreationOnce(event, actor, request)
    return {
      status: request.status,
      email: request.email,
      rejectionReason: request.rejectionReason,
      decisionRole: request.decisionRole,
    }
  },

  async list(event: H3Event, actor: AuthUser, status?: AccessRequestStatus): Promise<AccessRequest[]> {
    assertCanApprove(actor)
    const requests = await AccessRequestRepository.list(event, status)
    await Promise.all(requests.map(request => auditCreationOnce(event, actor, request)))
    return Promise.all(requests.map(request => withVerification(event, request)))
  },

  async approve(event: H3Event, actor: AuthUser, id: string, input: AccessRequestApprovalInput): Promise<AccessRequest> {
    assertCanApprove(actor)
    let request = await AccessRequestRepository.findById(event, id)
    if (!request) throwNotFound('Không tìm thấy yêu cầu truy cập')

    const resuming = request.status === 'processing'
    let account
    let roleAlreadyConfirmed = false
    if (resuming) {
      if (!decisionMatches(request, input)) throwConflict('Yêu cầu đang được xử lý với quyết định khác')
      account = await UserRepository.getAuthAccount(event, request.authUserId)
      if (!account) throwNotFound('Không tìm thấy tài khoản đăng nhập')
      roleAlreadyConfirmed = account.role === input.role
      if (account.role && !roleAlreadyConfirmed) throwConflict('Tài khoản đã có quyền truy cập khác')
    }
    else if (request.status !== 'pending') {
      throwConflict('Yêu cầu đã được xử lý')
    }

    account ??= await UserRepository.getAuthAccount(event, request.authUserId)
    if (!account) throwNotFound('Không tìm thấy tài khoản đăng nhập')
    if (!account.emailConfirmed) throwValidationError('Email chưa được xác minh')
    if (account.role && !roleAlreadyConfirmed) throwConflict('Tài khoản đã có quyền truy cập')

    if (input.role === 'tenant') {
      const tenant = await TenantRepository.findById(event, input.tenant_id)
      if (!tenant) throwValidationError('Người thuê không tồn tại')
      const existingLink = await TenantAccountLinkRepository.getByTenantId(event, input.tenant_id)
      if (existingLink && (!resuming || existingLink.approvalClaimToken !== request.approvalClaimToken || existingLink.authUserId !== request.authUserId)) {
        throwConflict('Người thuê đã có tài khoản')
      }
    }
    else {
      for (const buildingId of [...new Set(input.building_ids)]) {
        if (!await BuildingRepository.findById(event, buildingId)) {
          throwValidationError('Tòa nhà không tồn tại')
        }
        const existingAssignment = await AssignmentRepository.findByUserAndBuilding(event, request.authUserId, buildingId)
        if (existingAssignment && (!resuming || existingAssignment.approval_claim_token !== request.approvalClaimToken)) {
          throwConflict('Tài khoản đã được gán vào tòa nhà này')
        }
      }
    }

    if (!resuming) request = await AccessRequestRepository.claim(event, id, actor.id, input)
    if (!request.approvalClaimToken) throwConflict('Không thể tạo phiên duyệt')
    if (input.role === 'tenant') {
      const existingLink = await TenantAccountLinkRepository.getByTenantId(event, input.tenant_id)
      if (!existingLink) {
        await TenantAccountLinkRepository.create(event, {
          authUserId: request.authUserId,
          tenantId: input.tenant_id,
          approvalClaimToken: request.approvalClaimToken,
        })
      }
      else if (existingLink.authUserId !== request.authUserId || existingLink.approvalClaimToken !== request.approvalClaimToken) {
        throwConflict('Người thuê đã có tài khoản thuộc phiên duyệt khác')
      }
    }
    else {
      for (const buildingId of [...new Set(input.building_ids)]) {
        const existingAssignment = await AssignmentRepository.findByUserAndBuilding(event, request.authUserId, buildingId)
        if (!existingAssignment) {
          await AssignmentRepository.insert(event, {
            user_id: request.authUserId,
            building_id: buildingId,
            created_by: actor.id,
            approval_claim_token: request.approvalClaimToken,
          })
        }
        else if (existingAssignment.approval_claim_token !== request.approvalClaimToken) {
          throwConflict('Tòa nhà đã được gán bởi phiên duyệt khác')
        }
      }
    }

    if (!roleAlreadyConfirmed) {
      try {
        await UserRepository.setAppRole(event, request.authUserId, input.role, actor.id)
      }
      catch (roleError) {
        // A timeout/5xx can reject locally while the Auth write is still in
        // flight. Never compensate from an immediate null read; preserve the
        // fenced processing state so the same decision can resume safely.
        const observed = await UserRepository.getAuthAccount(event, request.authUserId).catch(() => null)
        if (observed?.role !== input.role) throw roleError
      }
    }

    return await finalizeApproval(event, actor, request, input)
  },

  async reject(event: H3Event, actor: AuthUser, id: string, input: AccessRequestRejectionInput): Promise<AccessRequest> {
    assertCanApprove(actor)
    const request = await AccessRequestRepository.findById(event, id)
    if (!request) throwNotFound('Không tìm thấy yêu cầu truy cập')
    const rejected = await AccessRequestRepository.reject(event, id, actor.id, input.reason)
    await AuditService.append(event, actor, {
      building_id: null,
      action: AUDIT_ACTIONS.USER_ACCESS_REQUEST_REJECTED,
      entity_type: 'user',
      entity_id: request.authUserId,
      metadata: { reason: input.reason },
    })
    return rejected
  },
}
