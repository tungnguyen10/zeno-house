import { RoomAssignmentService } from '../../../services/room-assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const roomId = getRouterParam(event, 'roomId')!

  const assignment = await RoomAssignmentService.getByRoom(event, user, roomId)
  return { data: assignment }
})
