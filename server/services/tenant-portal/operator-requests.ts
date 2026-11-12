import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { OperatorTenantSupportRequest, TenantSupportRequestQueuePage } from '~/types/tenant-support-requests'
import { mapOperatorTenantSupportRequest } from '~/utils/mappers/tenant-support-requests'
import type { TenantSupportRequestRow } from '~/utils/mappers/tenant-portal'
import { tenantSupportRequestQueueQuerySchema, tenantSupportRequestStatusUpdateSchema } from '~/utils/validators/tenant-support-requests'
import { TenantSupportRequestRepository } from '../../repositories/tenant-portal/requests'
import { TenantDocumentRepository } from '../../repositories/tenant-portal/documents'
import { TenantAuthorizationService } from '../tenants/authorization'
import { getVisibleBuildingIds } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { throwForbidden, throwNotFound, throwValidationError } from '../../utils/errors'

async function operatorRequest(event: H3Event, row: TenantSupportRequestRow, label: string, code: string): Promise<OperatorTenantSupportRequest> {
  let signedUrl: string | null = null
  let unavailable = false
  if (row.attachment_path) {
    const [tenantId, scope, ...segments] = row.attachment_path.split('/')
    const valid = tenantId === row.tenant_id && scope === 'requests'
      && segments.length > 0 && segments.every(segment => segment !== '' && segment !== '.' && segment !== '..')
    if (valid) {
      try { signedUrl = await TenantDocumentRepository.createSignedUrl(event, row.attachment_path) }
      catch { unavailable = true }
      if (!signedUrl) unavailable = true
    }
    else unavailable = true
  }
  return mapOperatorTenantSupportRequest(row, label, code, signedUrl, unavailable)
}

export const TenantSupportRequestOperatorService = {
  async list(event: H3Event, user: AuthUser, input: unknown): Promise<TenantSupportRequestQueuePage> {
    if (!can(user, 'tenants.read')) throwForbidden('Không có quyền xem yêu cầu người thuê')
    const parsed = tenantSupportRequestQueueQuerySchema.safeParse(input)
    if (!parsed.success) throwValidationError('Bộ lọc yêu cầu không hợp lệ')
    const query = parsed.data
    const scope = await getVisibleBuildingIds(event, user)
    const empty = { data: [], meta: { total: 0, page: query.page, limit: query.limit, totalPages: 0 } }
    if (scope?.length === 0) return empty
    const candidates = await TenantSupportRequestRepository.listOperatorCandidates(event, scope, query.status)
    // Defend before loading descriptions/paths even when a repository adapter returns extra rows.
    const visible = candidates.filter(row => scope === null || scope.includes(row.building_id))
    const contexts = await TenantAuthorizationService.resolveAccessMany(event, user, [...new Set(visible.map(row => row.tenant_id))])
    const authorized = visible.filter(row => contexts.get(row.tenant_id)?.level === 'full')
    const total = authorized.length
    const page = authorized.slice((query.page - 1) * query.limit, query.page * query.limit)
    if (!page.length) return { ...empty, meta: { ...empty.meta, total, totalPages: Math.ceil(total / query.limit) } }
    const rows = await TenantSupportRequestRepository.findByIds(event, page.map(row => row.id))
    const byId = new Map(rows.map(row => [row.id, row]))
    const data: OperatorTenantSupportRequest[] = []
    for (const candidate of page) {
      const row = byId.get(candidate.id)
      if (!row || row.tenant_id !== candidate.tenant_id || row.building_id !== candidate.building_id) continue
      data.push(await operatorRequest(event, row, contexts.get(row.tenant_id)!.tenant.fullName, contexts.get(row.tenant_id)!.tenant.code || row.tenant_id))
    }
    return { data, meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) } }
  },

  async updateStatus(event: H3Event, user: AuthUser, id: string, input: unknown): Promise<OperatorTenantSupportRequest> {
    if (!can(user, 'tenants.update')) throwForbidden('Không có quyền xử lý yêu cầu người thuê')
    const parsed = tenantSupportRequestStatusUpdateSchema.safeParse(input)
    if (!parsed.success) throwValidationError('Trạng thái yêu cầu không hợp lệ')
    const scope = await getVisibleBuildingIds(event, user)
    const row = await TenantSupportRequestRepository.findOperatorCandidate(event, id)
    if (!row || (scope !== null && !scope.includes(row.building_id))) throwNotFound('Không tìm thấy yêu cầu')
    const contexts = await TenantAuthorizationService.resolveAccessMany(event, user, [row.tenant_id])
    const context = contexts.get(row.tenant_id)
    if (context?.level !== 'full') throwNotFound('Không tìm thấy yêu cầu')
    const updated = await TenantSupportRequestRepository.updateStatusWithAudit(event, id, parsed.data, user.id)
    return operatorRequest(event, updated, context.tenant.fullName, context.tenant.code || row.tenant_id)
  },
}
