import { AccessRequestService } from '../../../services/access-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await AccessRequestService.getMine(event, user) }
})
