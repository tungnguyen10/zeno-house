import { BuildingServiceService } from '../../services/building-services'
import { buildingServiceDeleteSchema } from '~/utils/validators/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)
  const result = buildingServiceDeleteSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  await BuildingServiceService.remove(event, user, id, { reason: result.data.reason })
  setResponseStatus(event, 204)
})
