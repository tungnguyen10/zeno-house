import { BuildingService } from '../../services/buildings'
import { buildingListQuerySchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rawQuery = getQuery(event)
  const result = buildingListQuerySchema.safeParse(rawQuery)
  if (!result.success) {
    throwValidationError('Tham số truy vấn không hợp lệ', result.error.flatten())
  }

  const { page, limit, q, status, sort, order } = result.data
  const { items, total } = await BuildingService.list(event, user, { page, limit, q, status, sort, order })

  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
})
