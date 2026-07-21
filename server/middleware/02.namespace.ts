import { classifyApiNamespace } from '../utils/api-namespace'
import { roleOf } from '../utils/roles'
import { ROLES } from '../../app/utils/constants/roles'
import { requiresTenantOnboarding } from '../../app/utils/tenant-onboarding'
import { UserRepository } from '../repositories/users'

const INTERNAL_ROLES = new Set<string>([ROLES.ADMIN, ROLES.OWNER, ROLES.MANAGER])

export default defineEventHandler((event) => {
  const apiNamespace = classifyApiNamespace(event.path)
  if (!apiNamespace) return

  event.context.apiNamespace = apiNamespace

  const user = event.context.user
  if (!user) return

  if (apiNamespace === 'auth') return

  const role = roleOf(user)
  if (apiNamespace === 'tenant' && requiresTenantOnboarding(user)) {
    throwForbidden('Cần hoàn tất thiết lập tài khoản trước khi sử dụng portal')
  }
  if (apiNamespace === 'tenant' && role === ROLES.TENANT) {
    return UserRepository.getAuthAccount(event, user.id).then((account) => {
      if (account?.tenantOnboardingStage) {
        throwForbidden('Cần hoàn tất thiết lập tài khoản trước khi sử dụng portal')
      }
    })
  }
  const allowed = apiNamespace === 'tenant'
    ? role === ROLES.TENANT
    : role !== null && INTERNAL_ROLES.has(role)

  if (!allowed) throwNotFound('Không tìm thấy')
})
