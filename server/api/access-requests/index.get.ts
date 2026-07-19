import { AccessRequestService } from '../../services/access-requests'
import { accessRequestListQuerySchema } from '~/utils/validators/access-requests'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = parseQuery(event, accessRequestListQuerySchema)
  return { data: await AccessRequestService.list(event, user, query.status) }
})
