import { AccessRequestService } from '../../../services/access-requests'
import { accessRequestRejectionSchema } from '~/utils/validators/access-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, accessRequestRejectionSchema, 'Lý do từ chối không hợp lệ')
  return { data: await AccessRequestService.reject(event, user, id, input) }
})
