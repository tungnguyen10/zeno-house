import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { Tenant, TenantSummary } from '~/types/tenants'
import type { TenantLinkVerifyInput } from '~/utils/validators/tenants'
import { normalizeTenantIdNumber } from '~/utils/tenant-identity'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { TenantRepository } from '../../repositories/tenants'
import { assertBuildingScope } from '../../utils/scope'
import { getTenantLinkSecret, signTenantLinkToken } from '../../utils/tenant-link-token'
import { AuditService } from '../audit'
import { TenantIdentityConflictService } from './identity-conflict'

export interface TenantLinkResult { tenant: TenantSummary; linkToken: string; expiresAt: string }

function linkError(statusCode: number, code: string, message: string): never {
  throw createError({ statusCode, data: { error: { code, message } } })
}

function normalizeName(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi')
}

// Records holding ID data must be proven with the ID number; legacy name-only records with the name.
function proofMatches(tenant: Tenant, proof: string): boolean {
  if (tenant.idNumber || tenant.idCardFrontPath || tenant.idCardBackPath) {
    return Boolean(tenant.idNumber) && normalizeTenantIdNumber(proof) === tenant.idNumber
  }
  return normalizeName(proof) === normalizeName(tenant.fullName)
}

export const TenantLinkService = {
  async verify(event: H3Event, user: AuthUser, input: TenantLinkVerifyInput): Promise<TenantLinkResult> {
    requireCapability(user, 'contracts.create', 'Không có quyền tạo hợp đồng')
    await assertBuildingScope(event, user, input.building_id, 'write')
    const secret = getTenantLinkSecret(event)
    if (!secret) linkError(503, 'TENANT_LINK_DISABLED', 'Chưa bật xác minh khách thuê cũ')
    await TenantIdentityConflictService.assertWithinLimit(event, user)

    const [match] = await TenantRepository.findIdentityMatches(event, { phones: [input.phone], idNumbers: [] })
    const tenant = match ? (await TenantRepository.findByIds(event, [match.tenantId]))[0] : undefined
    if (!tenant || !proofMatches(tenant, input.proof)) {
      await TenantIdentityConflictService.recordAttempt(event, user)
      await AuditService.append(event, user, {
        building_id: input.building_id,
        action: AUDIT_ACTIONS.TENANT_LINK_VERIFY_FAILED,
        entity_type: 'tenant',
        entity_id: null,
      })
      linkError(404, 'TENANT_LINK_UNVERIFIED', 'Thông tin không khớp với hồ sơ khách thuê')
    }

    const facts = (await TenantRepository.findAccessFacts(event, [tenant.id])).get(tenant.id)
    if (facts?.activeBuildingIds.length) linkError(409, 'TENANT_BUSY', 'Khách đang có hợp đồng hiệu lực ở nơi khác')

    const { token, expiresAt } = signTenantLinkToken(secret, { sub: user.id, tid: tenant.id, bid: input.building_id })
    await AuditService.append(event, user, {
      building_id: input.building_id,
      action: AUDIT_ACTIONS.TENANT_LINK_VERIFIED,
      entity_type: 'tenant',
      entity_id: tenant.id,
    })
    return {
      tenant: { id: tenant.id, code: tenant.code, fullName: tenant.fullName, phone: tenant.phone },
      linkToken: token,
      expiresAt,
    }
  },
}
