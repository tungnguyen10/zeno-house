import { BuildingServiceService } from '../../services/building-services'
import { buildingServiceUpsertSchema } from '~/utils/validators/building-services'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = buildingServiceUpsertSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const service = await BuildingServiceService.upsert(event, user, result.data)
  return { data: service }
})
