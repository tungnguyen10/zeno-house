import { readMultipartFormData } from 'h3'
import { TenantService } from '../../../services/tenants'
import { tenantIdImageSideSchema } from '~/utils/validators/tenants'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const query = getQuery(event)
  const sideResult = tenantIdImageSideSchema.safeParse(query.side)
  if (!sideResult.success) {
    throwValidationError('Mặt CCCD không hợp lệ', sideResult.error.flatten())
  }

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'image' && part.data.length > 0)
  if (!file) throwValidationError('Thiếu file ảnh CCCD')

  const tenant = await TenantService.uploadIdImage(event, user, id, sideResult.data, {
    filename: file.filename,
    type: file.type,
    data: file.data,
  })

  return { data: tenant }
})
