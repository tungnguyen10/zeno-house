import { ServiceCatalogService } from '../../services/service-catalog'
import { serviceCatalogCreateSchema } from '~/utils/validators/service-catalog'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, serviceCatalogCreateSchema)

  const item = await ServiceCatalogService.createCustom(event, user, input)
  setResponseStatus(event, 201)
  return { data: item }
})
