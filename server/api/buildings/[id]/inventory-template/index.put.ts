import { z } from 'zod'
import { inventoryListSchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../../services/inventory'

const bodySchema = z.object({ items: inventoryListSchema })

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, bodySchema, 'Danh sách nội thất không hợp lệ')
  return { data: await InventoryService.saveTemplate(event, user, id, input.items) }
})
