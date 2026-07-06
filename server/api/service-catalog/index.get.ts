import { ServiceCatalogService } from '../../services/service-catalog'
import { serviceCatalogListQuerySchema } from '~/utils/validators/service-catalog'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const result = serviceCatalogListQuerySchema.safeParse(getQuery(event))
  if (!result.success) {
    throwValidationError('Tham số truy vấn không hợp lệ', result.error.flatten())
  }

  const items = await ServiceCatalogService.list(event, user, result.data.building_id)
  return { data: items }
})
