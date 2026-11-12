import { InventoryService } from '../../../services/inventory'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await InventoryService.getRoom(event, user, id) }
})
