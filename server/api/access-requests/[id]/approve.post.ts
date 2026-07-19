import { AccessRequestService } from '../../../services/access-requests'
import { accessRequestApprovalSchema } from '~/utils/validators/access-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, accessRequestApprovalSchema, 'Quyết định phê duyệt không hợp lệ')
  return { data: await AccessRequestService.approve(event, user, id, input) }
})
