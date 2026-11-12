import { BuildingContractProfileService } from '../../../../services/buildings/contract-profile'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await BuildingContractProfileService.get(event, user, id) }
})
