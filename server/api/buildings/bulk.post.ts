import { BuildingService } from '../../services/buildings'
import { buildingBulkActionSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = buildingBulkActionSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await BuildingService.bulkAction(event, user, result.data)
  return { data }
})
