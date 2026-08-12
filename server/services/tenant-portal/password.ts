import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { TenantPasswordChangeInput } from '~/utils/validators/tenant-portal'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { ContractRepository } from '../../repositories/contracts'
import { can } from '../../utils/permissions'
import { resolveTenantId } from '../../utils/scope'
import { throwForbidden } from '../../utils/errors'
import { randomUUID } from 'node:crypto'
import { AuditOperationService } from '../audit-operations'

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
    const contract = await ContractRepository.findActiveByTenantId(event, tenantId)
    const operation = await AuditOperationService.begin(event, {
      idempotencyKey: `tenant-password-change:${tenantId}:${randomUUID()}`,
      actorId: user.id,
      buildingId: contract?.buildingId ?? null,
      action: AUDIT_ACTIONS.TENANT_ACCOUNT_PASSWORD_CHANGED,
      entityType: 'tenant',
      entityId: tenantId,
      intentData: { kind: 'password_change' },
    })
    await UserRepository.updateCurrentPassword(
      event,
      input.password,
      input.current_password,
    )

    await AuditOperationService.complete(event, operation.id, { outcomeData: { auth: 'updated' } })
  },
}
