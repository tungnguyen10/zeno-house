import { BuildingService } from '../../services/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const query = getQuery(event)
  const force = query.force === 'true' || query.force === true || query.force === '1'

  if (force) {
    const building = await BuildingService.remove(event, user, id, { force: true })
    return { data: building }
  }

  await BuildingService.remove(event, user, id)
  setResponseStatus(event, 204)
})
