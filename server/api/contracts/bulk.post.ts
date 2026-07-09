import { ContractService } from '../../services/contracts'
import { contractBulkActionSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const input = await parseBody(event, contractBulkActionSchema)

  const data = await ContractService.bulkAction(event, user, input)
  return { data }
})
