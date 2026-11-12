import { inventoryApplySchema } from '~/utils/validators/inventory'
import { InventoryService } from '../../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  const input = await parseBody(event, inventoryApplySchema, 'Yêu cầu áp dụng không hợp lệ')
  return { data: await InventoryService.applyTemplate(event, user, id, input) }
})
