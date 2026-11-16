import { z } from 'zod'
import { inventoryListSchema } from '~/utils/validators/inventory'
import { ContractService } from '../../../services/contracts'

const bodySchema = z.object({ items: inventoryListSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách bàn giao không hợp lệ', result.error.flatten())
  return { data: await ContractService.updateHandoverInventory(event, user, id, result.data.items) }
})
