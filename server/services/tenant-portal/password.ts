import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantPasswordChangeInput } from '~/utils/validators/tenant-portal'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { ContractRepository } from '../../repositories/contracts'
import { can } from '../../utils/permissions'
import { resolveTenantId } from '../../utils/scope'
import { throwForbidden } from '../../utils/errors'
import { AuditService } from '../audit'

export const TenantPasswordService = {
  async change(
    event: H3Event,
    user: AuthUser,
    input: TenantPasswordChangeInput,
  ): Promise<void> {
    if (!can(user, 'tenant.profile.update')) {
      throwForbidden('Không có quyền đổi mật khẩu')
    }

    const tenantId = await resolveTenantId(event, user)
    await UserRepository.updateCurrentPassword(
      event,
      input.password,
      input.current_password,
    )

    const contract = await ContractRepository.findActiveByTenantId(event, tenantId)
    await AuditService.append(event, user, {
      building_id: contract?.buildingId ?? null,
      action: AUDIT_ACTIONS.TENANT_ACCOUNT_PASSWORD_CHANGED,
      entity_type: 'tenant',
      entity_id: tenantId,
    })
  },
}
