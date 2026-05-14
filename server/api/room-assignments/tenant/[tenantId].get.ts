import { RoomAssignmentService } from '../../../services/room-assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const tenantId = getRouterParam(event, 'tenantId')!

  const assignment = await RoomAssignmentService.getByTenant(event, user, tenantId)
  return { data: assignment }
})
