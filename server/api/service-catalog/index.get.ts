import { ServiceCatalogService } from '../../services/service-catalog'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const items = await ServiceCatalogService.list(event, user)
  return { data: items }
})
