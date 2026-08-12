import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { UserPasswordChangeInput } from '~/utils/validators/users'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { can } from '../../utils/permissions'
import { throwForbidden } from '../../utils/errors'
import { randomUUID } from 'node:crypto'
import { AuditOperationService } from '../audit-operations'

export const UserPasswordService = {
  async change(event: H3Event, user: AuthUser, input: UserPasswordChangeInput): Promise<void> {
    if (!can(user, 'account.profile.update')) throwForbidden('Không có quyền đổi mật khẩu')

    const operation = await AuditOperationService.begin(event, {
      idempotencyKey: `user-password-change:${user.id}:${randomUUID()}`,
      actorId: user.id,
      buildingId: null,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
      entityType: 'user',
      entityId: user.id,
      intentData: { kind: 'password_change' },
    })
    await UserRepository.updateCurrentPassword(event, input.password, input.current_password)
    await AuditOperationService.complete(event, operation.id, { outcomeData: { auth: 'updated' } })
  },
}
