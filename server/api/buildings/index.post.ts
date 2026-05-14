import { BuildingService } from '../../services/buildings'
import { buildingCreateSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = buildingCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const building = await BuildingService.create(event, user, result.data)

  setResponseStatus(event, 201)
  return { data: building }
})
