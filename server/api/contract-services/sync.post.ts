import { ContractServiceService } from '../../services/contract-services'
import { z } from 'zod'

const syncSchema = z.object({ building_id: z.string().uuid() })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)
  const result = syncSchema.safeParse(body)
  if (!result.success) {
    throwValidationError('building_id là bắt buộc', result.error.flatten())
  }

  const added = await ContractServiceService.syncFromBuilding(event, user, result.data.building_id)
  return { data: { added } }
})
