import { ContractService } from '../../services/contracts'
import { contractDeleteSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const result = contractDeleteSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const query = getQuery(event)
  const force = query.force === 'true'

  const deleted = await ContractService.remove(event, user, id, {
    force,
    reason: result.data.reason,
  })
  if (force) return { data: deleted }

  setResponseStatus(event, 204)
})
