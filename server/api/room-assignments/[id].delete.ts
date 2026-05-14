import { RoomAssignmentService } from '../../services/room-assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const assignment = await RoomAssignmentService.unassign(event, user, id)
  return { data: assignment }
})
