import { ServiceCatalogService } from '../../services/service-catalog'
import { serviceCatalogListQuerySchema } from '~/utils/validators/service-catalog'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = parseQuery(event, serviceCatalogListQuerySchema)

  const items = await ServiceCatalogService.list(event, user, input.building_id)
  return { data: items }
})
