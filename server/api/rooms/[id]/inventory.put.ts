import { z } from 'zod'
import { inventoryListSchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../services/inventory'

const bodySchema = z.object({ items: inventoryListSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const result = bodySchema.safeParse(await readBody(event))
  if (!result.success) throwValidationError('Danh sách nội thất không hợp lệ', result.error.flatten())
  return { data: await InventoryService.saveRoom(event, user, id, result.data.items) }
})
