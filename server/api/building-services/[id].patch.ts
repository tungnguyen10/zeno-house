import { BuildingServiceService } from '../../services/building-services'
import { buildingServiceUpdateSchema } from '~/utils/validators/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const result = buildingServiceUpdateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const service = await BuildingServiceService.update(event, user, id, result.data)
  return { data: service }
})
