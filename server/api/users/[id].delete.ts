import { UserManagementService } from '../../services/users'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  await UserManagementService.deleteUser(event, user, id)
  setResponseStatus(event, 204)
})
