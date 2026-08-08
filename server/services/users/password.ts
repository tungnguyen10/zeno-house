import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { UserPasswordChangeInput } from '~/utils/validators/users'
import { AUDIT_ACTIONS } from '~/utils/constants/audit'
import { UserRepository } from '../../repositories/users'
import { can } from '../../utils/permissions'
import { throwForbidden } from '../../utils/errors'
import { AuditService } from '../audit'

export const UserPasswordService = {
  async change(event: H3Event, user: AuthUser, input: UserPasswordChangeInput): Promise<void> {
    if (!can(user, 'account.profile.update')) throwForbidden('Không có quyền đổi mật khẩu')

    await UserRepository.updateCurrentPassword(event, input.password, input.current_password)

    await AuditService.append(event, user, {
      building_id: null,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
      entity_type: 'user',
      entity_id: user.id,
    })
  },
}
