import { z } from 'zod'
import { contractVehicleListSchema } from '~/utils/validators/contract-vehicles'
import { ContractService } from '../../../services/contracts'

const bodySchema = z.object({ items: contractVehicleListSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách xe không hợp lệ', result.error.flatten())
  return { data: await ContractService.saveVehicles(event, user, id, result.data.items) }
})
