import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'
import { TenantProfileRepository } from '../../repositories/tenant-portal/profile'
import { TenantIdentityUniqueViolation } from '../../repositories/tenants/identity-errors'
import { TenantIdentityConflictService } from '../tenants/identity-conflict'
import { redactTenantAuditData } from '../../utils/tenant-audit-redaction'
import { resolveTenantId } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { throwForbidden, throwNotFound, throwValidationError } from '../../utils/errors'
import { AuditService } from '../audit'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { ContractRepository } from '../../repositories/contracts'

export const TenantProfileService = {
  async get(event: H3Event, user: AuthUser): Promise<TenantProfile> {
    if (!can(user, 'tenant.profile.read')) throwForbidden('Không có quyền xem hồ sơ')
    const id = await resolveTenantId(event, user)
    const profile = await TenantProfileRepository.findByTenantId(event, id)
    if (!profile) throwNotFound()
    return profile
  },

  async update(
    event: H3Event,
    user: AuthUser,
    input: TenantProfileUpdateInput,
  ): Promise<TenantProfile> {
    if (!can(user, 'tenant.profile.update')) throwForbidden('Không có quyền cập nhật hồ sơ')
    const id = await resolveTenantId(event, user)
    const parsed = tenantProfileUpdateSchema.safeParse(input)
    if (!parsed.success) throwValidationError('Hồ sơ cập nhật không hợp lệ', parsed.error.flatten())
    const whitelisted = parsed.data
    const candidate = { phone: whitelisted.phone, excludeId: id }
    await TenantIdentityConflictService.assertAvailable(event, user, candidate, 'portal')
    const contract = await ContractRepository.findActiveByTenantId(event, id)
    const before = await TenantProfileRepository.findByTenantId(event, id)
    if (!before) throwNotFound()
    let updated: TenantProfile
    try {
      updated = await TenantProfileRepository.updateByTenantId(event, id, whitelisted)
    }
    catch (error) {
      if (error instanceof TenantIdentityUniqueViolation) {
        return TenantIdentityConflictService.rejectUniqueViolation(event, user, candidate, 'portal')
      }
      throw error
    }
    const redacted = redactTenantAuditData(before, updated)
    await AuditService.append(event, user, {
      building_id: contract?.buildingId ?? null,
      action: AUDIT_ACTIONS.TENANT_PROFILE_UPDATED,
      entity_type: 'tenant',
      entity_id: id,
      before_data: redacted.before,
      after_data: redacted.after,
    })
    return updated
  },
}
