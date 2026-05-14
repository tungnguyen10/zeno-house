import { BuildingService } from '../../services/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const building = await BuildingService.get(event, user, id)
  return { data: building }
})
