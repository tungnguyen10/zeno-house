import { ContractService } from '../../services/contracts'
import { contractBulkActionSchema } from '~/utils/validators/contracts'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = contractBulkActionSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('Dữ liệu không hợp lệ', result.error.flatten())
  }

  const data = await ContractService.bulkAction(event, user, result.data)
  return { data }
})
