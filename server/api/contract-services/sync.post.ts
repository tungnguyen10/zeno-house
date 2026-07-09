import { ContractServiceService } from '../../services/contract-services'
import { z } from 'zod'

const syncSchema = z.object({ building_id: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const input = await parseBody(event, syncSchema, 'building_id là bắt buộc')

  const added = await ContractServiceService.syncFromBuilding(event, user, input.building_id)
  return { data: { added } }
})
