import { z } from 'zod'
import { tenantSupportRequestStatusUpdateSchema } from '~/utils/validators/tenant-support-requests'
import { TenantSupportRequestOperatorService } from '../../services/tenant-portal/operator-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = z.string().uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throwNotFound('Không tìm thấy yêu cầu')
  const input = await parseBody(event, tenantSupportRequestStatusUpdateSchema)
  return { data: await TenantSupportRequestOperatorService.updateStatus(event, user, id.data, input) }
})
