import { BuildingService } from '../../services/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  await BuildingService.remove(event, user, id)
  setResponseStatus(event, 204)
})
