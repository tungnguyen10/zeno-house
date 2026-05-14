import { RoomAssignmentService } from '../../services/room-assignments'
import { assignSchema } from '~/utils/validators/room-assignments'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = assignSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const assignment = await RoomAssignmentService.assign(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: assignment }
})
