import { InventoryService } from '../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  return { data: await InventoryService.getRoom(event, user, getRouterParam(event, 'id')!) }
})
