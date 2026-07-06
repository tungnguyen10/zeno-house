import { ServiceCatalogService } from '../../services/service-catalog'
import { serviceCatalogCreateSchema } from '~/utils/validators/service-catalog'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const result = serviceCatalogCreateSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const item = await ServiceCatalogService.createCustom(event, user, result.data)
  setResponseStatus(event, 201)
  return { data: item }
})
