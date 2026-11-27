import { z } from 'zod'
import { TenantSupportRequestService } from '../../../services/tenant-portal/requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throwNotFound('Không tìm thấy yêu cầu')
  return { data: await TenantSupportRequestService.detail(event, user, id.data) }
})
