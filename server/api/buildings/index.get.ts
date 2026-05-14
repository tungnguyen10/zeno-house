import { BuildingService } from '../../services/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page ?? 1))
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)))

  const { items, total } = await BuildingService.list(event, user, { page, limit })

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
