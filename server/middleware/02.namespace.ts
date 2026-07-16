import { classifyApiNamespace } from '../utils/api-namespace'
import { roleOf } from '../utils/roles'
import { ROLES } from '../../app/utils/constants/roles'

const INTERNAL_ROLES = new Set<string>([ROLES.ADMIN, ROLES.OWNER, ROLES.MANAGER])

export default defineEventHandler((event) => {
  const apiNamespace = classifyApiNamespace(event.path)
  if (!apiNamespace) return

  event.context.apiNamespace = apiNamespace

  const user = event.context.user
  if (!user) return

  const role = roleOf(user)
  const allowed = apiNamespace === 'tenant'
    ? role === ROLES.TENANT
    : role !== null && INTERNAL_ROLES.has(role)

  if (!allowed) throwNotFound('Không tìm thấy')
})
