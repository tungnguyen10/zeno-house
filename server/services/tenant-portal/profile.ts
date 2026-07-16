import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantProfile } from '~/types/tenant-portal'
import type { TenantProfileUpdateInput } from '~/utils/validators/tenant-portal'
import { tenantProfileUpdateSchema } from '~/utils/validators/tenant-portal'
import { TenantProfileRepository } from '../../repositories/tenant-portal/profile'
import { resolveTenantId } from '../../utils/scope'
import { can } from '../../utils/permissions'
import { throwForbidden, throwNotFound } from '../../utils/errors'

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
    const whitelisted = tenantProfileUpdateSchema.parse(input)
    return TenantProfileRepository.updateByTenantId(event, id, whitelisted)
  },
}
