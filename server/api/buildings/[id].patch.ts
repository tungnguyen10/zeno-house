import { BuildingService } from '../../services/buildings'
import { buildingUpdateSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const body = await readBody(event)
  const result = buildingUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const building = await BuildingService.update(event, user, id, result.data)
  return { data: building }
})
